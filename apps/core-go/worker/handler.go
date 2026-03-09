package worker

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/metrics"
)

// NewHandler creates a new HTTP handler for the worker using the provided Worker instance.
func NewHandler(w *Worker) http.HandlerFunc {
	// Initialize default logger
	baseLogger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	return func(rw http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(rw, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse payload strictly to get JobID for logging (optional)
		var triggerPayload struct {
			JobID string `json:"job_id"`
		}
		json.NewDecoder(r.Body).Decode(&triggerPayload)
		r.Body.Close()

		ctx := r.Context()

		// 1. Atomic Acquire via JobStore
		job, err := w.Deps.JobStore.AcquireJob(ctx)
		if err != nil {
			baseLogger.Error("AcquireJob failed", "error", err)
			http.Error(rw, "acquire failed", http.StatusInternalServerError)
			return
		}

		if job == nil {
			// No work available
			rw.WriteHeader(http.StatusOK)
			rw.Write([]byte(`{"status":"idle"}`))
			return
		}

		// Construct payload from Metadata
		payload, err := jobToPayload(job)
		if err != nil {
			baseLogger.Error("Invalid metadata", "job_id", job.ID, "error", err)
			w.Deps.JobStore.MarkJobFailed(ctx, payload.WorkspaceID, job.ID, "invalid metadata", job.AttemptCount)
			metrics.JobFailuresTotal.Inc()
			rw.WriteHeader(http.StatusOK) // Don't retry invalid metadata
			return
		}

		// Structured trace logger
		logger := baseLogger.With(
			"trace_id", payload.TraceID,
			"job_id", job.ID,
			"package_id", job.PackageID,
			"workspace_id", payload.WorkspaceID,
		)

		logger.Info("Job acquired", "attempt", job.AttemptCount, "status", db.StatusRunning)
		metrics.JobsAcquiredTotal.WithLabelValues("success").Inc()
		metrics.JobStartedTotal.Inc()

		start := time.Now()

		// 2. Mark package as generating
		w.Deps.JobStore.UpdatePackageStatus(ctx, job.WorkspaceID, job.PackageID, "generating")

		// 3. Exec
		result, err := w.ExecuteJob(ctx, payload, logger)

		duration := time.Since(start)
		durationMs := float64(duration.Milliseconds())

		// 4. Handle Result
		if err != nil || (result != nil && result.Status == "failed") {
			reason := "unknown error"
			if err != nil {
				reason = err.Error()
			} else if result != nil {
				reason = result.FailureReason
			}

			logger.Error("Job failed", "error", reason, "duration_ms", durationMs, "to_status", db.StatusQueued)
			metrics.JobDurationMs.WithLabelValues("failed").Observe(durationMs)
			metrics.JobRetriesTotal.Inc()

			// Retry logic handled by MarkJobFailed
			// Note: We need to pass attemptCount. JobStore.MarkJobFailed expects it.
			w.Deps.JobStore.MarkJobFailed(ctx, job.WorkspaceID, job.ID, reason, job.AttemptCount)

			// If it reached max attempts and is now really 'failed'
			if job.AttemptCount >= 5 {
				metrics.JobFailedTotal.Inc()
				logger.Error("Job terminal failure", "job_id", job.ID, "status", db.StatusFailed)
			}

			// Also update package
			w.Deps.JobStore.UpdatePackageStatus(ctx, job.WorkspaceID, job.PackageID, db.StatusFailed)

			rw.WriteHeader(http.StatusOK)
			return
		}

		// Success
		logger.Info("Job done successfully", "duration_ms", durationMs, "status", db.StatusDone)
		metrics.JobDurationMs.WithLabelValues("done").Observe(durationMs)
		metrics.JobCompletedTotal.Inc()

		// MarkJobDone is usually called here to close the loop
		// PR-030 Invariant: "MarkJobDone only after pdf_receipt persisted"
		// ExecuteJob returns success ONLY if PDF/Upload/Persist worked.
		// So it is safe to call MarkJobDone here.
		// Wait, did ExecuteJob return result? Yes.

		w.Deps.JobStore.MarkJobDone(ctx, job.WorkspaceID, job.ID)
		w.Deps.JobStore.UpdatePackageStatus(ctx, job.WorkspaceID, job.PackageID, "ready")

		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusOK)
		json.NewEncoder(rw).Encode(result)
	}
}

// NewAIHandler creates a synchronous HTTP handler for AI assist requests.
func NewAIHandler(w *Worker) http.HandlerFunc {
	baseLogger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	return func(rw http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(rw, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			WorkspaceID string `json:"workspace_id"`
			ModuleID    string `json:"module_id"`
			Section     string `json:"section"`
			Action      string `json:"action"`
			Content     string `json:"content"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(rw, "invalid request body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		logger := baseLogger.With(
			"workspace_id", req.WorkspaceID,
			"module_id", req.ModuleID,
			"section", req.Section,
			"action", req.Action,
		)

		logger.Info("AI assist request received")

		suggestion, resp, err := w.AssistSection(r.Context(), req.Section, req.Action, req.Content)
		if err != nil {
			logger.Error("AI assist failed", "error", err)
			http.Error(rw, fmt.Sprintf("AI assist failed: %v", err), http.StatusInternalServerError)
			return
		}

		rw.Header().Set("Content-Type", "application/json")
		json.NewEncoder(rw).Encode(map[string]interface{}{
			"suggestion": suggestion,
			"ai_receipt": map[string]interface{}{
				"model":       resp.ModelName,
				"input_hash":  resp.PromptHash,
				"output_hash": resp.OutputHash,
			},
		})
	}
}

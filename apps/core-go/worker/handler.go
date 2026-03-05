package worker

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

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

		logger.Info("Job acquired", "attempt", job.AttemptCount)
		metrics.JobsAcquiredTotal.WithLabelValues("success").Inc()

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

			logger.Error("Job failed", "error", reason, "duration_ms", durationMs)
			metrics.JobDurationMs.WithLabelValues("failed").Observe(durationMs)
			metrics.JobRetriesTotal.Inc()

			// Retry logic handled by MarkJobFailed
			// Note: We need to pass attemptCount. JobStore.MarkJobFailed expects it.
			w.Deps.JobStore.MarkJobFailed(ctx, job.WorkspaceID, job.ID, reason, job.AttemptCount)

			// Also update package
			w.Deps.JobStore.UpdatePackageStatus(ctx, job.WorkspaceID, job.PackageID, "failed")

			rw.WriteHeader(http.StatusOK)
			return
		}

		// Success
		logger.Info("Job completed successfully", "duration_ms", durationMs)
		metrics.JobDurationMs.WithLabelValues("completed").Observe(durationMs)

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

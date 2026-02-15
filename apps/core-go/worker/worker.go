package worker

import (
	"encoding/json"
	"fmt"
	"net/http"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/validator"
)

// TaskPayload is the Cloud Task payload for a generate job.
type TaskPayload struct {
	JobID    string `json:"job_id"`
	PackPath string `json:"pack_path"`
	Semester string `json:"semester"`
}

// WorkerResult is the outcome of a worker execution.
type WorkerResult struct {
	JobID         string                      `json:"job_id"`
	Status        string                      `json:"status"` // "completed" or "failed"
	PlannerResult *planner.PlannerResult      `json:"planner_result,omitempty"`
	ValidationOK  bool                        `json:"validation_ok"`
	Errors        []validator.ValidationError `json:"errors,omitempty"`
	FailureReason string                      `json:"failure_reason,omitempty"`
}

// ExecuteJob runs the planner + validator pipeline. Pure function, no DB side-effects.
// Worker is safe to retry: no billing here, billing is at job creation.
func ExecuteJob(payload TaskPayload) (*WorkerResult, error) {
	// 1. Load pack
	pack, err := packloader.LoadPack(payload.PackPath)
	if err != nil {
		return &WorkerResult{
			JobID:         payload.JobID,
			Status:        "failed",
			FailureReason: fmt.Sprintf("failed to load pack: %v", err),
		}, nil
	}

	// 2. Run planner
	config := planner.DefaultConfig()
	config.Semester = payload.Semester

	planResult, err := planner.Plan(planner.PlannerInput{
		Pack:   pack,
		Config: config,
	})
	if err != nil {
		return &WorkerResult{
			JobID:         payload.JobID,
			Status:        "failed",
			FailureReason: fmt.Sprintf("planner failed: %v", err),
		}, nil
	}

	// 3. Run validator
	report, err := validator.Validate(validator.ValidatorInput{
		Pack:   pack,
		Result: planResult,
	})
	if err != nil {
		return &WorkerResult{
			JobID:         payload.JobID,
			Status:        "failed",
			FailureReason: fmt.Sprintf("validator error: %v", err),
		}, nil
	}

	if !report.OK {
		return &WorkerResult{
			JobID:         payload.JobID,
			Status:        "failed",
			ValidationOK:  false,
			Errors:        report.Errors,
			FailureReason: fmt.Sprintf("validation failed with %d errors", len(report.Errors)),
		}, nil
	}

	// 4. Success
	return &WorkerResult{
		JobID:         payload.JobID,
		Status:        "completed",
		PlannerResult: planResult,
		ValidationOK:  true,
	}, nil
}

// Handler returns an HTTP handler for POST /tasks/generate.
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse payload
		var payload TaskPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, fmt.Sprintf("invalid payload: %v", err), http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		if payload.JobID == "" || payload.PackPath == "" {
			http.Error(w, "missing job_id or pack_path", http.StatusBadRequest)
			return
		}

		// Execute pipeline
		result, err := ExecuteJob(payload)
		if err != nil {
			http.Error(w, fmt.Sprintf("execution error: %v", err), http.StatusInternalServerError)
			return
		}

		// Return result (caller is responsible for DB update)
		w.Header().Set("Content-Type", "application/json")
		if result.Status == "completed" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusUnprocessableEntity)
		}
		json.NewEncoder(w).Encode(result)
	}
}

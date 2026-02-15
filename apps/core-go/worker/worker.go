package worker

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"modulajar/apps/core-go/docgraph"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/validator"
)

// TaskPayload is the Cloud Task payload for a generate job.
type TaskPayload struct {
	JobID       string `json:"job_id"`
	PackageID   string `json:"package_id"`
	WorkspaceID string `json:"workspace_id"`
	PackPath    string `json:"pack_path"`
	Semester    string `json:"semester"`
	Kelas       string `json:"kelas"`
	TahunAjaran string `json:"tahun_ajaran"`
}

// StatusUpdate represents a status change to be applied by the caller.
type StatusUpdate struct {
	Table  string `json:"table"` // "packages" or "generation_jobs"
	ID     string `json:"id"`
	Status string `json:"status"`
}

// WorkerResult is the outcome of a worker execution.
type WorkerResult struct {
	JobID         string                      `json:"job_id"`
	PackageID     string                      `json:"package_id"`
	Status        string                      `json:"status"` // "completed" or "failed"
	PlannerResult *planner.PlannerResult      `json:"planner_result,omitempty"`
	ValidationOK  bool                        `json:"validation_ok"`
	Errors        []validator.ValidationError `json:"errors,omitempty"`
	FailureReason string                      `json:"failure_reason,omitempty"`
	StatusUpdates []StatusUpdate              `json:"status_updates"`
	DocGraph      *docgraph.DocGraphResult    `json:"doc_graph,omitempty"`
}

// ExecuteJob runs the planner + validator + doc graph pipeline.
// Pure function, no DB side-effects. Safe to retry.
func ExecuteJob(payload TaskPayload) (*WorkerResult, error) {
	didSecret := os.Getenv("DID_SECRET")
	if didSecret == "" {
		didSecret = "modulajar-did-dev-secret"
	}

	// Start: package -> generating, job -> running
	startUpdates := []StatusUpdate{
		{Table: "packages", ID: payload.PackageID, Status: "generating"},
		{Table: "generation_jobs", ID: payload.JobID, Status: "running"},
	}

	failResult := func(reason string) *WorkerResult {
		return &WorkerResult{
			JobID:         payload.JobID,
			PackageID:     payload.PackageID,
			Status:        "failed",
			FailureReason: reason,
			StatusUpdates: append(startUpdates,
				StatusUpdate{Table: "packages", ID: payload.PackageID, Status: "failed"},
				StatusUpdate{Table: "generation_jobs", ID: payload.JobID, Status: "failed"},
			),
		}
	}

	// 1. Load pack
	pack, err := packloader.LoadPack(payload.PackPath)
	if err != nil {
		return failResult(fmt.Sprintf("failed to load pack: %v", err)), nil
	}

	// 2. Run planner
	config := planner.DefaultConfig()
	config.Semester = payload.Semester

	planResult, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		return failResult(fmt.Sprintf("planner failed: %v", err)), nil
	}

	// 3. Run validator
	report, err := validator.Validate(validator.ValidatorInput{Pack: pack, Result: planResult})
	if err != nil {
		return failResult(fmt.Sprintf("validator error: %v", err)), nil
	}

	if !report.OK {
		r := failResult(fmt.Sprintf("validation failed with %d errors", len(report.Errors)))
		r.ValidationOK = false
		r.Errors = report.Errors
		return r, nil
	}

	// 4. Build document graph
	graphResult, err := docgraph.BuildDocGraph(docgraph.DocGraphInput{
		WorkspaceID: payload.WorkspaceID,
		PackageID:   payload.PackageID,
		Kelas:       payload.Kelas,
		Semester:    payload.Semester,
		TahunAjaran: payload.TahunAjaran,
		DIDSecret:   didSecret,
		PlanResult:  planResult,
	})
	if err != nil {
		return failResult(fmt.Sprintf("doc graph failed: %v", err)), nil
	}

	// 5. Success
	return &WorkerResult{
		JobID:         payload.JobID,
		PackageID:     payload.PackageID,
		Status:        "completed",
		PlannerResult: planResult,
		ValidationOK:  true,
		DocGraph:      graphResult,
		StatusUpdates: append(startUpdates,
			StatusUpdate{Table: "packages", ID: payload.PackageID, Status: "ready"},
			StatusUpdate{Table: "generation_jobs", ID: payload.JobID, Status: "completed"},
		),
	}, nil
}

// Handler returns an HTTP handler for POST /tasks/generate.
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

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

		result, err := ExecuteJob(payload)
		if err != nil {
			http.Error(w, fmt.Sprintf("execution error: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if result.Status == "completed" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusUnprocessableEntity)
		}
		json.NewEncoder(w).Encode(result)
	}
}

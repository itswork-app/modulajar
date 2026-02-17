package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/docgraph"
	"modulajar/apps/core-go/gcs"
	"modulajar/apps/core-go/metrics"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"
)

// TaskPayload is the internal payload used by ExecuteJob.
// Now constructed from DB data, not Cloud Tasks payload.
type TaskPayload struct {
	JobID       string `json:"job_id"`
	PackageID   string `json:"package_id"`
	WorkspaceID string `json:"workspace_id"`
	PackPath    string `json:"pack_path"`
	Semester    string `json:"semester"`
	Kelas       string `json:"kelas"`
	TahunAjaran string `json:"tahun_ajaran"`
	TeacherName string `json:"teacher_name"`
	SchoolName  string `json:"school_name"`
	PID         string `json:"pid"`
	TraceID     string `json:"trace_id"`
}

// RenderedDocument holds the composed HTML for one document (subject).
type RenderedDocument struct {
	DocumentID   string `json:"document_id"`
	DID          string `json:"did"`
	SubjectCode  string `json:"subject_code"`
	HTML         string `json:"html"`
	FilePath     string `json:"file_path"`          // "html://{did}/v1" or "gcs://bucket/path.pdf"
	PDFPath      string `json:"pdf_path,omitempty"` // temp local PDF path (cleared after upload)
	PDFSizeBytes int64  `json:"pdf_size_bytes,omitempty"`
}

// WorkerResult is the outcome of a worker execution.
type WorkerResult struct {
	JobID             string                      `json:"job_id"`
	PackageID         string                      `json:"package_id"`
	Status            string                      `json:"status"` // "completed" or "failed"
	PlannerResult     *planner.PlannerResult      `json:"planner_result,omitempty"`
	ValidationOK      bool                        `json:"validation_ok"`
	Errors            []validator.ValidationError `json:"errors,omitempty"`
	FailureReason     string                      `json:"failure_reason,omitempty"`
	DocGraph          *docgraph.DocGraphResult    `json:"doc_graph,omitempty"`
	RenderedDocuments []RenderedDocument          `json:"rendered_documents,omitempty"`
}

// ExecuteJob runs the planner + validator + doc graph + HTML composer pipeline.
func ExecuteJob(ctx context.Context, payload TaskPayload, logger *slog.Logger) (*WorkerResult, error) {
	didSecret := os.Getenv("DID_SECRET")
	if didSecret == "" {
		didSecret = "modulajar-did-dev-secret"
	}

	failResult := func(reason string) *WorkerResult {
		return &WorkerResult{
			JobID:         payload.JobID,
			PackageID:     payload.PackageID,
			Status:        "failed",
			FailureReason: reason,
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

	// IDEMPOTENCY CHECK: Check if artifacts already exist
	gcsBucket := os.Getenv("GCS_BUCKET")
	var gcsClient *gcs.Client

	if gcsBucket != "" {
		gcsClient, err = gcs.NewClient(ctx)
		if err == nil && gcsClient != nil {
			defer gcsClient.Close()
			allExist := true
			for _, doc := range graphResult.Documents {
				// Check version 1 (default)
				objectPath := gcs.ArtifactPath(payload.WorkspaceID, payload.PID, doc.PublicID, 1)
				exists, _ := gcsClient.Exists(ctx, objectPath)
				if !exists {
					allExist = false
					break
				}
			}
			if allExist {
				// Optimization: Skip regeneration
				logger.Info("Idempotency check passed (all artifacts exist). Skipping generation.")
				return &WorkerResult{
					JobID:         payload.JobID,
					PackageID:     payload.PackageID,
					Status:        "completed",
					PlannerResult: planResult,
					ValidationOK:  true,
					DocGraph:      graphResult,
				}, nil
			}
		}
	}

	// 5. Compose HTML for each document
	templateDir := resolveTemplateDir(payload.PackPath)
	renderedDocs := make([]RenderedDocument, 0, len(graphResult.Documents))

	for _, doc := range graphResult.Documents {
		verifyBaseURL := os.Getenv("VERIFY_BASE_URL")
		if verifyBaseURL == "" {
			verifyBaseURL = "https://verify.modulajar.app"
		}
		verifyURL := fmt.Sprintf("%s/verify/%s", verifyBaseURL, doc.PublicID)

		html, err := render.ComposeModulAjarHTML(render.ComposerInput{
			TemplateDir: templateDir,
			SubjectCode: doc.SubjectCode,
			SubjectName: subjectName(pack, doc.SubjectCode),
			TeacherName: payload.TeacherName,
			SchoolName:  payload.SchoolName,
			Kelas:       payload.Kelas,
			Semester:    payload.Semester,
			TahunAjaran: payload.TahunAjaran,
			PID:         payload.PID,
			DID:         doc.PublicID,
			VerifyURL:   verifyURL,
			PlanResult:  planResult,
		})
		if err != nil {
			return failResult(fmt.Sprintf("compose HTML failed for %s: %v", doc.SubjectCode, err)), nil
		}

		filePath := fmt.Sprintf("html://%s/v1", doc.PublicID)
		renderedDocs = append(renderedDocs, RenderedDocument{
			DocumentID:  doc.ID,
			DID:         doc.PublicID,
			SubjectCode: doc.SubjectCode,
			HTML:        html,
			FilePath:    filePath,
		})
	}

	// 6. PDF render
	pdfEnabled := render.IsPDFRenderAvailable()
	if pdfEnabled {
		for i, rd := range renderedDocs {
			tmpPDF := filepath.Join(os.TempDir(), fmt.Sprintf("modulajar-%s.pdf", rd.DID))
			pdfResult, err := render.RenderPDF(rd.HTML, tmpPDF)
			if err != nil {
				logger.Warn("PDF render skipped", "subject", rd.SubjectCode, "error", err)
				continue
			}
			renderedDocs[i].PDFPath = tmpPDF
			renderedDocs[i].PDFSizeBytes = pdfResult.SizeBytes
		}
	}

	// 7. GCS upload
	if gcsClient != nil {
		for i, rd := range renderedDocs {
			if rd.PDFPath == "" {
				continue
			}
			objectPath := gcs.ArtifactPath(payload.WorkspaceID, payload.PID, rd.DID, 1)
			if err := gcsClient.UploadFile(ctx, objectPath, rd.PDFPath, "application/pdf"); err != nil {
				logger.Warn("GCS upload failed", "subject", rd.SubjectCode, "error", err)
				metrics.GCSUploadTotal.WithLabelValues("failed").Inc()
				continue
			}
			metrics.GCSUploadTotal.WithLabelValues("success").Inc()
			renderedDocs[i].FilePath = gcs.FullGCSURI(gcsBucket, objectPath)
			os.Remove(rd.PDFPath)
			renderedDocs[i].PDFPath = ""
		}
	}

	// 8. Update graph paths
	for i, ver := range graphResult.Versions {
		for _, rd := range renderedDocs {
			if ver.DocumentID == rd.DocumentID {
				graphResult.Versions[i].FilePath = rd.FilePath
				break
			}
		}
	}

	return &WorkerResult{
		JobID:             payload.JobID,
		PackageID:         payload.PackageID,
		Status:            "completed",
		PlannerResult:     planResult,
		ValidationOK:      true,
		DocGraph:          graphResult,
		RenderedDocuments: renderedDocs,
	}, nil
}

// Handler returns an HTTP handler for POST /tasks/generate.
func Handler() http.HandlerFunc {
	// Initialize default logger (slog uses JSON by default in Cloud Run if configured)
	baseLogger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse payload strictly to get JobID for logging (optional)
		// Or just ignore it as we use AcquireJob.
		// We'll decode just to verify it's a valid request.
		var triggerPayload struct {
			JobID string `json:"job_id"`
		}
		json.NewDecoder(r.Body).Decode(&triggerPayload)
		r.Body.Close()

		ctx := r.Context()

		// 1. Atomic Acquire
		job, err := db.AcquireJob(ctx)
		if err != nil {
			baseLogger.Error("AcquireJob failed", "error", err)
			http.Error(w, "acquire failed", http.StatusInternalServerError)
			return
		}

		if job == nil {
			// No work available
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"idle"}`))
			return
		}

		// Construct payload from Metadata
		payload, err := jobToPayload(job)
		if err != nil {
			baseLogger.Error("Invalid metadata", "job_id", job.ID, "error", err)
			db.MarkJobFailed(ctx, job.ID, "invalid metadata", job.AttemptCount)
			metrics.JobFailuresTotal.Inc()
			w.WriteHeader(http.StatusOK) // Don't retry invalid metadata
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
		db.UpdatePackageStatus(ctx, job.PackageID, "generating")

		// 3. Exec
		result, err := ExecuteJob(ctx, payload, logger)

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
			db.MarkJobFailed(ctx, job.ID, reason, job.AttemptCount)

			// Also update package
			db.UpdatePackageStatus(ctx, job.PackageID, "failed")

			w.WriteHeader(http.StatusOK) // We handled the failure, Cloud Tasks should consider it done (we manage retries via DB)
			return
		}

		// Success
		logger.Info("Job completed successfully", "duration_ms", durationMs)
		metrics.JobDurationMs.WithLabelValues("completed").Observe(durationMs)

		db.MarkJobDone(ctx, job.ID)
		db.UpdatePackageStatus(ctx, job.PackageID, "ready")

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func jobToPayload(job *db.GenerationJob) (TaskPayload, error) {
	b, err := json.Marshal(job.Metadata)
	if err != nil {
		return TaskPayload{}, err
	}
	var p TaskPayload
	if err := json.Unmarshal(b, &p); err != nil {
		return TaskPayload{}, err
	}
	// Ensure IDs match (override metadata just in case)
	p.JobID = job.ID
	p.PackageID = job.PackageID
	p.WorkspaceID = job.WorkspaceID
	return p, nil
}

// Helpers...
func resolveTemplateDir(packPath string) string {
	candidates := []string{
		filepath.Join(filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(packPath)))), "templates", "v1"),
		filepath.Join("templates", "v1"),
		filepath.Join("..", "templates", "v1"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "modul-ajar.html")); err == nil {
			return c
		}
	}
	return filepath.Join("templates", "v1")
}

func subjectName(pack *packloader.CurriculumPack, code string) string {
	for _, s := range pack.Subjects {
		if s.Code == code {
			return s.Name
		}
	}
	return code
}

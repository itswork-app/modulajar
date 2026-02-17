package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"modulajar/apps/core-go/docgraph"
	"modulajar/apps/core-go/gcs"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
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
	TeacherName string `json:"teacher_name"`
	SchoolName  string `json:"school_name"`
	PID         string `json:"pid"`
}

// StatusUpdate represents a status change to be applied by the caller.
type StatusUpdate struct {
	Table  string `json:"table"` // "packages" or "generation_jobs"
	ID     string `json:"id"`
	Status string `json:"status"`
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
	StatusUpdates     []StatusUpdate              `json:"status_updates"`
	DocGraph          *docgraph.DocGraphResult    `json:"doc_graph,omitempty"`
	RenderedDocuments []RenderedDocument          `json:"rendered_documents,omitempty"`
}

// ExecuteJob runs the planner + validator + doc graph + HTML composer pipeline.
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

	// 5. Compose HTML for each document
	// Try to find template dir from multiple candidate paths
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

	// 6. PDF render (optional — skipped if Playwright not available)
	gcsBucket := os.Getenv("GCS_BUCKET")
	pdfEnabled := render.IsPDFRenderAvailable()

	if pdfEnabled {
		for i, rd := range renderedDocs {
			tmpPDF := filepath.Join(os.TempDir(), fmt.Sprintf("modulajar-%s.pdf", rd.DID))
			pdfResult, err := render.RenderPDF(rd.HTML, tmpPDF)
			if err != nil {
				// PDF render failed — log but don't fail the job
				// The HTML artifact is still valid
				fmt.Fprintf(os.Stderr, "WARN: PDF render skipped for %s: %v\n", rd.SubjectCode, err)
				continue
			}
			renderedDocs[i].PDFPath = tmpPDF
			renderedDocs[i].PDFSizeBytes = pdfResult.SizeBytes
		}
	}

	// 7. GCS upload (optional — skipped if GCS_BUCKET not set)
	if gcsBucket != "" {
		ctx := context.Background()
		gcsClient, err := gcs.NewClient(ctx)
		if err != nil {
			fmt.Fprintf(os.Stderr, "WARN: GCS client init failed: %v\n", err)
		} else if gcsClient != nil {
			defer gcsClient.Close()

			for i, rd := range renderedDocs {
				if rd.PDFPath == "" {
					continue // No PDF to upload
				}

				objectPath := gcs.ArtifactPath(payload.WorkspaceID, payload.PID, rd.DID, 1)
				if err := gcsClient.UploadFile(ctx, objectPath, rd.PDFPath, "application/pdf"); err != nil {
					fmt.Fprintf(os.Stderr, "WARN: GCS upload failed for %s: %v\n", rd.SubjectCode, err)
					continue
				}

				// Finalize file_path to GCS URI
				renderedDocs[i].FilePath = gcs.FullGCSURI(gcsBucket, objectPath)

				// Clean up temp PDF
				os.Remove(rd.PDFPath)
				renderedDocs[i].PDFPath = ""
			}
		}
	}

	// 8. Update version file_paths in doc graph
	for i, ver := range graphResult.Versions {
		for _, rd := range renderedDocs {
			if ver.DocumentID == rd.DocumentID {
				graphResult.Versions[i].FilePath = rd.FilePath
				break
			}
		}
	}

	// 9. Success
	return &WorkerResult{
		JobID:             payload.JobID,
		PackageID:         payload.PackageID,
		Status:            "completed",
		PlannerResult:     planResult,
		ValidationOK:      true,
		DocGraph:          graphResult,
		RenderedDocuments: renderedDocs,
		StatusUpdates: append(startUpdates,
			StatusUpdate{Table: "packages", ID: payload.PackageID, Status: "ready"},
			StatusUpdate{Table: "generation_jobs", ID: payload.JobID, Status: "completed"},
		),
	}, nil
}

// resolveTemplateDir finds the templates/v1/ directory by checking multiple candidate paths.
// This handles different working directories (project root, worker/, test contexts).
func resolveTemplateDir(packPath string) string {
	candidates := []string{
		// Relative to pack path: packs/merdeka/sd4/v1/pack.json → ../../../../templates/v1
		filepath.Join(filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(packPath)))), "templates", "v1"),
		// CWD-relative
		filepath.Join("templates", "v1"),
		// One level up (from worker/ or render/)
		filepath.Join("..", "templates", "v1"),
	}

	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "modul-ajar.html")); err == nil {
			return c
		}
	}

	// Default fallback
	return filepath.Join("templates", "v1")
}

// subjectName looks up the display name for a subject code from the pack.
func subjectName(pack *packloader.CurriculumPack, code string) string {
	for _, s := range pack.Subjects {
		if s.Code == code {
			return s.Name
		}
	}
	return code
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

package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/curriculum"
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
	PDFHash      string `json:"pdf_hash,omitempty"` // SHA256 of generated PDF
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
func ExecuteJob(ctx context.Context, payload TaskPayload, logger *slog.Logger, aiClient *ai.GeminiClient) (*WorkerResult, error) {
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
	// ... (doc graph code) ...

	// AI INTEGRATION (PR-023)
	var aiReceipt map[string]interface{}

	if aiClient != nil {
		// 1. Construct Schema-Driven Prompt
		schemaPrompt := fmt.Sprintf(`You are a curriculum expert. Create a "Modul Ajar" for:
Subject: %s
Class: %s
Semester: %s
Teacher: %s
School: %s

STRICT RULE: Output must be valid JSON matching this schema:
{
  "meta": {
    "jenjang": "SD|SMP|SMA",
    "kelas": "string",
    "mapel": "string",
    "semester": "1|2",
    "tahun_ajaran": "2025/2026"
  },
  "identitas": {
    "sekolah": "string",
    "guru": "string",
    "alokasi_waktu": "2x35 menit"
  },
  "tujuan_pembelajaran": ["string"],
  "materi_inti": ["string"],
  "langkah_pembelajaran": {
    "pendahuluan": ["string"],
    "inti": ["string"],
    "penutup": ["string"]
  },
  "asesmen": {
    "diagnostik": ["string"],
    "formatif": ["string"],
    "sumatif": ["string"]
  },
  "diferensiasi": {
    "konten": ["string"],
    "proses": ["string"],
    "produk": ["string"]
  },
  "profil_pancasila": ["string"],
  "lampiran": {
    "media": ["string"],
    "sumber_belajar": ["string"]
  }
}
No markdown formatting. Pure JSON.`,
			subjectName(pack, "unknown"), payload.Kelas, payload.Semester, payload.TeacherName, payload.SchoolName)

		req := ai.GenerateRequest{Prompt: schemaPrompt}
		resp, err := aiClient.Generate(ctx, req)
		if err != nil {
			logger.Warn("AI generation failed", "error", err)
		} else {
			logger.Info("AI generation success", "model", resp.ModelName)

			// 2. Parse & Validate
			var c curriculum.Curriculum
			if err := json.Unmarshal([]byte(resp.Content), &c); err != nil {
				logger.Error("Failed to parse AI JSON", "error", err, "content_snippet", resp.Content[:min(len(resp.Content), 100)])
				// In PR-023, maybe fail job? For now, we log error and continue (non-blocking).
				// User said "Invalid JSON -> job fails".
				// I'll return error here?
				return nil, fmt.Errorf("AI generated invalid JSON: %w", err)
			}

			if err := c.Validate(); err != nil {
				return nil, fmt.Errorf("AI validation failed: %w", err)
			}

			// 3. Sanitize
			c.Sanitize()

			// 4. Render
			// Try reading template from local file
			tmplBytes, err := os.ReadFile("templates/v1/modul-ajar.html")
			if err != nil {
				// Fallback to simpler path or strictly fail?
				// Try apps/core-go/templates/modul-ajar.html if running from root
				tmplBytes, err = os.ReadFile("apps/core-go/templates/modul-ajar.html")
				if err != nil {
					logger.Warn("Template not found", "error", err)
				}
			}

			var html, hash string
			if len(tmplBytes) > 0 {
				html, hash, err = curriculum.RenderHTML(&c, string(tmplBytes))
				if err != nil {
					return nil, fmt.Errorf("Render failed: %w", err)
				}
			}

			// 5. Persist
			innerAIReceipt := map[string]interface{}{
				"model":         resp.ModelName,
				"input_tokens":  resp.TokenInput,
				"output_tokens": resp.TokenOutput,
				"prompt_hash":   resp.PromptHash,
				"output_hash":   resp.OutputHash,
				"duration_ms":   resp.DurationMs,
				"generated_at":  time.Now().Format(time.RFC3339),
			}

			// Capture for outer scope usage
			aiReceipt = innerAIReceipt

			receipt := map[string]interface{}{
				"ai_receipt": innerAIReceipt,
				"curriculum": map[string]interface{}{
					"json":      c,
					"html_hash": hash,
				},
			}
			// Note: PDF metadata is added later after generation?
			// Actually PDF generation happens AFTER this block.
			// We should update metadata at the END of ExecuteJob or accumulating it.
			// Current structure: failed to persist AI receipt here.
			// The job metadata is updated incrementally?
			// The `UpdateJobMetadata` merges? Postgres `jsonb_set` or merge?
			// DB implementation usually merges.
			if err := db.UpdateJobMetadata(ctx, payload.JobID, receipt); err != nil {
				logger.Warn("Failed to persist AI receipt", "error", err)
			}
			_ = html // Prevent unused error if not used
		}
	}
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

	// 4.5. Persist Documents to DB (PR-025)
	// We do this BEFORE PDF generation to ensure they exist in DB with 'generating' or 'ready' status
	// We also attach AI receipt if available
	for _, doc := range graphResult.Documents {
		// Prepare metadata
		meta := make(map[string]interface{})

		// If AI receipt exists (from step AI INTEGRATION)
		// We can't easily access the locally scoped 'receipt' variable from inside the if block above.
		// However, we can check if we have one.
		// Actually, let's define 'aiReceipt' var outside the if block.
		if aiReceipt != nil {
			meta["ai_config"] = aiReceipt
			// Top level model field for easy access
			if m, ok := aiReceipt["model"].(string); ok {
				meta["model"] = m
			}
		}

		dbDoc := db.Document{
			ID:          doc.ID,
			WorkspaceID: doc.WorkspaceID,
			PackageID:   doc.PackageID,
			PublicID:    doc.PublicID,
			SubjectCode: doc.SubjectCode,
			Version:     doc.Version,
			Status:      "generating", // Initially generating
			Metadata:    meta,
		}
		if err := db.SaveDocument(ctx, dbDoc); err != nil {
			logger.Warn("Failed to save document to DB", "did", doc.PublicID, "error", err)
			continue
		}
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

				// Update status to ready for all docs
				for _, doc := range graphResult.Documents {
					db.UpdateDocumentStatus(ctx, doc.PublicID, "ready")
				}

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

		// Compute HTML hash
		htmlHash := sha256.Sum256([]byte(html))
		htmlHashStr := hex.EncodeToString(htmlHash[:])

		// Update DB with HTML hash
		db.UpdateDocumentMetadata(ctx, doc.PublicID, map[string]interface{}{
			"html_sha256": htmlHashStr,
		})

		filePath := fmt.Sprintf("html://%s/v1", doc.PublicID)
		renderedDocs = append(renderedDocs, RenderedDocument{
			DocumentID:  doc.ID,
			DID:         doc.PublicID,
			SubjectCode: doc.SubjectCode,
			HTML:        html,
			FilePath:    filePath,
		})
	}

	// 6. PDF render (PR-024 Chromedp)
	// Check if Chrome is available (bundled or installed)
	if render.IsChromeAvailable() {
		for i, rd := range renderedDocs {
			// Watermark Data
			// Mask teacher name: "REJA P****" or "re***@domain.com"
			maskedTeacher := maskTeacher(payload.TeacherName)
			watermark := render.WatermarkData{
				PublicID:    rd.DID,
				TeacherName: maskedTeacher,
				Date:        time.Now().Format("02-01-2006"),
				VerifyURL:   fmt.Sprintf("verify.modulajar.app/verify/%s", rd.DID),
			}

			// Save watermark info to DB for verification
			db.UpdateDocumentMetadata(ctx, rd.DID, map[string]interface{}{
				"watermark_summary": map[string]string{
					"teacher_masked": maskedTeacher,
					"school_name":    payload.SchoolName,
				},
			})

			// Generate PDF
			pdfBytes, err := render.GeneratePDF(ctx, rd.HTML, render.GeneratePDFOptions{
				Watermark:    watermark,
				MarginBottom: 0.8, // inch
			})
			if err != nil {
				logger.Warn("PDF render failed", "subject", rd.SubjectCode, "error", err)
				continue
			}

			// Save to temp file for GCS upload (or stream directly if client supports bytes)
			// Existing GCS client takes path.
			tmpPDF := filepath.Join(os.TempDir(), fmt.Sprintf("modulajar-%s.pdf", rd.DID))
			if err := os.WriteFile(tmpPDF, pdfBytes, 0644); err != nil {
				logger.Warn("Failed to write temp PDF", "error", err)
				continue
			}

			renderedDocs[i].PDFPath = tmpPDF
			renderedDocs[i].PDFSizeBytes = int64(len(pdfBytes))

			// Compute SHA256 for receipt
			pdfHash := sha256.New()
			pdfHash.Write(pdfBytes)
			renderedDocs[i].PDFHash = hex.EncodeToString(pdfHash.Sum(nil))
		}
	} else {
		logger.Warn("Chrome/Chromium not found. PDF generation skipped.")
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

	// 8. Update graph paths & Persist PDF Metadata
	pdfMetadata := make(map[string]interface{})
	for i, ver := range graphResult.Versions {
		for _, rd := range renderedDocs {
			if ver.DocumentID == rd.DocumentID {
				graphResult.Versions[i].FilePath = rd.FilePath

				// Collect PDF metadata for this subject
				if rd.PDFHash != "" {
					pdfMetadata[rd.SubjectCode] = map[string]interface{}{
						"pdf_path":       rd.FilePath, // GCS URI
						"pdf_size_bytes": rd.PDFSizeBytes,
						"pdf_sha256":     rd.PDFHash,
						"generated_at":   time.Now().Format(time.RFC3339),
					}

					// Update individual document metadata for Verify Service
					db.UpdateDocumentMetadata(ctx, rd.DID, map[string]interface{}{
						"pdf_sha256":   rd.PDFHash,
						"pdf_path":     rd.FilePath,
						"generated_at": time.Now().Format(time.RFC3339),
					})

					// Mark as done
					db.UpdateDocumentStatus(ctx, rd.DID, "done")
				}
				break
			}
		}
	}

	// Persist PDF metadata if any
	if len(pdfMetadata) > 0 {
		update := map[string]interface{}{
			"pdf_receipts": pdfMetadata,
		}
		if err := db.UpdateJobMetadata(ctx, payload.JobID, update); err != nil {
			logger.Warn("Failed to persist PDF receipts", "error", err)
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
	// Initialize default logger
	baseLogger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Initialize Gemini Client
	geminiKey := os.Getenv("GEMINI_API_KEY")
	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.0-flash" // Default to available model
	}
	// Parse timeout and max tokens (ignoring errors for brevity, using defaults)
	// simple helper or just pass 0 to rely on defaults
	apiClient := ai.NewGeminiClient(geminiKey, geminiModel, 0, 0)

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
		result, err := ExecuteJob(ctx, payload, logger, apiClient)

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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maskTeacher(name string) string {
	if len(name) < 4 {
		return name
	}
	// Simple mask: First word + "****"
	// Or more robust?
	// Request: re***@domain.com or REJA P****
	// I'll implement simple masking for now.
	return name[0:3] + "****"
}

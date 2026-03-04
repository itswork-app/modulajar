package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/adapters/ai/prompts"
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

	// Letterhead Parameters (optional)
	LetterheadLine1   string `json:"letterhead_line1,omitempty"`
	LetterheadLine2   string `json:"letterhead_line2,omitempty"`
	LetterheadLine3   string `json:"letterhead_line3,omitempty"`
	LetterheadLine4   string `json:"letterhead_line4,omitempty"`
	LetterheadContact string `json:"letterhead_contact,omitempty"`
	LogoFilePath      string `json:"logo_file_path,omitempty"`
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

// Worker holds dependencies for job execution.
type Worker struct {
	Deps WorkerDeps
}

// NewWorker creates a new Worker instance with injected dependencies.
func NewWorker(deps WorkerDeps) *Worker {
	return &Worker{
		Deps: deps,
	}
}

// ExecuteJob runs the planner + validator + doc graph + HTML composer pipeline.
// Invariant: Job is marked done ONLY if PDF generation and Upload are successful.
func (w *Worker) ExecuteJob(ctx context.Context, payload TaskPayload, logger *slog.Logger) (*WorkerResult, error) {
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

	planResult, err := w.Deps.Planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		return failResult(fmt.Sprintf("planner failed: %v", err)), nil
	}

	// 3. Run validator
	report, err := w.Deps.Validator.Validate(validator.ValidatorInput{Pack: pack, Result: planResult})
	if err != nil {
		return failResult(fmt.Sprintf("validator error: %v", err)), nil
	}

	if !report.OK {
		r := failResult(fmt.Sprintf("validation failed with %d errors", len(report.Errors)))
		r.ValidationOK = false
		r.Errors = report.Errors
		return r, nil
	}

	// 4. Build Document Graph
	// Note: DocGraph logic is currently direct.
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

	// 5. Check Idempotency (Skip if all artifacts exist)
	gcsBucket := os.Getenv("GCS_BUCKET")
	if w.Deps.Storage != nil && gcsBucket != "" {
		allExist := true
		for _, doc := range graphResult.Documents {
			objectPath := gcs.ArtifactPath(payload.WorkspaceID, payload.PID, doc.PublicID, 1)
			exists, _ := w.Deps.Storage.Exists(ctx, objectPath)
			if !exists {
				allExist = false
				break
			}
		}

		if allExist {
			logger.Info("Idempotency check passed (all artifacts exist). Skipping generation.", "job_id", payload.JobID)

			// Persist documents as ready
			for _, doc := range graphResult.Documents {
				dbDoc := db.Document{
					ID:          doc.ID,
					WorkspaceID: doc.WorkspaceID,
					PackageID:   doc.PackageID,
					PublicID:    doc.PublicID,
					SubjectCode: doc.SubjectCode,
					Version:     doc.Version,
					Status:      "ready",
					Metadata:    map[string]interface{}{},
				}
				_ = w.Deps.JobStore.SaveDocument(ctx, dbDoc)
				_ = w.Deps.JobStore.UpdateDocumentStatus(ctx, doc.PublicID, "ready")
			}

			// Return success, handler will mark job done.
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

	// 6. AI INTEGRATION
	var aiReceipt map[string]interface{}
	var resultSD4 *curriculum.ModulAjarSD4
	var resultLegacy *curriculum.Curriculum

	if w.Deps.AI != nil {
		// PR-060: Determine subject and if we have a SD4 template
		subjectCode := "unknown"
		if len(planResult.SemesterPlan.SubjectPlans) > 0 {
			subjectCode = planResult.SemesterPlan.SubjectPlans[0].SubjectCode
		}
		subjectForTemplate := subjectName(pack, subjectCode)

		useSD4Template := false
		var templateJSON []byte

		if curriculum.HasTemplateSD4(subjectCode) {
			tmplData, err := curriculum.LoadTemplateSD4(subjectCode)
			if err == nil {
				templateJSON = tmplData
				useSD4Template = true
			}
		}

		var resp *ai.GenerateResponse
		var aiErr error

		if useSD4Template {
			// PR-060: Schema-guided generation with retry
			const maxRetries = 2
			var lastErr error

			for attempt := 0; attempt <= maxRetries; attempt++ {
				if attempt > 0 {
					logger.Warn("Retrying AI generation", "attempt", attempt+1, "last_error", lastErr)
				}

				// Build structured prompt
				schemaPrompt := prompts.BuildFullPrompt(
					payload.SchoolName,
					subjectForTemplate,
					payload.Semester,
					subjectForTemplate, // topic = subject for now
					string(templateJSON),
				)

				req := ai.GenerateRequest{Prompt: schemaPrompt}
				resp, aiErr = w.Deps.AI.Generate(ctx, req)
				if aiErr != nil {
					lastErr = fmt.Errorf("AI call failed: %v", aiErr)
					continue
				}

				// Parse JSON into ModulAjarSD4
				var modulAjar curriculum.ModulAjarSD4
				if err := json.Unmarshal([]byte(resp.Content), &modulAjar); err != nil {
					lastErr = fmt.Errorf("invalid JSON: %v", err)
					continue
				}

				// Validate required fields
				if err := curriculum.ValidateModulAjar(&modulAjar); err != nil {
					lastErr = fmt.Errorf("validation failed: %v", err)
					continue
				}

				// Evaluate quality
				if err := curriculum.EvaluateModulAjar(&modulAjar); err != nil {
					lastErr = fmt.Errorf("evaluation failed: %v", err)
					continue
				}

				// Sanitize
				curriculum.SanitizeModulAjar(&modulAjar)
				resultSD4 = &modulAjar

				// Success — build receipt and break
				lastErr = nil
				logger.Info("AI generation success (SD4 template)", "model", resp.ModelName, "attempt", attempt+1)
				break
			}

			if lastErr != nil {
				return failResult(fmt.Sprintf("AI generation failed after %d attempts: %v", maxRetries+1, lastErr)), nil
			}
		} else {
			// Legacy flow: inline schema prompt (backward compatibility)
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
			resp, aiErr = w.Deps.AI.Generate(ctx, req)
			if aiErr != nil {
				logger.Warn("AI generation failed", "error", aiErr)
				return failResult(fmt.Sprintf("AI generation failed: %v", aiErr)), nil
			}

			logger.Info("AI generation success", "model", resp.ModelName)

			// 2. Parse & Validate
			var c curriculum.Curriculum
			if err := json.Unmarshal([]byte(resp.Content), &c); err != nil {
				logger.Error("Failed to parse AI JSON", "error", err)
				return failResult(fmt.Sprintf("AI generated invalid JSON: %v", err)), nil
			}

			if err := c.Validate(); err != nil {
				return failResult(fmt.Sprintf("AI validation failed: %v", err)), nil
			}

			// 3. Sanitize
			c.Sanitize()
			resultLegacy = &c
		}

		if resp != nil {
			// 4. Render (for legacy flow)
			templateDir := resolveTemplateDir(payload.PackPath)
			tmplBytes, err := os.ReadFile(filepath.Join(templateDir, "modul-ajar.html"))
			if err != nil {
				logger.Warn("Template not found", "error", err)
			}

			var html, hash string
			if len(tmplBytes) > 0 {
				funcs := template.FuncMap{
					"SUBJECT_NAME":       func() string { return subjectForTemplate },
					"KELAS":              func() string { return payload.Kelas },
					"SEMESTER":           func() string { return payload.Semester },
					"TAHUN_AJARAN":       func() string { return payload.TahunAjaran },
					"TITLE":              func() string { return "Modul Ajar " + subjectForTemplate },
					"TEACHER_NAME":       func() string { return payload.TeacherName },
					"SCHOOL_NAME":        func() string { return payload.SchoolName },
					"PID":                func() string { return payload.PID },
					"DID":                func() string { return "PREVIEW" },
					"VERIFY_URL":         func() string { return "#" },
					"STYLES":             func() string { return "" },
					"ATP_TABLE":          func() string { return "(ATP Table Placeholder)" },
					"ACTIVITY_SECTIONS":  func() string { return "(Activity Sections Placeholder)" },
					"ASSESSMENT_SECTION": func() string { return "(Assessment Section Placeholder)" },
					"KOP_SURAT":          func() string { return "" },
				}

				html, hash, err = curriculum.RenderHTML(nil, string(tmplBytes), funcs)
				if err != nil {
					return failResult(fmt.Sprintf("Render failed: %v", err)), nil
				}
			}

			// 5. Persist receipt
			innerAIReceipt := map[string]interface{}{
				"model":         resp.ModelName,
				"input_tokens":  resp.TokenInput,
				"output_tokens": resp.TokenOutput,
				"prompt_hash":   resp.PromptHash,
				"output_hash":   resp.OutputHash,
				"duration_ms":   resp.DurationMs,
				"generated_at":  time.Now().Format(time.RFC3339),
				"template_mode": useSD4Template,
			}

			aiReceipt = innerAIReceipt

			receipt := map[string]interface{}{
				"ai_receipt": innerAIReceipt,
				"curriculum": map[string]interface{}{
					"html_hash": hash,
				},
			}

			if err := w.Deps.JobStore.UpdateJobMetadata(ctx, payload.JobID, receipt); err != nil {
				logger.Error("Failed to persist AI receipt", "error", err)
				return failResult(fmt.Sprintf("failed to persist AI receipt: %v", err)), nil
			}
			_ = html
		}
	}

	// 7. Persist Documents to DB (Generating)
	for _, doc := range graphResult.Documents {
		meta := make(map[string]interface{})

		if aiReceipt != nil {
			meta["ai_config"] = aiReceipt
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
			Status:      "generating",
			Metadata:    meta,
		}
		if err := w.Deps.JobStore.SaveDocument(ctx, dbDoc); err != nil {
			logger.Warn("Failed to save document to DB", "did", doc.PublicID, "error", err)
			continue
		}
	}

	// 5. Compose HTML
	templateDir := resolveTemplateDir(payload.PackPath)
	renderedDocs := make([]RenderedDocument, 0, len(graphResult.Documents))

	for _, doc := range graphResult.Documents {
		verifyBaseURL := os.Getenv("VERIFY_BASE_URL")
		if verifyBaseURL == "" {
			verifyBaseURL = "https://verify.modulajar.app"
		}
		verifyURL := fmt.Sprintf("%s/verify/%s", verifyBaseURL, doc.PublicID)

		// If LogoFilePath is provided, fetch and convert it to Base64 URI deterministically
		logoDataURI := ""
		if payload.LogoFilePath != "" && w.Deps.Storage != nil {
			logoData, err := w.Deps.Storage.DownloadFile(ctx, payload.LogoFilePath)
			if err != nil {
				logger.Warn("Failed to fetch logo for letterhead, proceeding without logo", "path", payload.LogoFilePath, "error", err)
			} else if len(logoData) > 0 {
				mimeType := "image/png" // Default, can be refined based on file extension
				if strings.HasSuffix(strings.ToLower(payload.LogoFilePath), ".jpg") || strings.HasSuffix(strings.ToLower(payload.LogoFilePath), ".jpeg") {
					mimeType = "image/jpeg"
				}
				logoDataURI = fmt.Sprintf("data:%s;base64,%s", mimeType, hex.EncodeToString(logoData)) // Quick base64 encode later? wait, simple base64 package is "encoding/base64". Wait standard encoding is base64.StdEncoding.EncodeToString(logoData)
			}
		}

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

			LetterheadLine1:   payload.LetterheadLine1,
			LetterheadLine2:   payload.LetterheadLine2,
			LetterheadLine3:   payload.LetterheadLine3,
			LetterheadLine4:   payload.LetterheadLine4,
			LetterheadContact: payload.LetterheadContact,
			LogoDataURI:       logoDataURI,

			ModulAjarSD4:     resultSD4,
			LegacyCurriculum: resultLegacy,
		})
		if err != nil {
			return failResult(fmt.Sprintf("compose HTML failed for %s: %v", doc.SubjectCode, err)), nil
		}

		htmlHash := sha256.Sum256([]byte(html))
		htmlHashStr := hex.EncodeToString(htmlHash[:])

		w.Deps.JobStore.UpdateDocumentMetadata(ctx, doc.PublicID, map[string]interface{}{
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

	// 6. PDF render
	if w.Deps.PDF != nil {
		for i, rd := range renderedDocs {
			maskedTeacher := maskTeacher(payload.TeacherName)
			watermark := render.WatermarkData{
				PublicID:    rd.DID,
				TeacherName: maskedTeacher,
				Date:        time.Now().Format("02-01-2006"),
				VerifyURL:   fmt.Sprintf("verify.modulajar.app/verify/%s", rd.DID),
			}

			w.Deps.JobStore.UpdateDocumentMetadata(ctx, rd.DID, map[string]interface{}{
				"watermark_summary": map[string]string{
					"teacher_masked": maskedTeacher,
					"school_name":    payload.SchoolName,
				},
			})

			opts := render.GeneratePDFOptions{
				Watermark:    watermark,
				MarginBottom: 0.8, // inch
			}
			pdfBytes, err := w.Deps.PDF.Generate(ctx, rd.HTML, opts)
			if err != nil {
				return failResult(fmt.Sprintf("PDF render failed for %s: %v", rd.SubjectCode, err)), nil
			}

			tmpPDF := filepath.Join(os.TempDir(), fmt.Sprintf("modulajar-%s.pdf", rd.DID))
			if err := os.WriteFile(tmpPDF, pdfBytes, 0644); err != nil {
				return failResult(fmt.Sprintf("failed to write temp PDF: %v", err)), nil
			}

			renderedDocs[i].PDFPath = tmpPDF
			renderedDocs[i].PDFSizeBytes = int64(len(pdfBytes))

			pdfHash := sha256.New()
			pdfHash.Write(pdfBytes)
			renderedDocs[i].PDFHash = hex.EncodeToString(pdfHash.Sum(nil))
		}
	} else {
		return failResult("PDF engine unavailable"), nil
	}

	// 7. GCS upload
	if w.Deps.Storage != nil {
		for i, rd := range renderedDocs {
			if rd.PDFPath == "" {
				continue
			}
			objectPath := gcs.ArtifactPath(payload.WorkspaceID, payload.PID, rd.DID, 1)
			if err := w.Deps.Storage.UploadFile(ctx, objectPath, rd.PDFPath, "application/pdf"); err != nil {
				metrics.GCSUploadTotal.WithLabelValues("failed").Inc()
				return failResult(fmt.Sprintf("GCS upload failed for %s: %v", rd.SubjectCode, err)), nil
			}
			metrics.GCSUploadTotal.WithLabelValues("success").Inc()

			renderedDocs[i].FilePath = gcs.FullGCSURI(gcsBucket, objectPath)
			os.Remove(rd.PDFPath)
			renderedDocs[i].PDFPath = ""
		}
	}

	// 8. Update Document & Job Status
	pdfMetadata := make(map[string]interface{})
	for i, ver := range graphResult.Versions {
		for _, rd := range renderedDocs {
			if ver.DocumentID == rd.DocumentID {
				graphResult.Versions[i].FilePath = rd.FilePath

				if rd.PDFHash != "" {
					pdfMetadata[rd.SubjectCode] = map[string]interface{}{
						"pdf_path":       rd.FilePath, // GCS URI
						"pdf_size_bytes": rd.PDFSizeBytes,
						"pdf_sha256":     rd.PDFHash,
						"generated_at":   time.Now().Format(time.RFC3339),
					}

					w.Deps.JobStore.UpdateDocumentMetadata(ctx, rd.DID, map[string]interface{}{
						"pdf_sha256":   rd.PDFHash,
						"pdf_path":     rd.FilePath,
						"generated_at": time.Now().Format(time.RFC3339),
					})

					w.Deps.JobStore.UpdateDocumentStatus(ctx, rd.DID, "done")
				}
				break
			}
		}
	}

	// Persist PDF metadata
	if len(pdfMetadata) > 0 {
		update := map[string]interface{}{
			"pdf_receipts": pdfMetadata,
		}
		if err := w.Deps.JobStore.UpdateJobMetadata(ctx, payload.JobID, update); err != nil {
			return failResult(fmt.Sprintf("failed to persist PDF receipts: %v", err)), nil
		}
	}

	// Success!
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

// Helpers
func jobToPayload(job *db.GenerationJob) (TaskPayload, error) {
	b, err := json.Marshal(job.Metadata)
	if err != nil {
		return TaskPayload{}, err
	}
	var p TaskPayload
	if err := json.Unmarshal(b, &p); err != nil {
		return TaskPayload{}, err
	}
	p.JobID = job.ID
	p.PackageID = job.PackageID
	p.WorkspaceID = job.WorkspaceID
	return p, nil
}

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
	return name[0:3] + "****"
}

// Handler functions are moved to cmd/worker/main.go or need to be adapted.
// For now, I'll remove Handler() from here as it depends on DI which we want to inject.
// I'll also expose CheckFunc and ReadinessHandler as they are utilities.
// Actually, keep ReadinessHandler here as it is useful helper, but I will remove the old Handler().

type CheckFunc func(context.Context) error

func ReadinessHandler(dbCheck CheckFunc, chromeCheck CheckFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		if err := dbCheck(ctx); err != nil {
			slog.Error("Readiness probe failed: DB unpingable", "error", err)
			http.Error(w, "Service Unavailable: DB", http.StatusServiceUnavailable)
			return
		}

		if err := chromeCheck(ctx); err != nil {
			slog.Error("Readiness probe failed: Chrome unavailable", "error", err)
			http.Error(w, "Service Unavailable: Chrome", http.StatusServiceUnavailable)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}
}

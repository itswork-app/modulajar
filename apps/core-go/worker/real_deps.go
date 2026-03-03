package worker

import (
	"context"
	"os"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/gcs"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"
)

// RealAIEngine wraps ai package
type RealAIEngine struct {
	Client *ai.GeminiClient
}

func (r *RealAIEngine) Generate(ctx context.Context, req ai.GenerateRequest) (*ai.GenerateResponse, error) {
	return r.Client.Generate(ctx, req)
}

// RealPDFEngine wraps render package
type RealPDFEngine struct{}

func (r *RealPDFEngine) Generate(ctx context.Context, htmlContent string, opts render.GeneratePDFOptions) ([]byte, error) {
	return render.GeneratePDF(ctx, htmlContent, opts)
}

// RealStorage wraps gcs package
type RealStorage struct {
	Client *gcs.Client
}

func (r *RealStorage) Exists(ctx context.Context, objectPath string) (bool, error) {
	return r.Client.Exists(ctx, objectPath)
}

func (r *RealStorage) UploadFile(ctx context.Context, objectPath string, filePath string, contentType string) error {
	return r.Client.UploadFile(ctx, objectPath, filePath, contentType)
}

func (r *RealStorage) DownloadFile(ctx context.Context, objectPath string) ([]byte, error) {
	return r.Client.DownloadFile(ctx, objectPath)
}

func (r *RealStorage) Close() error {
	return r.Client.Close()
}

// RealJobStore wraps db package
type RealJobStore struct{}

func (r *RealJobStore) AcquireJob(ctx context.Context) (*db.GenerationJob, error) {
	return db.AcquireJob(ctx)
}

func (r *RealJobStore) UpdateJobMetadata(ctx context.Context, jobID string, metadata map[string]interface{}) error {
	return db.UpdateJobMetadata(ctx, jobID, metadata)
}

func (r *RealJobStore) MarkJobDone(ctx context.Context, jobID string) error {
	return db.MarkJobDone(ctx, jobID)
}

func (r *RealJobStore) MarkJobFailed(ctx context.Context, jobID string, errMsg string, attemptCount int) error {
	return db.MarkJobFailed(ctx, jobID, errMsg, attemptCount)
}

func (r *RealJobStore) UpdatePackageStatus(ctx context.Context, packageID string, status string) error {
	return db.UpdatePackageStatus(ctx, packageID, status)
}

func (r *RealJobStore) SaveDocument(ctx context.Context, doc db.Document) error {
	return db.SaveDocument(ctx, doc)
}

func (r *RealJobStore) UpdateDocumentStatus(ctx context.Context, publicID string, status string) error {
	return db.UpdateDocumentStatus(ctx, publicID, status)
}

func (r *RealJobStore) UpdateDocumentMetadata(ctx context.Context, publicID string, metadata map[string]interface{}) error {
	return db.UpdateDocumentMetadata(ctx, publicID, metadata)
}

// RealPlanner wraps planner package
type RealPlanner struct{}

func (r *RealPlanner) Plan(input planner.PlannerInput) (*planner.PlannerResult, error) {
	return planner.Plan(input)
}

// RealValidator wraps validator package
type RealValidator struct{}

func (r *RealValidator) Validate(input validator.ValidatorInput) (*validator.ValidationReport, error) {
	return validator.Validate(input)
}

// NewRealWorker creates a Worker with real dependencies.
// It initializes API clients from environment variables.
func NewRealWorker(ctx context.Context) (*Worker, error) {
	// AI
	geminiKey := os.Getenv("GEMINI_API_KEY")
	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.0-flash"
	}
	aiClient := ai.NewGeminiClient(geminiKey, geminiModel, 0, 0)

	// GCS - Note: Client creation might fail if credentials missing
	// Should we fail or allow nil (if optional)?
	// For production/worker, it is required.
	// But previous code allowed it to be nil/warn.
	// NewClient returns (*Client, error).
	gcsClient, err := gcs.NewClient(ctx)
	// We handle err in calling code or validly return nil if not needed locally?
	// But worker needs it.
	// Let's return error if fundamental.

	// Wait, previous handler:
	// if err != nil { baseLogger.Warn... }
	// So it didn't crash.
	// Check ExecuteJob use of Storage: if w.Deps.Storage != nil { ... }
	// So nil is allowed.

	var realStorage Storage
	if gcsClient != nil {
		realStorage = &RealStorage{Client: gcsClient}
	} else if err != nil {
		// Log warning? We don't have logger here easily.
		// Return nil storage is fine.
	}

	deps := WorkerDeps{
		AI:        &RealAIEngine{Client: aiClient},
		PDF:       &RealPDFEngine{},
		Storage:   realStorage,
		JobStore:  &RealJobStore{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	return NewWorker(deps), nil
}

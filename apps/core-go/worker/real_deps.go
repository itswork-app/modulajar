package worker

import (
	"context"
	"fmt"
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
	Engine AIEngine
}

func (r *RealAIEngine) Generate(ctx context.Context, req ai.GenerateRequest) (*ai.GenerateResponse, error) {
	return r.Engine.Generate(ctx, req)
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

func (r *RealJobStore) UpdateJobMetadata(ctx context.Context, workspaceID string, jobID string, metadata map[string]interface{}) error {
	return db.UpdateJobMetadata(ctx, workspaceID, jobID, metadata)
}

func (r *RealJobStore) MarkJobDone(ctx context.Context, workspaceID string, jobID string) error {
	return db.MarkJobDone(ctx, workspaceID, jobID)
}

func (r *RealJobStore) MarkJobFailed(ctx context.Context, workspaceID string, jobID string, errMsg string, attemptCount int) error {
	return db.MarkJobFailed(ctx, workspaceID, jobID, errMsg, attemptCount)
}

func (r *RealJobStore) UpdatePackageStatus(ctx context.Context, workspaceID string, packageID string, status string) error {
	return db.UpdatePackageStatus(ctx, workspaceID, packageID, status)
}

func (r *RealJobStore) SaveDocument(ctx context.Context, doc db.Document) error {
	return db.SaveDocument(ctx, doc)
}

func (r *RealJobStore) UpdateDocumentStatus(ctx context.Context, workspaceID string, publicID string, status string) error {
	return db.UpdateDocumentStatus(ctx, workspaceID, publicID, status)
}

func (r *RealJobStore) UpdateDocumentMetadata(ctx context.Context, workspaceID string, publicID string, metadata map[string]interface{}) error {
	return db.UpdateDocumentMetadata(ctx, workspaceID, publicID, metadata)
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
// Priority: Claude (primary) → OpenAI (fallback) → Gemini (last resort)
func NewRealWorker(ctx context.Context) (*Worker, error) {
	claudeKey := os.Getenv("ANTHROPIC_API_KEY")
	openAIKey := os.Getenv("OPENAI_API_KEY")
	geminiKey := os.Getenv("GEMINI_API_KEY")

	var clients []ai.Client

	// Claude — primary, terbaik untuk konten panjang modul ajar
	if claudeKey != "" {
		model := os.Getenv("CLAUDE_MODEL")
		if model == "" {
			model = "claude-sonnet-4-5"
		}
		clients = append(clients, ai.NewClaudeClient(claudeKey, model, 0, 0))
	}

	// OpenAI — fallback pertama
	if openAIKey != "" {
		model := os.Getenv("OPENAI_MODEL")
		if model == "" {
			model = "gpt-4o"
		}
		clients = append(clients, ai.NewOpenAIClient(openAIKey, model, 0, 0))
	}

	// Gemini — last resort
	if geminiKey != "" {
		model := os.Getenv("GEMINI_MODEL")
		if model == "" {
			model = "gemini-2.0-flash"
		}
		clients = append(clients, ai.NewGeminiClient(geminiKey, model, 0, 0))
	}

	if len(clients) == 0 {
		return nil, fmt.Errorf("no AI provider configured — set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY")
	}

	// Build fallback chain: A → B → C
	var aiEngine ai.Client = clients[0]
	for i := 1; i < len(clients); i++ {
		aiEngine = ai.NewFallbackClient(aiEngine, clients[i], nil)
	}

	// GCS Storage
	var realStorage Storage
	if gcsClient, err := gcs.NewClient(ctx); err == nil && gcsClient != nil {
		realStorage = &RealStorage{Client: gcsClient}
	}

	deps := WorkerDeps{
		AI:        &RealAIEngine{Engine: aiEngine},
		PDF:       &RealPDFEngine{},
		Storage:   realStorage,
		JobStore:  &RealJobStore{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	return NewWorker(deps), nil
}

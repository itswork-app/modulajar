package worker

import (
	"context"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"
)

// AIEngine abstracts the AI generation logic.
type AIEngine interface {
	Generate(ctx context.Context, req ai.GenerateRequest) (*ai.GenerateResponse, error)
}

// PDFEngine abstracts the PDF generation logic.
type PDFEngine interface {
	Generate(ctx context.Context, htmlContent string, opts render.GeneratePDFOptions) ([]byte, error)
}

// Storage abstracts file storage (GCS).
type Storage interface {
	Exists(ctx context.Context, objectPath string) (bool, error)
	UploadFile(ctx context.Context, objectPath string, filePath string, contentType string) error
	DownloadFile(ctx context.Context, objectPath string) ([]byte, error)
	Close() error
}

// JobStore abstracts database operations for jobs and documents.
type JobStore interface {
	AcquireJob(ctx context.Context) (*db.GenerationJob, error)
	UpdateJobMetadata(ctx context.Context, jobID string, metadata map[string]interface{}) error
	MarkJobDone(ctx context.Context, jobID string) error
	MarkJobFailed(ctx context.Context, jobID string, errMsg string, attemptCount int) error

	UpdatePackageStatus(ctx context.Context, packageID string, status string) error

	SaveDocument(ctx context.Context, doc db.Document) error
	UpdateDocumentStatus(ctx context.Context, publicID string, status string) error
	UpdateDocumentMetadata(ctx context.Context, publicID string, metadata map[string]interface{}) error
}

// Planner abstracts the planning logic
type Planner interface {
	Plan(input planner.PlannerInput) (*planner.PlannerResult, error)
}

// Validator abstracts the validation logic
type Validator interface {
	Validate(input validator.ValidatorInput) (*validator.ValidationReport, error)
}

// WorkerDeps holds all dependencies required by the Worker.
type WorkerDeps struct {
	AI        AIEngine
	PDF       PDFEngine
	Storage   Storage // Optional (can be nil)
	JobStore  JobStore
	Planner   Planner
	Validator Validator
}

package worker

import (
	"context"
	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"
	"os"
	"testing"
)

func TestNewRealWorker(t *testing.T) {
	os.Setenv("GEMINI_API_KEY", "test-key")
	os.Setenv("GCS_BUCKET", "test-bucket")

	ctx := context.Background()
	w, err := NewRealWorker(ctx)
	if err != nil {
		t.Fatalf("NewRealWorker failed: %v", err)
	}

	if w == nil {
		t.Fatal("Expected worker, got nil")
	}
}

func TestRealDepsWrappers(t *testing.T) {
	tryPanic := func(fn func()) {
		defer func() { recover() }()
		fn()
	}

	pdf := &RealPDFEngine{}
	tryPanic(func() { pdf.Generate(context.Background(), "html", render.GeneratePDFOptions{}) })

	plannerObj := &RealPlanner{}
	tryPanic(func() { plannerObj.Plan(planner.PlannerInput{}) })

	val := &RealValidator{}
	tryPanic(func() { val.Validate(validator.ValidatorInput{}) })

	aiEng := &RealAIEngine{}
	tryPanic(func() { aiEng.Generate(context.Background(), ai.GenerateRequest{}) })

	storage := &RealStorage{}
	tryPanic(func() { storage.Exists(context.Background(), "test") })
	tryPanic(func() { storage.UploadFile(context.Background(), "test", "test", "test") })
	tryPanic(func() { storage.DownloadFile(context.Background(), "test") })
	tryPanic(func() { storage.Close() })

	jobStore := &RealJobStore{}
	tryPanic(func() { jobStore.AcquireJob(context.Background()) })
	tryPanic(func() { jobStore.UpdateJobMetadata(context.Background(), "test", "test", nil) })
	tryPanic(func() { jobStore.MarkJobDone(context.Background(), "test", "test") })
	tryPanic(func() { jobStore.MarkJobFailed(context.Background(), "test", "test", "test", 1) })
	tryPanic(func() { jobStore.UpdatePackageStatus(context.Background(), "test", "test", "test") })
	tryPanic(func() { jobStore.SaveDocument(context.Background(), db.Document{}) })
	tryPanic(func() { jobStore.UpdateDocumentStatus(context.Background(), "test", "test", "test") })
	tryPanic(func() { jobStore.UpdateDocumentMetadata(context.Background(), "test", "test", nil) })
}

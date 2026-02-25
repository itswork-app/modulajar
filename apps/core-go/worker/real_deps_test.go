package worker

import (
	"context"
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
	pdf := &RealPDFEngine{}
	_, _ = pdf.Generate(context.Background(), "html", render.GeneratePDFOptions{})

	plannerObj := &RealPlanner{}
	_, _ = plannerObj.Plan(planner.PlannerInput{})

	val := &RealValidator{}
	_, _ = val.Validate(validator.ValidatorInput{})
}

package worker

import (
	"path/filepath"
	"testing"
)

func TestExecuteJobSuccess(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:    "test-job-001",
		PackPath: packPath,
		Semester: "S1",
	}

	result, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("expected status=completed, got=%s, reason=%s", result.Status, result.FailureReason)
	}

	if !result.ValidationOK {
		t.Fatal("expected validation_ok=true")
	}

	if result.PlannerResult == nil {
		t.Fatal("expected planner_result to be non-nil")
	}

	t.Logf("Job %s completed. Pack: %s, Subjects: %d",
		result.JobID, result.PlannerResult.PackID, len(result.PlannerResult.Atps))
}

func TestExecuteJobInvalidPack(t *testing.T) {
	payload := TaskPayload{
		JobID:    "test-job-002",
		PackPath: "/nonexistent/pack.json",
		Semester: "S1",
	}

	result, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if result.Status != "failed" {
		t.Fatalf("expected status=failed, got=%s", result.Status)
	}

	if result.FailureReason == "" {
		t.Fatal("expected failure_reason to be set")
	}

	t.Logf("Job %s failed as expected: %s", result.JobID, result.FailureReason)
}

func TestExecuteJobRetryIdempotent(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:    "test-job-retry",
		PackPath: packPath,
		Semester: "S1",
	}

	// Run twice — must produce identical results (deterministic)
	result1, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob run 1 error: %v", err)
	}

	result2, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob run 2 error: %v", err)
	}

	if result1.Status != result2.Status {
		t.Fatalf("retry produced different status: %s vs %s", result1.Status, result2.Status)
	}

	if result1.ValidationOK != result2.ValidationOK {
		t.Fatal("retry produced different validation_ok")
	}

	t.Logf("Retry idempotent: both runs produced status=%s", result1.Status)
}

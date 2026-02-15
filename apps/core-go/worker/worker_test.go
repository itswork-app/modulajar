package worker

import (
	"path/filepath"
	"testing"
)

func TestExecuteJobSuccess(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:     "test-job-001",
		PackageID: "test-pkg-001",
		PackPath:  packPath,
		Semester:  "S1",
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

	if result.PackageID != "test-pkg-001" {
		t.Fatalf("expected package_id=test-pkg-001, got=%s", result.PackageID)
	}

	t.Logf("Job %s completed. Pack: %s, Subjects: %d",
		result.JobID, result.PlannerResult.PackID, len(result.PlannerResult.Atps))
}

func TestExecuteJobInvalidPack(t *testing.T) {
	payload := TaskPayload{
		JobID:     "test-job-002",
		PackageID: "test-pkg-002",
		PackPath:  "/nonexistent/pack.json",
		Semester:  "S1",
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
		JobID:     "test-job-retry",
		PackageID: "test-pkg-retry",
		PackPath:  packPath,
		Semester:  "S1",
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

// TestLifecycleStatusTransitions verifies status updates are correct.
func TestLifecycleStatusTransitions(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")

	// Success case: draft → generating → ready
	payload := TaskPayload{
		JobID:     "test-lifecycle-001",
		PackageID: "test-pkg-lifecycle-001",
		PackPath:  packPath,
		Semester:  "S1",
	}

	result, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if len(result.StatusUpdates) != 4 {
		t.Fatalf("expected 4 status updates, got %d", len(result.StatusUpdates))
	}

	// Check status transition order
	expected := []struct {
		table  string
		status string
	}{
		{"packages", "generating"},
		{"generation_jobs", "running"},
		{"packages", "ready"},
		{"generation_jobs", "completed"},
	}

	for i, exp := range expected {
		if result.StatusUpdates[i].Table != exp.table || result.StatusUpdates[i].Status != exp.status {
			t.Errorf("update[%d]: expected %s.%s, got %s.%s",
				i, exp.table, exp.status, result.StatusUpdates[i].Table, result.StatusUpdates[i].Status)
		}
	}

	t.Logf("Lifecycle success: %d status updates correct", len(result.StatusUpdates))

	// Failure case: draft → generating → failed
	failPayload := TaskPayload{
		JobID:     "test-lifecycle-fail",
		PackageID: "test-pkg-lifecycle-fail",
		PackPath:  "/nonexistent/pack.json",
		Semester:  "S1",
	}

	failResult, err := ExecuteJob(failPayload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if failResult.Status != "failed" {
		t.Fatalf("expected failed status, got %s", failResult.Status)
	}

	if len(failResult.StatusUpdates) != 4 {
		t.Fatalf("expected 4 status updates for failure, got %d", len(failResult.StatusUpdates))
	}

	// Last two should be failed
	if failResult.StatusUpdates[2].Status != "failed" {
		t.Errorf("expected packages.failed, got %s", failResult.StatusUpdates[2].Status)
	}
	if failResult.StatusUpdates[3].Status != "failed" {
		t.Errorf("expected generation_jobs.failed, got %s", failResult.StatusUpdates[3].Status)
	}

	t.Logf("Lifecycle failure: %d status updates correct", len(failResult.StatusUpdates))
}

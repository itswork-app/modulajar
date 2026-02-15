package worker

import (
	"path/filepath"
	"regexp"
	"testing"
)

// DID regex: DOC-{SUBJECT}-SD{N}-S{N}-{YEAR}-{6chars}-{8chars}
var didRegex = regexp.MustCompile(`^DOC-[A-Z]+-SD\d+-S\d+-\d{4}-[A-Z2-9]{6}-[A-Z2-9]{8}$`)

func TestExecuteJobSuccess(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-job-001",
		PackageID:   "test-pkg-001",
		WorkspaceID: "test-ws-001",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
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

	t.Logf("Job %s completed. Subjects: %d", result.JobID, len(result.PlannerResult.Atps))
}

func TestExecuteJobInvalidPack(t *testing.T) {
	payload := TaskPayload{
		JobID:       "test-job-002",
		PackageID:   "test-pkg-002",
		WorkspaceID: "test-ws-002",
		PackPath:    "/nonexistent/pack.json",
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2026",
	}

	result, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if result.Status != "failed" {
		t.Fatalf("expected status=failed, got=%s", result.Status)
	}

	t.Logf("Job %s failed as expected: %s", result.JobID, result.FailureReason)
}

func TestExecuteJobRetryIdempotent(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-job-retry",
		PackageID:   "test-pkg-retry",
		WorkspaceID: "test-ws-retry",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2026",
	}

	result1, _ := ExecuteJob(payload)
	result2, _ := ExecuteJob(payload)

	if result1.Status != result2.Status {
		t.Fatalf("retry produced different status: %s vs %s", result1.Status, result2.Status)
	}

	// Doc graphs must be identical
	if result1.DocGraph == nil || result2.DocGraph == nil {
		t.Fatal("doc graphs should not be nil")
	}

	if len(result1.DocGraph.Documents) != len(result2.DocGraph.Documents) {
		t.Fatalf("retry doc count mismatch: %d vs %d",
			len(result1.DocGraph.Documents), len(result2.DocGraph.Documents))
	}

	for i, d1 := range result1.DocGraph.Documents {
		d2 := result2.DocGraph.Documents[i]
		if d1.ID != d2.ID || d1.PublicID != d2.PublicID {
			t.Errorf("doc[%d] mismatch: id=%s/%s, did=%s/%s",
				i, d1.ID, d2.ID, d1.PublicID, d2.PublicID)
		}
	}

	t.Logf("Retry idempotent: %d docs identical across runs", len(result1.DocGraph.Documents))
}

func TestLifecycleStatusTransitions(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")

	payload := TaskPayload{
		JobID:       "test-lifecycle-001",
		PackageID:   "test-pkg-lifecycle-001",
		WorkspaceID: "test-ws-lifecycle-001",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2026",
	}

	result, _ := ExecuteJob(payload)
	if len(result.StatusUpdates) != 4 {
		t.Fatalf("expected 4 status updates, got %d", len(result.StatusUpdates))
	}

	expected := []struct{ table, status string }{
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

	t.Logf("Lifecycle transitions correct")
}

// ═══════════════════════════════════════════
// DOCUMENT GRAPH TESTS
// ═══════════════════════════════════════════

func TestDocGraphCreated(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-docgraph-001",
		PackageID:   "test-pkg-docgraph-001",
		WorkspaceID: "test-ws-docgraph-001",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
	}

	result, err := ExecuteJob(payload)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}

	if result.DocGraph == nil {
		t.Fatal("expected doc_graph to be non-nil")
	}

	// SD4 has 6 subjects
	if len(result.DocGraph.Documents) != 6 {
		t.Fatalf("expected 6 documents, got %d", len(result.DocGraph.Documents))
	}

	if len(result.DocGraph.Versions) != 6 {
		t.Fatalf("expected 6 versions, got %d", len(result.DocGraph.Versions))
	}

	t.Logf("Doc graph: %d documents, %d versions", len(result.DocGraph.Documents), len(result.DocGraph.Versions))
}

func TestDocDIDFormat(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-did-format",
		PackageID:   "test-pkg-did-format",
		WorkspaceID: "test-ws-did-format",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
	}

	result, _ := ExecuteJob(payload)

	for _, doc := range result.DocGraph.Documents {
		if !didRegex.MatchString(doc.PublicID) {
			t.Errorf("DID format invalid: %s", doc.PublicID)
		}
		t.Logf("DID: %s (subject: %s)", doc.PublicID, doc.SubjectCode)
	}
}

func TestDocVersioning(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-versioning",
		PackageID:   "test-pkg-versioning",
		WorkspaceID: "test-ws-versioning",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2026",
	}

	result, _ := ExecuteJob(payload)

	for i, ver := range result.DocGraph.Versions {
		if ver.Version != 1 {
			t.Errorf("version[%d]: expected version=1, got=%d", i, ver.Version)
		}
		if ver.FilePath != "pending://" {
			t.Errorf("version[%d]: expected file_path=pending://, got=%s", i, ver.FilePath)
		}
		if ver.DocumentID != result.DocGraph.Documents[i].ID {
			t.Errorf("version[%d]: document_id mismatch", i)
		}
	}

	t.Logf("All %d versions are v1 with pending:// file_path", len(result.DocGraph.Versions))
}

func TestDocSubjectCoverage(t *testing.T) {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	payload := TaskPayload{
		JobID:       "test-coverage",
		PackageID:   "test-pkg-coverage",
		WorkspaceID: "test-ws-coverage",
		PackPath:    packPath,
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2026",
	}

	result, _ := ExecuteJob(payload)

	expectedSubjects := map[string]bool{
		"BI": false, "MTK": false, "IPAS": false,
		"PPKN": false, "SBK": false, "PJOK": false,
	}

	for _, doc := range result.DocGraph.Documents {
		if _, ok := expectedSubjects[doc.SubjectCode]; !ok {
			t.Errorf("unexpected subject: %s", doc.SubjectCode)
		}
		expectedSubjects[doc.SubjectCode] = true
	}

	for subj, found := range expectedSubjects {
		if !found {
			t.Errorf("missing document for subject: %s", subj)
		}
	}

	t.Logf("All 6 subjects covered in documents")
}

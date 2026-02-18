package worker

import (
	"context"
	"log/slog"
	"modulajar/apps/core-go/render"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// DID regex: DOC-{SUBJECT}-SD{N}-S{N}-{YEAR}-{6chars}-{8chars}
var didRegex = regexp.MustCompile(`^DOC-[A-Z]+-SD\d+-S\d+-\d{4}-[A-Z2-9]{6}-[A-Z2-9]{8}$`)

func basePayload() TaskPayload {
	return TaskPayload{
		JobID:       "test-job-001",
		PackageID:   "test-pkg-001",
		WorkspaceID: "test-ws-001",
		PackPath:    filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json"),
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
		TeacherName: "Ibu Test",
		SchoolName:  "SDN Test",
		PID:         "PKG-SD4-S1-2026-TSTPKG-TST12345",
	}
}

func TestExecuteJobSuccess(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, err := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)
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

	t.Logf("Job completed. Subjects: %d", len(result.PlannerResult.Atps))
}

func TestExecuteJobInvalidPack(t *testing.T) {
	payload := basePayload()
	payload.PackPath = "/nonexistent/pack.json"

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, err := ExecuteJob(context.Background(), payload, logger, nil, nil)
	if err != nil {
		t.Fatalf("ExecuteJob error: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected status=failed, got=%s", result.Status)
	}

	t.Logf("Failed as expected: %s", result.FailureReason)
}

func TestExecuteJobRetryIdempotent(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	payload := basePayload()
	payload.JobID = "test-idempotent"
	payload.PackageID = "test-pkg-idempotent"

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result1, _ := ExecuteJob(context.Background(), payload, logger, nil, nil)
	result2, _ := ExecuteJob(context.Background(), payload, logger, nil, nil)

	if result1.Status != result2.Status {
		t.Fatalf("different status: %s vs %s", result1.Status, result2.Status)
	}

	// Doc graphs identical
	if len(result1.DocGraph.Documents) != len(result2.DocGraph.Documents) {
		t.Fatalf("doc count: %d vs %d", len(result1.DocGraph.Documents), len(result2.DocGraph.Documents))
	}
	for i, d1 := range result1.DocGraph.Documents {
		d2 := result2.DocGraph.Documents[i]
		if d1.ID != d2.ID || d1.PublicID != d2.PublicID {
			t.Errorf("doc[%d] mismatch", i)
		}
	}

	// Rendered HTML identical
	if len(result1.RenderedDocuments) != len(result2.RenderedDocuments) {
		t.Fatalf("rendered count: %d vs %d", len(result1.RenderedDocuments), len(result2.RenderedDocuments))
	}
	for i, r1 := range result1.RenderedDocuments {
		r2 := result2.RenderedDocuments[i]
		if r1.HTML != r2.HTML {
			t.Errorf("rendered[%d] HTML differs", i)
		}
	}

	t.Logf("Retry idempotent: %d docs + %d rendered identical", len(result1.DocGraph.Documents), len(result1.RenderedDocuments))
}

func TestDocGraphCreated(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	if result.DocGraph == nil {
		t.Fatal("expected doc_graph non-nil")
	}
	if len(result.DocGraph.Documents) != 6 {
		t.Fatalf("expected 6 documents, got %d", len(result.DocGraph.Documents))
	}
	if len(result.DocGraph.Versions) != 6 {
		t.Fatalf("expected 6 versions, got %d", len(result.DocGraph.Versions))
	}
}

func TestDocDIDFormat(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	for _, doc := range result.DocGraph.Documents {
		if !didRegex.MatchString(doc.PublicID) {
			t.Errorf("DID format invalid: %s", doc.PublicID)
		}
	}
}

// ═══════════════════════════════════════════
// HTML COMPOSER INTEGRATION TESTS
// ═══════════════════════════════════════════

func TestRenderedDocumentsCreated(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	if len(result.RenderedDocuments) != 6 {
		t.Fatalf("expected 6 rendered documents, got %d", len(result.RenderedDocuments))
	}

	for _, rd := range result.RenderedDocuments {
		if rd.HTML == "" {
			t.Errorf("subject %s: empty HTML", rd.SubjectCode)
		}
		if rd.DID == "" {
			t.Errorf("subject %s: empty DID", rd.SubjectCode)
		}
		if rd.FilePath == "" {
			t.Errorf("subject %s: empty file_path", rd.SubjectCode)
		}
		t.Logf("subject %s: %d bytes, file_path=%s", rd.SubjectCode, len(rd.HTML), rd.FilePath)
	}
}

func TestRenderedHTMLNoUnresolvedPlaceholders(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	for _, rd := range result.RenderedDocuments {
		if strings.Contains(rd.HTML, "{{") && strings.Contains(rd.HTML, "}}") {
			t.Errorf("subject %s: unresolved placeholder in HTML", rd.SubjectCode)
		}
	}

	t.Logf("All %d rendered docs have no unresolved placeholders", len(result.RenderedDocuments))
}

func TestRenderedHTMLContainsPIDDID(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	for _, rd := range result.RenderedDocuments {
		if !strings.Contains(rd.HTML, basePayload().PID) {
			t.Errorf("subject %s: missing PID in HTML", rd.SubjectCode)
		}
		if !strings.Contains(rd.HTML, rd.DID) {
			t.Errorf("subject %s: missing DID in HTML", rd.SubjectCode)
		}
	}
}

func TestVersionFilePathsUpdated(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	for _, ver := range result.DocGraph.Versions {
		if !strings.HasPrefix(ver.FilePath, "html://") {
			t.Errorf("version %s: file_path=%s, expected html:// prefix", ver.ID, ver.FilePath)
		}
	}

	t.Logf("All %d version file_paths updated to html:// URIs", len(result.DocGraph.Versions))
}

func TestRenderedHTMLContainsSubjectName(t *testing.T) {
	if !render.IsChromeAvailable() {
		t.Skip("Chrome/Chromium not found, skipping integration test")
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	result, _ := ExecuteJob(context.Background(), basePayload(), logger, nil, nil)

	// Verify each rendered doc contains its subject data
	for _, rd := range result.RenderedDocuments {
		if !strings.Contains(rd.HTML, "atp-table") {
			t.Errorf("subject %s: missing ATP table", rd.SubjectCode)
		}
		if !strings.Contains(rd.HTML, "activity-unit") {
			t.Errorf("subject %s: missing activity sections", rd.SubjectCode)
		}
		if !strings.Contains(rd.HTML, "Asesmen") {
			t.Errorf("subject %s: missing assessment section", rd.SubjectCode)
		}
	}
}

package docgraph

import (
	"modulajar/apps/core-go/planner"
	"regexp"
	"testing"
)

func TestIssueDID_Format(t *testing.T) {
	did := IssueDID(
		"secret",
		"ws-1",
		"pkg-1",
		"doc-1",
		"BI",
		"4",
		"1",
		"2025/2026",
	)

	// Format: DOC-{subjectCode}-{kelas}-{semester}-{tahun}-{packageShort}-{hmac8}
	// Regex: ^DOC-[A-Z]+-SD\d+-S\d+-\d{4}-[A-Z2-9]{6}-[A-Z2-9]{8}$
	matched, _ := regexp.MatchString(`^DOC-BI-SD4-S1-2026-[A-Z2-9]{6}-[A-Z2-9]{8}$`, did)
	if !matched {
		t.Errorf("DID format mismatch: %s", did)
	}
}

func TestIssueDID_Normalization(t *testing.T) {
	tests := []struct {
		name     string
		kelas    string
		semester string
		want     string // partial match
	}{
		{"Naked numbers", "4", "1", "SD4-S1"},
		{"Already prefixed", "SD4", "S1", "SD4-S1"},
		{"Lowercase", "sd4", "s1", "SD4-S1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			did := IssueDID("s", "w", "p", "d", "MATH", tt.kelas, tt.semester, "2025")
			if !regexp.MustCompile(tt.want).MatchString(did) {
				t.Errorf("Normalization failed for %s/%s: %s", tt.kelas, tt.semester, did)
			}
		})
	}
}

func TestIssueDID_TahunExtraction(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"2025/2026", "2026"},
		{"2025", "2025"},
	}

	for _, tt := range tests {
		did := IssueDID("s", "w", "p", "d", "BI", "4", "1", tt.input)
		if !regexp.MustCompile(tt.want).MatchString(did) {
			t.Errorf("Tahun extraction failed for %s: %s", tt.input, did)
		}
	}
}

func TestPackageShortCode_Deterministic(t *testing.T) {
	id := "package-123"
	code1 := PackageShortCode(id)
	code2 := PackageShortCode(id)

	if code1 != code2 {
		t.Error("PackageShortCode not deterministic")
	}
	if len(code1) != 6 {
		t.Errorf("Expected length 6, got %d", len(code1))
	}
}

func TestBuildDocGraph(t *testing.T) {
	input := DocGraphInput{
		WorkspaceID: "ws-1",
		PackageID:   "pkg-1",
		Kelas:       "4",
		Semester:    "1",
		TahunAjaran: "2025",
		DIDSecret:   "secret",
		PlanResult: &planner.PlannerResult{
			Atps: []planner.Atp{
				{SubjectCode: "MATH"},
				{SubjectCode: "BI"},
			},
		},
	}

	res, err := BuildDocGraph(input)
	if err != nil {
		t.Fatalf("BuildDocGraph failed: %v", err)
	}

	if len(res.Documents) != 2 {
		t.Errorf("Expected 2 documents, got %d", len(res.Documents))
	}
	if len(res.Versions) != 2 {
		t.Errorf("Expected 2 versions, got %d", len(res.Versions))
	}

	// Verify sorting (BI then MATH)
	if res.Documents[0].SubjectCode != "BI" {
		t.Errorf("Expected BI first (alpha sort), got %s", res.Documents[0].SubjectCode)
	}

	// Verify determinism
	res2, _ := BuildDocGraph(input)
	if res.Documents[0].ID != res2.Documents[0].ID {
		t.Error("BuildDocGraph IDs not deterministic")
	}
}

func TestBuildDocGraph_NilPlan(t *testing.T) {
	res, err := BuildDocGraph(DocGraphInput{PlanResult: nil})
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if res != nil {
		t.Error("Expected nil result for nil plan")
	}
}

func TestDeterministicULID_Monotonicity(t *testing.T) {
	// Test that even with same seed, it works (though the version seed differs normally)
	id1 := deterministicULID("seed")
	id2 := deterministicULID("seed")
	if id1 != id2 {
		t.Error("deterministicULID not deterministic")
	}
}

package docgraph

import (
	"modulajar/apps/core-go/planner"
	"regexp"
	"testing"
)

// DID format: DOC-{SUBJECT}-SD{N}-S{N}-{YEAR}-{6chars}-{8chars}
var didRegex = regexp.MustCompile(`^DOC-[A-Z]+-SD\d+-S\d+-\d{4}-[A-Z2-9]{6}-[A-Z2-9]{8}$`)

// ═══════════════════════════════════════
// IssueDID tests
// ═══════════════════════════════════════

func TestIssueDID_Format(t *testing.T) {
	did := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2025/2026")
	if !didRegex.MatchString(did) {
		t.Errorf("DID format invalid: %s", did)
	}
	t.Logf("DID: %s", did)
}

func TestIssueDID_Deterministic(t *testing.T) {
	did1 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2025/2026")
	did2 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2025/2026")
	if did1 != did2 {
		t.Errorf("IssueDID is not deterministic: %s != %s", did1, did2)
	}
}

func TestIssueDID_DifferentInputsDifferentOutput(t *testing.T) {
	did1 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2025/2026")
	did2 := IssueDID("secret", "ws1", "pkg2", "doc1", "BI", "4", "S1", "2025/2026")
	if did1 == did2 {
		t.Errorf("Different packageID should produce different DID")
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

func TestIssueDID_SubjectCodeUppercased(t *testing.T) {
	// lowercase input should produce uppercase subject code in output display portion
	did_lower := IssueDID("secret", "ws1", "pkg1", "doc1", "bi", "4", "S1", "2026")
	if !regexp.MustCompile(`^DOC-BI-`).MatchString(did_lower) {
		t.Errorf("SubjectCode not uppercased in DID display: %s", did_lower)
	}
}

// ═══════════════════════════════════════
// PackageShortCode tests
// ═══════════════════════════════════════

func TestPackageShortCode_Length(t *testing.T) {
	code := PackageShortCode("test-package-ulid")
	if len(code) != 6 {
		t.Errorf("Expected short code length 6, got %d: %s", len(code), code)
	}
}

func TestPackageShortCode_Deterministic(t *testing.T) {
	id := "package-123"
	code1 := PackageShortCode(id)
	code2 := PackageShortCode(id)

	if code1 != code2 {
		t.Error("PackageShortCode not deterministic")
	}
}

func TestPackageShortCode_DifferentInputs(t *testing.T) {
	c1 := PackageShortCode("pkg-aaa")
	c2 := PackageShortCode("pkg-bbb")
	if c1 == c2 {
		t.Errorf("Different inputs should produce different short codes")
	}
}

// ═══════════════════════════════════════
// BuildDocGraph tests
// ═══════════════════════════════════════

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
	// Test that even with same seed, it works
	id1 := deterministicULID("seed")
	id2 := deterministicULID("seed")
	if id1 != id2 {
		t.Error("deterministicULID not deterministic")
	}
}

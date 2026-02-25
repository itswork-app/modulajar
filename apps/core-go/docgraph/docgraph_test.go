package docgraph

import (
	"regexp"
	"testing"

	"modulajar/apps/core-go/planner"
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

func TestIssueDID_KelasNormalization(t *testing.T) {
	// '4' and 'SD4' produce same visual prefix (both display as SD4)
	// but HMAC suffix differs because raw input is used for hash
	did1 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2026")
	did2 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "SD4", "S1", "2026")
	// Both should have SD4 in the display portion
	if !regexp.MustCompile(`^DOC-BI-SD4-S1-`).MatchString(did1) {
		t.Errorf("Expected kelas '4' to render as 'SD4' in DID, got: %s", did1)
	}
	if !regexp.MustCompile(`^DOC-BI-SD4-S1-`).MatchString(did2) {
		t.Errorf("Expected kelas 'SD4' to render as 'SD4' in DID, got: %s", did2)
	}
}

func TestIssueDID_SemesterNormalization(t *testing.T) {
	// '1' and 'S1' both display as S1 in display portion
	did1 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "1", "2026")
	did2 := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2026")
	// Both should have S1 in the display portion
	if !regexp.MustCompile(`-S1-`).MatchString(did1) {
		t.Errorf("Expected semester '1' to render as 'S1' in DID, got: %s", did1)
	}
	if !regexp.MustCompile(`-S1-`).MatchString(did2) {
		t.Errorf("Expected semester 'S1' to render as 'S1' in DID, got: %s", did2)
	}
}

func TestIssueDID_TahunExtraction(t *testing.T) {
	// Year extracted from "2025/2026" → "2026"
	did := IssueDID("secret", "ws1", "pkg1", "doc1", "BI", "4", "S1", "2025/2026")
	// Should contain 2026
	if !regexp.MustCompile(`-2026-`).MatchString(did) {
		t.Errorf("Expected year 2026 in DID, got: %s", did)
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
	c1 := PackageShortCode("pkg-abc")
	c2 := PackageShortCode("pkg-abc")
	if c1 != c2 {
		t.Errorf("PackageShortCode is not deterministic: %s != %s", c1, c2)
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

func makePlanResult(subjectCodes ...string) *planner.PlannerResult {
	atps := make([]planner.Atp, len(subjectCodes))
	for i, code := range subjectCodes {
		atps[i] = planner.Atp{
			SubjectCode: code,
			SubjectName: code + " Name",
			TpItems: []planner.TpItem{
				{Code: "TP1", Description: "Test TP", OutcomeCode: "TP1"},
			},
		}
	}
	return &planner.PlannerResult{
		Semester: "S1",
		Atps:     atps,
	}
}

func baseInput(subjectCodes ...string) DocGraphInput {
	return DocGraphInput{
		WorkspaceID: "ws-test",
		PackageID:   "pkg-test",
		Kelas:       "4",
		Semester:    "S1",
		TahunAjaran: "2025/2026",
		DIDSecret:   "test-secret",
		PlanResult:  makePlanResult(subjectCodes...),
	}
}

func TestBuildDocGraph_NilPlanResult(t *testing.T) {
	input := DocGraphInput{PlanResult: nil}
	result, err := BuildDocGraph(input)
	if err != nil {
		t.Fatalf("Expected no error for nil PlanResult, got: %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil result for nil PlanResult, got: %+v", result)
	}
}

func TestBuildDocGraph_SingleSubject(t *testing.T) {
	result, err := BuildDocGraph(baseInput("BI"))
	if err != nil {
		t.Fatalf("BuildDocGraph failed: %v", err)
	}
	if result == nil {
		t.Fatal("Expected non-nil result")
	}
	if len(result.Documents) != 1 {
		t.Fatalf("Expected 1 document, got %d", len(result.Documents))
	}
	if len(result.Versions) != 1 {
		t.Fatalf("Expected 1 version, got %d", len(result.Versions))
	}

	doc := result.Documents[0]
	if doc.SubjectCode != "BI" {
		t.Errorf("Expected SubjectCode 'BI', got '%s'", doc.SubjectCode)
	}
	if doc.Status != "ready" {
		t.Errorf("Expected Status 'ready', got '%s'", doc.Status)
	}
	if doc.Version != 1 {
		t.Errorf("Expected Version 1, got %d", doc.Version)
	}
	if !didRegex.MatchString(doc.PublicID) {
		t.Errorf("Document DID format invalid: %s", doc.PublicID)
	}
	if result.Versions[0].FilePath != "pending://" {
		t.Errorf("Expected version status 'pending://', got '%s'", result.Versions[0].FilePath)
	}
}

func TestBuildDocGraph_MultiSubject_Count(t *testing.T) {
	result, err := BuildDocGraph(baseInput("BI", "MTK", "IPAS"))
	if err != nil {
		t.Fatalf("BuildDocGraph failed: %v", err)
	}
	if len(result.Documents) != 3 {
		t.Fatalf("Expected 3 documents, got %d", len(result.Documents))
	}
	if len(result.Versions) != 3 {
		t.Fatalf("Expected 3 versions, got %d", len(result.Versions))
	}
}

func TestBuildDocGraph_Deterministic(t *testing.T) {
	input := baseInput("BI", "MTK")

	result1, _ := BuildDocGraph(input)
	result2, _ := BuildDocGraph(input)

	if len(result1.Documents) != len(result2.Documents) {
		t.Fatalf("Different document count: %d vs %d", len(result1.Documents), len(result2.Documents))
	}
	for i, doc1 := range result1.Documents {
		doc2 := result2.Documents[i]
		if doc1.ID != doc2.ID {
			t.Errorf("Document[%d] ID differs: %s vs %s", i, doc1.ID, doc2.ID)
		}
		if doc1.PublicID != doc2.PublicID {
			t.Errorf("Document[%d] PublicID differs: %s vs %s", i, doc1.PublicID, doc2.PublicID)
		}
	}
}

func TestBuildDocGraph_SubjectsSorted(t *testing.T) {
	// Subjects in reverse order — result should be sorted alphabetically
	resultAB, _ := BuildDocGraph(baseInput("BI", "MTK"))
	resultBA, _ := BuildDocGraph(baseInput("MTK", "BI"))

	// Both should produce docs in same order (sorted)
	if len(resultAB.Documents) != len(resultBA.Documents) {
		t.Fatalf("Expected same count, got %d vs %d", len(resultAB.Documents), len(resultBA.Documents))
	}
	for i := range resultAB.Documents {
		if resultAB.Documents[i].ID != resultBA.Documents[i].ID {
			t.Errorf("Docs[%d] differ — sorting is not deterministic", i)
		}
	}
}

func TestBuildDocGraph_AllDIDs_ValidFormat(t *testing.T) {
	result, err := BuildDocGraph(baseInput("BI", "MTK", "IPAS", "PPKN"))
	if err != nil {
		t.Fatalf("BuildDocGraph failed: %v", err)
	}
	for _, doc := range result.Documents {
		if !didRegex.MatchString(doc.PublicID) {
			t.Errorf("DID format invalid: %s", doc.PublicID)
		}
	}
}

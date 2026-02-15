package render

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

func templateDir() string {
	return filepath.Join("..", "templates", "v1")
}

func buildTestPlanResult() *planner.PlannerResult {
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		panic("failed to load pack for test: " + err.Error())
	}

	config := planner.DefaultConfig()
	config.Semester = "S1"

	result, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		panic("planner failed: " + err.Error())
	}
	return result
}

func TestBuildATPTable(t *testing.T) {
	result := buildTestPlanResult()

	html := BuildATPTable(result, "BI")
	if html == "" {
		t.Fatal("ATP table is empty")
	}

	if !strings.Contains(html, "atp-table") {
		t.Error("missing atp-table class")
	}
	if !strings.Contains(html, "<th>") {
		t.Error("missing table headers")
	}
	if !strings.Contains(html, "TP-") {
		t.Error("missing TP codes in table")
	}

	// Count rows (each <tr> in tbody)
	rowCount := strings.Count(html, "<tr>") - 1 // minus header row
	t.Logf("ATP table for BI: %d rows, %d bytes", rowCount, len(html))
}

func TestBuildActivitySections(t *testing.T) {
	result := buildTestPlanResult()

	html := BuildActivitySections(result, "BI")
	if html == "" {
		t.Fatal("Activity sections empty")
	}

	if !strings.Contains(html, "activity-unit") {
		t.Error("missing activity-unit class")
	}
	if !strings.Contains(html, "Minggu") {
		t.Error("missing week range")
	}

	unitCount := strings.Count(html, "activity-unit-title")
	t.Logf("Activity sections for BI: %d units, %d bytes", unitCount, len(html))
}

func TestBuildAssessmentSection(t *testing.T) {
	html := BuildAssessmentSection("Bahasa Indonesia")

	if !strings.Contains(html, "Asesmen Formatif") {
		t.Error("missing formatif section")
	}
	if !strings.Contains(html, "Asesmen Sumatif") {
		t.Error("missing sumatif section")
	}
	if !strings.Contains(html, "Bahasa Indonesia") {
		t.Error("missing subject name")
	}

	t.Logf("Assessment section: %d bytes", len(html))
}

func TestComposeModulAjarHTML(t *testing.T) {
	result := buildTestPlanResult()

	html, err := ComposeModulAjarHTML(ComposerInput{
		TemplateDir: templateDir(),
		SubjectCode: "BI",
		SubjectName: "Bahasa Indonesia",
		Title:       "Modul Ajar BI Kelas IV S1",
		TeacherName: "Ibu Ani Susanti",
		SchoolName:  "SDN 1 Menteng",
		Kelas:       "IV",
		Semester:    "S1",
		TahunAjaran: "2025/2026",
		PID:         "PKG-SD4-S1-2026-TEST01-ABCD1234",
		DID:         "DOC-BI-SD4-S1-2026-TEST01-EFGH5678",
		VerifyURL:   "https://modulajar.com/verify/DOC-BI-SD4-S1-2026-TEST01-EFGH5678",
		PlanResult:  result,
	})
	if err != nil {
		t.Fatalf("ComposeModulAjarHTML error: %v", err)
	}

	if len(html) == 0 {
		t.Fatal("Composed HTML is empty")
	}

	// No unresolved placeholders
	if HasUnresolvedPlaceholders(html) {
		t.Error("HTML contains unresolved {{...}} placeholders")
	}

	// Contains identity data
	checks := map[string]string{
		"teacher":    "Ibu Ani Susanti",
		"school":     "SDN 1 Menteng",
		"kelas":      "IV",
		"semester":   "S1",
		"tahun":      "2025/2026",
		"subject":    "Bahasa Indonesia",
		"PID":        "PKG-SD4-S1-2026-TEST01-ABCD1234",
		"DID":        "DOC-BI-SD4-S1-2026-TEST01-EFGH5678",
		"verify URL": "https://modulajar.com/verify/DOC-BI-SD4-S1-2026-TEST01-EFGH5678",
		"DOCTYPE":    "<!DOCTYPE html>",
		"A4 CSS":     "size: A4",
		"ATP table":  "atp-table",
		"activities": "activity-unit",
		"assessment": "Asesmen Formatif",
	}

	for label, needle := range checks {
		if !strings.Contains(html, needle) {
			t.Errorf("missing %s in composed HTML", label)
		}
	}

	t.Logf("Composed HTML: %d bytes, all checks passed", len(html))
}

func TestComposerDeterministic(t *testing.T) {
	result := buildTestPlanResult()

	input := ComposerInput{
		TemplateDir: templateDir(),
		SubjectCode: "MTK",
		SubjectName: "Matematika",
		TeacherName: "Bapak Budi",
		SchoolName:  "SDN 2 Jakarta",
		Kelas:       "IV",
		Semester:    "S1",
		TahunAjaran: "2025/2026",
		PID:         "PKG-DETERMINISM-TEST",
		DID:         "DOC-MTK-DETERMINISM-TEST",
		VerifyURL:   "https://modulajar.com/verify/DOC-MTK-DETERMINISM-TEST",
		PlanResult:  result,
	}

	html1, _ := ComposeModulAjarHTML(input)
	html2, _ := ComposeModulAjarHTML(input)

	hash1 := fmt.Sprintf("%x", sha256.Sum256([]byte(html1)))
	hash2 := fmt.Sprintf("%x", sha256.Sum256([]byte(html2)))

	if hash1 != hash2 {
		t.Fatalf("NOT DETERMINISTIC: hash1=%s hash2=%s", hash1, hash2)
	}

	t.Logf("Deterministic: SHA256=%s (%d bytes)", hash1[:16], len(html1))
}

func TestComposeAllSubjects(t *testing.T) {
	result := buildTestPlanResult()
	subjects := []struct{ code, name string }{
		{"BI", "Bahasa Indonesia"},
		{"MTK", "Matematika"},
		{"IPAS", "IPAS"},
		{"PPKN", "PPKn"},
		{"SBK", "Seni Budaya"},
		{"PJOK", "PJOK"},
	}

	for _, s := range subjects {
		html, err := ComposeModulAjarHTML(ComposerInput{
			TemplateDir: templateDir(),
			SubjectCode: s.code,
			SubjectName: s.name,
			TeacherName: "Guru Test",
			SchoolName:  "SD Test",
			Kelas:       "IV",
			Semester:    "S1",
			TahunAjaran: "2026",
			PID:         "PKG-TEST",
			DID:         fmt.Sprintf("DOC-%s-TEST", s.code),
			VerifyURL:   fmt.Sprintf("https://modulajar.com/verify/DOC-%s-TEST", s.code),
			PlanResult:  result,
		})
		if err != nil {
			t.Errorf("subject %s: compose failed: %v", s.code, err)
			continue
		}
		if HasUnresolvedPlaceholders(html) {
			t.Errorf("subject %s: has unresolved placeholders", s.code)
		}
		if !strings.Contains(html, s.name) {
			t.Errorf("subject %s: missing subject name", s.code)
		}
		t.Logf("subject %s: %d bytes ✓", s.code, len(html))
	}
}

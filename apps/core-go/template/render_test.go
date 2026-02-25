package template

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func templateDir() string {
	return filepath.Join("..", "templates", "v1")
}

func TestRequiredPlaceholdersExist(t *testing.T) {
	tmplPath := filepath.Join(templateDir(), "modul-ajar.html")
	content, err := os.ReadFile(tmplPath)
	if err != nil {
		t.Fatalf("failed to read template: %v", err)
	}

	html := string(content)

	for _, p := range RequiredPlaceholders {
		if !strings.Contains(html, p) {
			t.Errorf("missing required placeholder: %s", p)
		}
	}

	t.Logf("All %d required placeholders found in template", len(RequiredPlaceholders))
}

func TestStylesFileExists(t *testing.T) {
	stylesPath := filepath.Join(templateDir(), "styles.css")
	info, err := os.Stat(stylesPath)
	if err != nil {
		t.Fatalf("styles.css not found: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("styles.css is empty")
	}
	t.Logf("styles.css: %d bytes", info.Size())
}

func TestStylesHasA4(t *testing.T) {
	stylesPath := filepath.Join(templateDir(), "styles.css")
	content, err := os.ReadFile(stylesPath)
	if err != nil {
		t.Fatalf("failed to read styles: %v", err)
	}

	css := string(content)

	if !strings.Contains(css, "size: A4") {
		t.Error("styles.css missing @page size: A4")
	}
	if !strings.Contains(css, "page-break") {
		t.Error("styles.css missing page-break rules")
	}

	t.Log("A4 print CSS rules verified")
}

func TestSampleDataExists(t *testing.T) {
	samplePath := filepath.Join(templateDir(), "sample.json")
	info, err := os.Stat(samplePath)
	if err != nil {
		t.Fatalf("sample.json not found: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("sample.json is empty")
	}
	t.Logf("sample.json: %d bytes", info.Size())
}

func TestRenderSampleProducesHTML(t *testing.T) {
	html, err := RenderSample(templateDir())
	if err != nil {
		t.Fatalf("RenderSample error: %v", err)
	}

	if len(html) == 0 {
		t.Fatal("RenderSample produced empty output")
	}

	// Must contain DOCTYPE
	if !strings.Contains(html, "<!DOCTYPE html>") {
		t.Error("output missing <!DOCTYPE html>")
	}

	// Must not contain any unreplaced placeholders from sample.json
	unreplaced := []string{
		"{{TITLE}}", "{{TEACHER_NAME}}", "{{SCHOOL_NAME}}",
		"{{KELAS}}", "{{SEMESTER}}", "{{TAHUN_AJARAN}}",
		"{{SUBJECT_NAME}}", "{{PID}}", "{{DID}}", "{{VERIFY_URL}}",
		"{{ATP_TABLE}}", "{{ACTIVITY_SECTIONS}}", "{{ASSESSMENT_SECTION}}",
	}
	for _, p := range unreplaced {
		if strings.Contains(html, p) {
			t.Errorf("unreplaced placeholder in output: %s", p)
		}
	}

	// Must contain sample data values
	if !strings.Contains(html, "Ibu Ani Susanti") {
		t.Error("rendered HTML missing teacher name")
	}
	if !strings.Contains(html, "SDN 1 Menteng") {
		t.Error("rendered HTML missing school name")
	}
	if !strings.Contains(html, "DOC-BI-SD4-S1-2026-L32RJY-MM9DUDBX") {
		t.Error("rendered HTML missing DID watermark")
	}

	// Must contain injected CSS
	if !strings.Contains(html, "size: A4") {
		t.Error("rendered HTML missing injected CSS")
	}

	t.Logf("RenderSample output: %d bytes, all placeholders replaced", len(html))
}

func TestRenderWithCustomData(t *testing.T) {
	data := map[string]string{
		"TITLE":              "Test Modul",
		"TEACHER_NAME":       "Bapak Test",
		"SCHOOL_NAME":        "SD Test",
		"KELAS":              "V",
		"SEMESTER":           "S2",
		"TAHUN_AJARAN":       "2026/2027",
		"SUBJECT_NAME":       "Matematika",
		"ATP_TABLE":          "<table><tr><td>Unit 1</td></tr></table>",
		"ACTIVITY_SECTIONS":  "<div>Activity</div>",
		"ASSESSMENT_SECTION": "<div>Assessment</div>",
		"PID":                "PKG-TEST",
		"DID":                "DOC-TEST",
		"VERIFY_URL":         "https://modulajar.com/verify/DOC-TEST",
	}

	html, err := Render(templateDir(), data)
	if err != nil {
		t.Fatalf("Render error: %v", err)
	}

	if !strings.Contains(html, "Bapak Test") {
		t.Error("custom data not rendered: teacher name")
	}
	if !strings.Contains(html, "PKG-TEST") {
		t.Error("custom data not rendered: PID")
	}
	if !strings.Contains(html, "DOC-TEST") {
		t.Error("custom data not rendered: DID")
	}

	t.Logf("Custom render output: %d bytes", len(html))
}

func TestTemplateDir(t *testing.T) {
	dir := TemplateDir()
	if dir == "" {
		t.Error("TemplateDir returned empty string")
	}
	if !strings.Contains(dir, "v1") {
		t.Error("TemplateDir does not contain 'v1'")
	}
}

func TestRenderSample_BadDirectory(t *testing.T) {
	_, err := RenderSample("/nonexistent/dir")
	if err == nil {
		t.Error("expected error for nonexistent template dir")
	}
}

func TestRenderSample_MissingStyles(t *testing.T) {
	// Create dir with modul-ajar.html but no styles.css
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "modul-ajar.html"), []byte("<html>{{STYLES}}</html>"), 0644)

	_, err := RenderSample(tmpDir)
	if err == nil {
		t.Error("expected error for missing styles.css")
	}
}

func TestRenderSample_MissingSampleJSON(t *testing.T) {
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "modul-ajar.html"), []byte("<html>{{STYLES}}</html>"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "styles.css"), []byte("body{}"), 0644)

	_, err := RenderSample(tmpDir)
	if err == nil {
		t.Error("expected error for missing sample.json")
	}
}

func TestRenderSample_BadSampleJSON(t *testing.T) {
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "modul-ajar.html"), []byte("<html>{{STYLES}}</html>"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "styles.css"), []byte("body{}"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "sample.json"), []byte("{invalid"), 0644)

	_, err := RenderSample(tmpDir)
	if err == nil {
		t.Error("expected error for malformed sample.json")
	}
}

func TestRender_BadDirectory(t *testing.T) {
	_, err := Render("/nonexistent/dir", map[string]string{})
	if err == nil {
		t.Error("expected error for nonexistent template dir")
	}
}

func TestRender_MissingStyles(t *testing.T) {
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "modul-ajar.html"), []byte("<html>{{STYLES}}</html>"), 0644)

	_, err := Render(tmpDir, map[string]string{})
	if err == nil {
		t.Error("expected error for missing styles.css")
	}
}

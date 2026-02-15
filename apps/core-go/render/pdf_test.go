package render

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPDFRenderSmoke(t *testing.T) {
	if !IsPDFRenderAvailable() {
		t.Skip("PDF render not available (Playwright missing?)")
	}

	html := `<!DOCTYPE html><html><body><h1>Hello PDF</h1><p>Smoke test.</p></body></html>`
	tmpPDF := filepath.Join(os.TempDir(), "smoke-test.pdf")
	defer os.Remove(tmpPDF)

	result, err := RenderPDF(html, tmpPDF)
	if err != nil {
		t.Fatalf("RenderPDF failed: %v", err)
	}

	if result.Status != "ok" {
		t.Errorf("status = %s, want ok", result.Status)
	}
	if result.SizeBytes == 0 {
		t.Error("pdf size is 0")
	}

	// Verify file exists
	info, err := os.Stat(tmpPDF)
	if err != nil {
		t.Fatalf("output pdf not found: %v", err)
	}
	if info.Size() == 0 {
		t.Error("output pdf file is empty")
	}

	t.Logf("PDF generated: %s (%d bytes)", tmpPDF, info.Size())
}

func TestFindRenderScript(t *testing.T) {
	script := findRenderScript()
	if script == "" {
		t.Skip("pdf_render.js not found - skipping")
	}
	if !strings.HasSuffix(script, "pdf_render.js") {
		t.Errorf("unexpected script path: %s", script)
	}
}

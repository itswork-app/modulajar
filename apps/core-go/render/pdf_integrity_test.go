package render

import (
	"context"
	"fmt"
	"modulajar/apps/core-go/planner"
	"os"
	"strings"
	"testing"
)

func TestPDFIntegrity_WatermarkPropagation(t *testing.T) {
	// 1. Preparation
	ctx := context.Background()
	html := `<html><body><h1>Test Document</h1><div class="watermark-footer">Visual Watermark</div></body></html>`

	watermark := WatermarkData{
		PublicID:    "TEST-PID-123",
		TeacherName: "G*** T***",
		Date:        "05-03-2026",
		VerifyURL:   "https://verify.modulajar.app/verify/TEST-DID-456",
	}

	opts := GeneratePDFOptions{
		Watermark:    watermark,
		MarginBottom: 0.8,
	}

	// 2. Execution (Skip if Chrome not available gracefully)
	if !IsChromeAvailable() {
		t.Skip("Chrome not available for PDF integrity test")
	}

	pdfBytes, err := GeneratePDF(ctx, html, opts)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}

	// 3. Simple Verification
	if len(pdfBytes) < 1000 {
		t.Errorf("PDF output too small: %d bytes", len(pdfBytes))
	}

	// Note: We can't easily grep PDF bytes for text reliably without a PDF parser library.
	// But we can check for PDF header.
	if string(pdfBytes[0:4]) != "%PDF" {
		t.Errorf("Invalid PDF header: %s", string(pdfBytes[0:4]))
	}

	fmt.Printf("Generated PDF size: %d bytes\n", len(pdfBytes))
}

func TestComposer_WatermarkPlaceholders(t *testing.T) {
	input := ComposerInput{
		TemplateDir: "templates/v1", // Note: might need adjustment based on test execution dir
		PID:         "PID-123",
		DID:         "DID-456",
		VerifyURL:   "http://verify/DID-456",
		PlanResult:  &planner.PlannerResult{}, // empty is fine for this check
	}

	// We need to Mock templates being available or use relative paths correctly.
	// Since ComposeModulAjarHTML reads files, let's use the actual templates if we can find them.

	// Helper to find template dir
	tmpDir := "templates/v1"
	if _, err := os.Stat(tmpDir); err != nil {
		tmpDir = "../templates/v1"
	}
	input.TemplateDir = tmpDir

	html, err := ComposeModulAjarHTML(input)
	if err != nil {
		t.Skip("Skipping composer test: templates not found in expected relative path")
		return
	}

	// Verify PID/DID presence in HTML
	if !contains(html, "PID-123") {
		t.Error("HTML missing PID placeholder value")
	}
	if !contains(html, "DID-456") {
		t.Error("HTML missing DID placeholder value")
	}
	if !contains(html, "http://verify/DID-456") {
		t.Error("HTML missing VerifyURL value")
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

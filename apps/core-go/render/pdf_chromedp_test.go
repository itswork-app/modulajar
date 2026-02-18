package render

import (
	"context"
	"testing"
)

func TestIsChromeAvailable(t *testing.T) {
	// Just logging result, not failing if strict env not set
	avail := IsChromeAvailable()
	t.Logf("Chrome available: %v", avail)
}

func TestGeneratePDF(t *testing.T) {
	if !IsChromeAvailable() {
		t.Skip("Skipping PDF generation test: Chrome not found")
	}

	// Verify Chrome is actually runnable
	ctx := context.Background()
	if err := CheckChromeReadiness(ctx); err != nil {
		t.Skipf("Skipping PDF generation test: Chrome binary found but not ready/runnable: %v", err)
	}

	html := "<html><body><h1>Hello PDF</h1><p>Test Content</p></body></html>"
	opts := GeneratePDFOptions{
		Watermark: WatermarkData{
			PublicID:    "PID-123",
			TeacherName: "Masked Teacher",
			Date:        "2026-02-17",
			VerifyURL:   "https://verify.example.com/PID-123",
		},
	}

	pdfBytes, err := GeneratePDF(context.Background(), html, opts)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}

	if len(pdfBytes) == 0 {
		t.Error("Generated PDF is empty")
	}

	// Verify header signature of PDF
	if string(pdfBytes[:4]) != "%PDF" {
		t.Error("Invalid PDF header")
	}
}

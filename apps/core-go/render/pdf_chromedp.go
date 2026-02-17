package render

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// GeneratePDFOptions holds configuration for PDF generation.
type GeneratePDFOptions struct {
	Watermark    WatermarkData
	MarginBottom float64 // in inches (default ~1.0)
}

// WatermarkData contains fields for the footer watermark.
type WatermarkData struct {
	PublicID    string
	TeacherName string // Should be masked by caller if needed
	Date        string
	VerifyURL   string
}

// GeneratePDF converts HTML content to PDF bytes using headless Chrome.
// It requires a running Chrome/Chromium instance or binary available in PATH.
func GeneratePDF(ctx context.Context, htmlContent string, opts GeneratePDFOptions) ([]byte, error) {
	// Check if Chrome is available
	if !IsChromeAvailable() {
		return nil, fmt.Errorf("chrome/chromium binary not found")
	}

	// Create allocator context (manages chrome process)
	optsAllocator := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.NoSandbox, // Required for Docker/Cloud Run
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, optsAllocator...)
	defer cancelAlloc()

	// Create browser context
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Ensure timeout
	ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var buf []byte

	// Footer template
	// CSS within footer template must be inline or user agent stylesheet.
	// standard style: font-size 10px, centered, light gray.
	footerHTML := fmt.Sprintf(`
		<div style="font-size: 8px; color: #888; text-align: center; width: 100%%; padding-bottom: 5px;">
			modulajar.app — %s — %s — %s — Verify: %s
		</div>`,
		opts.Watermark.PublicID,
		opts.Watermark.TeacherName,
		opts.Watermark.Date,
		opts.Watermark.VerifyURL,
	)

	// Run tasks
	// 1. Navigate to dummy page with content
	// 2. PrintToPDF
	// Note: We use "data:text/html" or write to file.
	// Writing to file covers local assets better if we set BaseURL?
	// For now, assume pure HTML or "data:" URI.
	// Using ActionFunc to handle the flow.

	// Create temp file for robust asset loading if needed, or just set content.
	// setContent is easier if no relative assets.

	if err := chromedp.Run(ctx,
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			// Set content
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, htmlContent).Do(ctx)
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			// Generate PDF
			// Margins: Top 0.4, Bottom: 0.8 (for footer), Left/Right 0.4 inches
			var err error
			buf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithDisplayHeaderFooter(true).
				WithFooterTemplate(footerHTML).
				WithMarginTop(0.4).
				WithMarginBottom(0.8).
				WithMarginLeft(0.4).
				WithMarginRight(0.4).
				Do(ctx)
			return err
		}),
	); err != nil {
		return nil, fmt.Errorf("chromedp run failed: %w", err)
	}

	return buf, nil
}

// IsChromeAvailable checks if chrome/google-chrome/chromium/chromium-browser is in PATH.
func IsChromeAvailable() bool {
	bins := []string{"google-chrome", "chromium", "chromium-browser", "chrome"}
	for _, bin := range bins {
		if _, err := exec.LookPath(bin); err == nil {
			return true
		}
	}
	return os.Getenv("CHROME_BIN") != ""
}

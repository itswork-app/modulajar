package render

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// PDFRenderResult holds the result from the Playwright PDF renderer.
type PDFRenderResult struct {
	Status    string `json:"status"`
	Output    string `json:"output"`
	SizeBytes int64  `json:"size_bytes"`
}

// RenderPDF invokes the Node.js Playwright renderer to generate a PDF from HTML content.
// It writes the HTML to a temp file, calls pdf_render.js, and returns the result.
// Returns an error if Playwright/Node is not available or rendering fails.
func RenderPDF(htmlContent string, outputPath string) (*PDFRenderResult, error) {
	// Write HTML to temp file
	tmpFile, err := os.CreateTemp("", "modulajar-html-*.html")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp HTML file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(htmlContent); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("failed to write temp HTML: %w", err)
	}
	tmpFile.Close()

	// Find pdf_render.js relative to this package
	scriptPath := findRenderScript()
	if scriptPath == "" {
		return nil, fmt.Errorf("pdf_render.js not found")
	}

	// Ensure output directory exists
	outDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output dir: %w", err)
	}

	// Execute: node pdf_render.js --html <tmpfile> --out <outputPath>
	cmd := exec.Command("node", scriptPath, "--html", tmpFile.Name(), "--out", outputPath)
	cmd.Stderr = os.Stderr

	stdout, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("pdf_render.js failed: %w", err)
	}

	var result PDFRenderResult
	if err := json.Unmarshal(stdout, &result); err != nil {
		return nil, fmt.Errorf("failed to parse pdf_render.js output: %w (raw: %s)", err, string(stdout))
	}

	return &result, nil
}

// IsPDFRenderAvailable checks if Node.js and Playwright are available.
func IsPDFRenderAvailable() bool {
	// Check node is available
	if _, err := exec.LookPath("node"); err != nil {
		return false
	}
	// Check the render script exists
	if findRenderScript() == "" {
		return false
	}
	// Probe: can node actually import playwright?
	cmd := exec.Command("node", "-e", "require('playwright')")
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

// findRenderScript locates pdf_render.js in multiple candidate paths.
func findRenderScript() string {
	candidates := []string{
		filepath.Join("render", "pdf_render.js"),
		filepath.Join("..", "render", "pdf_render.js"),              // from worker/
		filepath.Join(".", "pdf_render.js"),                         // same dir
		filepath.Join("apps", "core-go", "render", "pdf_render.js"), // from root
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

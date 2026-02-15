// Package template provides the v1 HTML template renderer for Modul Ajar.
// This is a naive placeholder-replacement renderer — no full composer logic.
package template

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// TemplateDir returns the path to the v1 template directory.
func TemplateDir() string {
	// Resolve relative to this module
	return filepath.Join("templates", "v1")
}

// RequiredPlaceholders lists all slot placeholders that must exist in the template.
var RequiredPlaceholders = []string{
	"{{TITLE}}",
	"{{TEACHER_NAME}}",
	"{{SCHOOL_NAME}}",
	"{{KELAS}}",
	"{{SEMESTER}}",
	"{{TAHUN_AJARAN}}",
	"{{SUBJECT_NAME}}",
	"{{ATP_TABLE}}",
	"{{ACTIVITY_SECTIONS}}",
	"{{ASSESSMENT_SECTION}}",
	"{{PID}}",
	"{{DID}}",
	"{{VERIFY_URL}}",
	"{{STYLES}}",
}

// RenderSample reads the template and sample.json, replaces placeholders,
// and returns the resulting HTML string.
func RenderSample(templateDir string) (string, error) {
	// Read template
	templatePath := filepath.Join(templateDir, "modul-ajar.html")
	html, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template: %w", err)
	}

	// Read styles
	stylesPath := filepath.Join(templateDir, "styles.css")
	css, err := os.ReadFile(stylesPath)
	if err != nil {
		return "", fmt.Errorf("failed to read styles: %w", err)
	}

	// Read sample data
	samplePath := filepath.Join(templateDir, "sample.json")
	sampleBytes, err := os.ReadFile(samplePath)
	if err != nil {
		return "", fmt.Errorf("failed to read sample data: %w", err)
	}

	var data map[string]string
	if err := json.Unmarshal(sampleBytes, &data); err != nil {
		return "", fmt.Errorf("failed to parse sample JSON: %w", err)
	}

	// Replace {{STYLES}} first
	result := strings.Replace(string(html), "{{STYLES}}", string(css), 1)

	// Replace all other placeholders
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		result = strings.ReplaceAll(result, placeholder, value)
	}

	return result, nil
}

// Render replaces placeholders in the template with provided data values.
// The `data` map keys should match placeholder names without braces (e.g., "TITLE").
func Render(templateDir string, data map[string]string) (string, error) {
	// Read template
	templatePath := filepath.Join(templateDir, "modul-ajar.html")
	html, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template: %w", err)
	}

	// Read styles
	stylesPath := filepath.Join(templateDir, "styles.css")
	css, err := os.ReadFile(stylesPath)
	if err != nil {
		return "", fmt.Errorf("failed to read styles: %w", err)
	}

	// Replace {{STYLES}} first
	result := strings.Replace(string(html), "{{STYLES}}", string(css), 1)

	// Replace all data placeholders
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		result = strings.ReplaceAll(result, placeholder, value)
	}

	return result, nil
}

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
	"{{ALL_SECTIONS}}",
	"{{PID}}",
	"{{DID}}",
	"{{VERIFY_URL}}",
	"/* STYLES_PLACEHOLDER */",
	"{{KOP_SURAT}}",
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

	// Replace /* STYLES_PLACEHOLDER */ first
	result := strings.Replace(string(html), "/* STYLES_PLACEHOLDER */", string(css), 1)

	// Replace all other placeholders
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		result = strings.ReplaceAll(result, placeholder, value)
	}

	result = strings.ReplaceAll(result, "{{KOP_SURAT}}", "")

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

	// Replace /* STYLES_PLACEHOLDER */ first
	result := strings.Replace(string(html), "/* STYLES_PLACEHOLDER */", string(css), 1)

	// Replace all data placeholders (excluding custom HTML blocks evaluated natively)
	for key, value := range data {
		if key == "KOP_SURAT" || strings.HasPrefix(key, "LETTERHEAD_") || strings.HasPrefix(key, "LOGO_") {
			continue // handled separately below or ignored implicitly
		}
		placeholder := fmt.Sprintf("{{%s}}", key)
		result = strings.ReplaceAll(result, placeholder, value)
	}

	// Dynamic Kop Surat evaluation mapping
	kopHtml := buildKopSuratHtml(data)
	result = strings.ReplaceAll(result, "{{KOP_SURAT}}", kopHtml)

	return result, nil
}

func buildKopSuratHtml(data map[string]string) string {
	line1 := strings.TrimSpace(data["LETTERHEAD_LINE1"])
	line2 := strings.TrimSpace(data["LETTERHEAD_LINE2"])
	line3 := strings.TrimSpace(data["LETTERHEAD_LINE3"])
	line4 := strings.TrimSpace(data["LETTERHEAD_LINE4"])
	contact := strings.TrimSpace(data["LETTERHEAD_CONTACT"])
	logoDataURI := strings.TrimSpace(data["LOGO_DATA_URI"])

	if line1 == "" && line2 == "" && logoDataURI == "" {
		return "" // no configuration provided
	}

	var sb strings.Builder
	sb.WriteString("<div class=\"kop-surat\">\n")

	if logoDataURI != "" {
		sb.WriteString(fmt.Sprintf("    <img class=\"kop-logo\" src=\"%s\" alt=\"Logo\" />\n", logoDataURI))
	}

	sb.WriteString("    <div class=\"kop-content\">\n")

	if line1 != "" {
		sb.WriteString(fmt.Sprintf("        <div class=\"kop-line1\">%s</div>\n", line1))
	}
	if line2 != "" {
		sb.WriteString(fmt.Sprintf("        <div class=\"kop-line2\">%s</div>\n", line2))
	}
	if line3 != "" {
		sb.WriteString(fmt.Sprintf("        <div class=\"kop-line3\">%s</div>\n", line3))
	}
	if line4 != "" {
		sb.WriteString(fmt.Sprintf("        <div class=\"kop-line4\">%s</div>\n", line4))
	}
	if contact != "" {
		sb.WriteString(fmt.Sprintf("        <div class=\"kop-contact\">%s</div>\n", contact))
	}

	sb.WriteString("    </div>\n</div>\n")
	return sb.String()
}

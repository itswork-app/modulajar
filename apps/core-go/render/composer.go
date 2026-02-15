package render

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"modulajar/apps/core-go/planner"
)

// ComposerInput contains all data needed to compose a Modul Ajar HTML document.
type ComposerInput struct {
	TemplateDir string // path to templates/v1/
	SubjectCode string
	SubjectName string
	Title       string
	TeacherName string
	SchoolName  string
	Kelas       string
	Semester    string
	TahunAjaran string
	PID         string
	DID         string
	VerifyURL   string
	PlanResult  *planner.PlannerResult
}

// ComposeModulAjarHTML loads the template, builds fragments, replaces all placeholders,
// and returns the final render-ready HTML string.
// Deterministic: same input always produces identical output.
func ComposeModulAjarHTML(input ComposerInput) (string, error) {
	// 1. Load template
	templatePath := filepath.Join(input.TemplateDir, "modul-ajar.html")
	tmplBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template: %w", err)
	}

	// 2. Load CSS
	cssPath := filepath.Join(input.TemplateDir, "styles.css")
	cssBytes, err := os.ReadFile(cssPath)
	if err != nil {
		return "", fmt.Errorf("failed to read styles: %w", err)
	}

	// 3. Build fragments
	atpTable := BuildATPTable(input.PlanResult, input.SubjectCode)
	activitySections := BuildActivitySections(input.PlanResult, input.SubjectCode)
	assessmentSection := BuildAssessmentSection(input.SubjectName)

	// 4. Build title if not provided
	title := input.Title
	if title == "" {
		title = fmt.Sprintf("Modul Ajar %s Kelas %s %s %s",
			input.SubjectName, input.Kelas, input.Semester, input.TahunAjaran)
	}

	// 5. Replace all placeholders (deterministic order)
	html := string(tmplBytes)
	replacements := map[string]string{
		"{{STYLES}}":             string(cssBytes),
		"{{TITLE}}":              title,
		"{{TEACHER_NAME}}":       input.TeacherName,
		"{{SCHOOL_NAME}}":        input.SchoolName,
		"{{KELAS}}":              input.Kelas,
		"{{SEMESTER}}":           input.Semester,
		"{{TAHUN_AJARAN}}":       input.TahunAjaran,
		"{{SUBJECT_NAME}}":       input.SubjectName,
		"{{ATP_TABLE}}":          atpTable,
		"{{ACTIVITY_SECTIONS}}":  activitySections,
		"{{ASSESSMENT_SECTION}}": assessmentSection,
		"{{PID}}":                input.PID,
		"{{DID}}":                input.DID,
		"{{VERIFY_URL}}":         input.VerifyURL,
	}

	for placeholder, value := range replacements {
		html = strings.ReplaceAll(html, placeholder, value)
	}

	return html, nil
}

// HasUnresolvedPlaceholders checks if any {{...}} placeholders remain in the HTML.
func HasUnresolvedPlaceholders(html string) bool {
	return strings.Contains(html, "{{") && strings.Contains(html, "}}")
}

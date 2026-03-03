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

	// Letterhead Config (Optional)
	LetterheadLine1   string
	LetterheadLine2   string
	LetterheadLine3   string
	LetterheadLine4   string
	LetterheadContact string
	LogoDataURI       string
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
		"{{KOP_SURAT}}":          buildKopSuratHtml(input),
	}

	for placeholder, value := range replacements {
		html = strings.ReplaceAll(html, placeholder, value)
	}

	return html, nil
}

func buildKopSuratHtml(input ComposerInput) string {
	line1 := strings.TrimSpace(input.LetterheadLine1)
	line2 := strings.TrimSpace(input.LetterheadLine2)
	line3 := strings.TrimSpace(input.LetterheadLine3)
	line4 := strings.TrimSpace(input.LetterheadLine4)
	contact := strings.TrimSpace(input.LetterheadContact)
	logoDataURI := strings.TrimSpace(input.LogoDataURI)

	if line1 == "" && line2 == "" && logoDataURI == "" {
		return ""
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

// HasUnresolvedPlaceholders checks if any {{...}} placeholders remain in the HTML.
func HasUnresolvedPlaceholders(html string) bool {
	return strings.Contains(html, "{{") && strings.Contains(html, "}}")
}

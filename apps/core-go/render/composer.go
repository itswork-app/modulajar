package render

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"modulajar/apps/core-go/curriculum"
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

	// AI Generated Results (Optional)
	ModulAjarSD4     *curriculum.ModulAjarSD4
	LegacyCurriculum *curriculum.Curriculum
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
		"/* STYLES_PLACEHOLDER */": string(cssBytes),
		"{{TITLE}}":                title,
		"{{TEACHER_NAME}}":         input.TeacherName,
		"{{SCHOOL_NAME}}":          input.SchoolName,
		"{{KELAS}}":                input.Kelas,
		"{{SEMESTER}}":             input.Semester,
		"{{TAHUN_AJARAN}}":         input.TahunAjaran,
		"{{SUBJECT_NAME}}":         input.SubjectName,
		"{{ATP_TABLE}}":            atpTable,
		"{{ACTIVITY_SECTIONS}}":    activitySections,
		"{{ASSESSMENT_SECTION}}":   assessmentSection,
		"{{PID}}":                  input.PID,
		"{{DID}}":                  input.DID,
		"{{VERIFY_URL}}":           input.VerifyURL,
		"{{KOP_SURAT}}":            buildKopSuratHtml(input),
	}

	// 6. Override with AI Content if present
	if input.ModulAjarSD4 != nil {
		m := input.ModulAjarSD4
		replacements["{{SUBJECT_NAME}}"] = m.Identitas.MataPelajaran
		replacements["{{KELAS}}"] = fmt.Sprintf("%d", m.Identitas.Kelas)
		replacements["{{SEMESTER}}"] = m.Identitas.Semester

		// Build Activity Sections from AI
		var actSb strings.Builder
		actSb.WriteString(`<div class="activity-unit">`)
		actSb.WriteString(`<h3 class="activity-unit-title">Tujuan Pembelajaran</h3>`)
		actSb.WriteString(fmt.Sprintf(`<div class="activity-content"><p>%s</p></div>`, m.TujuanPembelajaran))
		actSb.WriteString(`<h3 class="activity-unit-title">Materi Pembelajaran</h3>`)
		actSb.WriteString(fmt.Sprintf(`<div class="activity-content"><p>%s</p></div>`, m.MateriPembelajaran))

		actSb.WriteString(`<h3 class="activity-unit-title">Kegiatan Pembelajaran</h3>`)
		actSb.WriteString(`<div class="activity-content">`)
		actSb.WriteString(fmt.Sprintf(`<p><strong>Pendahuluan:</strong><br/>%s</p>`, m.KegiatanPembelajaran.Pendahuluan))
		actSb.WriteString(fmt.Sprintf(`<p><strong>Inti:</strong><br/>%s</p>`, m.KegiatanPembelajaran.Inti))
		actSb.WriteString(fmt.Sprintf(`<p><strong>Penutup:</strong><br/>%s</p>`, m.KegiatanPembelajaran.Penutup))
		actSb.WriteString(`</div>`)
		actSb.WriteString(`</div>`)
		replacements["{{ACTIVITY_SECTIONS}}"] = actSb.String()

		// Build Assessment from AI
		var assSb strings.Builder
		assSb.WriteString(`<div class="assessment-block">`)
		assSb.WriteString(`<h3 class="assessment-type">Sikap</h3>`)
		assSb.WriteString(fmt.Sprintf(`<p>%s</p>`, m.Penilaian.Sikap))
		assSb.WriteString(`</div>`)
		assSb.WriteString(`<div class="assessment-block">`)
		assSb.WriteString(`<h3 class="assessment-type">Pengetahuan</h3>`)
		assSb.WriteString(fmt.Sprintf(`<p>%s</p>`, m.Penilaian.Pengetahuan))
		assSb.WriteString(`</div>`)
		assSb.WriteString(`<div class="assessment-block">`)
		assSb.WriteString(`<h3 class="assessment-type">Keterampilan</h3>`)
		assSb.WriteString(fmt.Sprintf(`<p>%s</p>`, m.Penilaian.Keterampilan))
		assSb.WriteString(`</div>`)
		replacements["{{ASSESSMENT_SECTION}}"] = assSb.String()
	} else if input.LegacyCurriculum != nil {
		c := input.LegacyCurriculum
		replacements["{{SUBJECT_NAME}}"] = c.Meta.Mapel
		replacements["{{KELAS}}"] = c.Meta.Kelas
		replacements["{{SEMESTER}}"] = c.Meta.Semester
		// Legacy curriculum used arrays, we can join them or use existing logic if it was using fragments.
		// For now just keep it minimal or use what it had.
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

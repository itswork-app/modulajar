package render

import (
	"fmt"
	"strings"

	"modulajar/apps/core-go/planner"
)

// BuildActivitySections generates HTML activity section fragments from planner units.
// v1: structured unit blocks with title, week range, and outcome references.
// Deterministic: units are in planner order (already sorted by unit_no).
func BuildActivitySections(result *planner.PlannerResult, subjectCode string) string {
	// Find SubjectPlan
	var plan *planner.SubjectPlan
	for i := range result.SemesterPlan.SubjectPlans {
		if result.SemesterPlan.SubjectPlans[i].SubjectCode == subjectCode {
			plan = &result.SemesterPlan.SubjectPlans[i]
			break
		}
	}
	if plan == nil {
		return "<p><em>Tidak ada data kegiatan pembelajaran untuk mata pelajaran ini.</em></p>"
	}

	// Find ATP for outcome descriptions
	outcomeDescs := make(map[string]string)
	for _, atp := range result.Atps {
		if atp.SubjectCode == subjectCode {
			for _, tp := range atp.TpItems {
				outcomeDescs[tp.OutcomeCode] = tp.Description
			}
			break
		}
	}

	var sb strings.Builder

	for _, unit := range plan.Units {
		sb.WriteString(`<div class="activity-unit">`)
		sb.WriteString(fmt.Sprintf(
			`<h3 class="activity-unit-title">Unit %d — %s (Minggu %d–%d)</h3>`,
			unit.UnitNo, unit.Title, unit.StartWeek, unit.EndWeek,
		))
		sb.WriteString(`<div class="activity-content">`)

		// List outcomes covered in this unit
		sb.WriteString(`<p><strong>Capaian Pembelajaran:</strong></p>`)
		sb.WriteString(`<ul>`)
		for _, oc := range unit.OutcomeCodes {
			desc := outcomeDescs[oc]
			if desc == "" {
				desc = "(deskripsi belum tersedia)"
			}
			sb.WriteString(fmt.Sprintf(`<li><strong>%s</strong>: %s</li>`, oc, desc))
		}
		sb.WriteString(`</ul>`)

		// v1 placeholder activities
		sb.WriteString(`<p><strong>Langkah Pembelajaran:</strong></p>`)
		sb.WriteString(`<ol>`)
		sb.WriteString(`<li>Pembukaan dan apersepsi (15 menit)</li>`)
		sb.WriteString(`<li>Kegiatan inti sesuai tujuan pembelajaran (90 menit)</li>`)
		sb.WriteString(`<li>Refleksi dan penutup (15 menit)</li>`)
		sb.WriteString(`</ol>`)

		sb.WriteString(`</div>`)
		sb.WriteString(`</div>`)
	}

	return sb.String()
}

// BuildAssessmentSection generates a default v1 assessment section.
// v1: structured but generic assessment blocks. Future versions will be AI-enriched.
func BuildAssessmentSection(subjectName string) string {
	var sb strings.Builder

	sb.WriteString(`<div class="assessment-block">`)
	sb.WriteString(`<h3 class="assessment-type">Asesmen Formatif</h3>`)
	sb.WriteString(fmt.Sprintf(`<p>Observasi harian, tugas tertulis, dan diskusi kelompok terkait materi %s.</p>`, subjectName))
	sb.WriteString(`</div>`)

	sb.WriteString(`<div class="assessment-block">`)
	sb.WriteString(`<h3 class="assessment-type">Asesmen Sumatif</h3>`)
	sb.WriteString(fmt.Sprintf(`<p>Tes tulis akhir unit, portofolio tugas %s, dan presentasi hasil belajar.</p>`, subjectName))
	sb.WriteString(`</div>`)

	return sb.String()
}

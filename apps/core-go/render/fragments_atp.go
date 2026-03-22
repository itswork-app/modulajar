// Package render provides deterministic HTML composition for Modul Ajar documents.
// It builds HTML fragments from planner output and composes final render-ready HTML.
package render

import (
	"fmt"
	"strings"

	"modulajar/apps/core-go/planner"
)

// BuildATPTable generates an HTML table fragment from planner ATP data for a given subject.
// Deterministic: rows are ordered by TP code as produced by the planner (which is already sorted).
func BuildATPTable(result *planner.PlannerResult, subjectCode string) string {
	// Find ATP for this subject
	var atp *planner.Atp
	for i := range result.Atps {
		if result.Atps[i].SubjectCode == subjectCode {
			atp = &result.Atps[i]
			break
		}
	}
	if atp == nil {
		return "<p><em>Tidak ada data ATP untuk mata pelajaran ini.</em></p>"
	}

	// Find SubjectPlan for week ranges
	var plan *planner.SubjectPlan
	for i := range result.SemesterPlan.SubjectPlans {
		if result.SemesterPlan.SubjectPlans[i].SubjectCode == subjectCode {
			plan = &result.SemesterPlan.SubjectPlans[i]
			break
		}
	}

	// Build unit lookup: outcome_code → unit info
	type unitInfo struct {
		unitNo    int
		title     string
		startWeek int
		endWeek   int
	}
	outcomeToUnit := make(map[string]unitInfo)
	if plan != nil {
		for _, u := range plan.Units {
			for _, oc := range u.OutcomeCodes {
				outcomeToUnit[oc] = unitInfo{
					unitNo:    u.UnitNo,
					title:     u.Title,
					startWeek: u.StartWeek,
					endWeek:   u.EndWeek,
				}
			}
		}
	}

	var sb strings.Builder
	sb.WriteString(`<table class="atp-table">`)
	sb.WriteString(`<thead><tr>`)
	sb.WriteString(`<th>No</th>`)
	sb.WriteString(`<th>Kode TP</th>`)
	sb.WriteString(`<th>Tujuan Pembelajaran</th>`)
	sb.WriteString(`<th>Capaian Pembelajaran</th>`)
	sb.WriteString(`<th>Unit</th>`)
	sb.WriteString(`<th>Minggu</th>`)
	sb.WriteString(`</tr></thead>`)
	sb.WriteString(`<tbody>`)

	for i, tp := range atp.TpItems {
		unitStr := "-"
		weekStr := "-"
		if info, ok := outcomeToUnit[tp.OutcomeCode]; ok {
			unitStr = fmt.Sprintf("Unit %d", info.unitNo)
			weekStr = fmt.Sprintf("%d–%d", info.startWeek, info.endWeek)
		}

		sb.WriteString(`<tr>`)
		sb.WriteString(fmt.Sprintf(`<td>%d</td>`, i+1))
		sb.WriteString(fmt.Sprintf(`<td>%s</td>`, tp.Code))
		sb.WriteString(fmt.Sprintf(`<td>%s</td>`, tp.Description))
		sb.WriteString(fmt.Sprintf(`<td>%s</td>`, tp.OutcomeCode))
		sb.WriteString(fmt.Sprintf(`<td>%s</td>`, unitStr))
		sb.WriteString(fmt.Sprintf(`<td>%s</td>`, weekStr))
		sb.WriteString(`</tr>`)
	}

	sb.WriteString(`</tbody></table>`)
	return sb.String()
}

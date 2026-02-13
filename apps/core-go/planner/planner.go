package planner

import (
	"fmt"
	"sort"

	"modulajar/apps/core-go/packloader"
)

// Plan generates a deterministic PlannerResult from a CurriculumPack and config.
func Plan(input PlannerInput) (*PlannerResult, error) {
	pack := input.Pack
	config := input.Config

	if pack == nil {
		return nil, fmt.Errorf("pack is nil")
	}
	if len(pack.Subjects) == 0 {
		return nil, fmt.Errorf("pack has no subjects")
	}
	if config.WeeksEffective <= 0 {
		return nil, fmt.Errorf("weeks_effective must be > 0")
	}

	// Sort subjects by code for deterministic ordering
	subjects := make([]packloader.Subject, len(pack.Subjects))
	copy(subjects, pack.Subjects)
	sort.Slice(subjects, func(i, j int) bool {
		return subjects[i].Code < subjects[j].Code
	})

	atps := make([]Atp, 0, len(subjects))
	subjectPlans := make([]SubjectPlan, 0, len(subjects))

	for _, subj := range subjects {
		// Slice outcomes for the target semester
		semesterOutcomes := SliceOutcomesForSemester(subj.Outcomes, config.Semester)

		// Build ATP (1 TP = 1 outcome for v1)
		tpItems := make([]TpItem, 0, len(semesterOutcomes))
		outcomeCodes := make([]string, 0, len(semesterOutcomes))
		for _, o := range semesterOutcomes {
			tpItems = append(tpItems, TpItem{
				Code:        "TP-" + o.Code,
				Description: o.Description,
				OutcomeCode: o.Code,
			})
			outcomeCodes = append(outcomeCodes, o.Code)
		}

		atps = append(atps, Atp{
			SubjectCode: subj.Code,
			SubjectName: subj.Name,
			TpItems:     tpItems,
		})

		// Build semester plan units
		units := DistributeUnits(outcomeCodes, config.WeeksEffective)

		subjectPlans = append(subjectPlans, SubjectPlan{
			SubjectCode: subj.Code,
			SubjectName: subj.Name,
			Units:       units,
		})
	}

	return &PlannerResult{
		PackID:   pack.PackID,
		Semester: config.Semester,
		Atps:     atps,
		SemesterPlan: SemesterPlan{
			Semester:       config.Semester,
			WeeksEffective: config.WeeksEffective,
			SubjectPlans:   subjectPlans,
		},
	}, nil
}

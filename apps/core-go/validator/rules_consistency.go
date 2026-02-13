package validator

import (
	"fmt"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

// CheckConsistency validates outcome code references, no duplicates, and unit numbering.
func CheckConsistency(pack *packloader.CurriculumPack, result *planner.PlannerResult) []ValidationError {
	var errs []ValidationError

	// Build a map of valid outcome codes per subject
	validOutcomes := map[string]map[string]bool{}
	for _, s := range pack.Subjects {
		codes := map[string]bool{}
		for _, o := range s.Outcomes {
			codes[o.Code] = true
		}
		validOutcomes[s.Code] = codes
	}

	for _, sp := range result.SemesterPlan.SubjectPlans {
		subjectCodes, ok := validOutcomes[sp.SubjectCode]

		// Check unit numbering: 1..N no gaps
		for i, u := range sp.Units {
			expected := i + 1
			if u.UnitNo != expected {
				errs = append(errs, ValidationError{
					Code:        "CON_UNIT_GAP",
					Category:    "consistency",
					Message:     fmt.Sprintf("expected unit_no=%d, got %d", expected, u.UnitNo),
					SubjectCode: sp.SubjectCode,
				})
			}
		}

		// Track seen outcomes for duplicate detection
		seen := map[string]int{} // outcome_code -> unit_no where first seen

		for _, u := range sp.Units {
			for _, code := range u.OutcomeCodes {
				// Check outcome code exists in pack for this subject
				if ok && !subjectCodes[code] {
					errs = append(errs, ValidationError{
						Code:        "CON_INVALID_OUTCOME",
						Category:    "consistency",
						Message:     fmt.Sprintf("outcome '%s' not found in pack for subject '%s'", code, sp.SubjectCode),
						SubjectCode: sp.SubjectCode,
					})
				}

				// Check for duplicate outcome across units (strict)
				if prevUnit, dup := seen[code]; dup {
					errs = append(errs, ValidationError{
						Code:        "CON_DUPLICATE_OUTCOME",
						Category:    "consistency",
						Message:     fmt.Sprintf("outcome '%s' appears in both unit %d and unit %d", code, prevUnit, u.UnitNo),
						SubjectCode: sp.SubjectCode,
					})
				}
				seen[code] = u.UnitNo
			}
		}
	}

	return errs
}

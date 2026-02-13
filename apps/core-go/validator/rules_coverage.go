package validator

import (
	"fmt"
	"math"
	"sort"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

// CheckCoverage validates that all expected S1 outcomes are present and no S2 outcomes leak in.
func CheckCoverage(pack *packloader.CurriculumPack, result *planner.PlannerResult) []ValidationError {
	var errs []ValidationError

	// Build a map of pack subjects by code
	packSubjects := map[string]packloader.Subject{}
	for _, s := range pack.Subjects {
		packSubjects[s.Code] = s
	}

	for _, sp := range result.SemesterPlan.SubjectPlans {
		packSubj, ok := packSubjects[sp.SubjectCode]
		if !ok {
			errs = append(errs, ValidationError{
				Code:        "COV_UNKNOWN_SUBJECT",
				Category:    "coverage",
				Message:     fmt.Sprintf("subject '%s' not found in pack", sp.SubjectCode),
				SubjectCode: sp.SubjectCode,
			})
			continue
		}

		// Compute expected S1 outcomes: first ceil(n/2) sorted by code
		sorted := make([]packloader.Outcome, len(packSubj.Outcomes))
		copy(sorted, packSubj.Outcomes)
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Code < sorted[j].Code
		})

		splitAt := int(math.Ceil(float64(len(sorted)) / 2.0))
		expectedS1 := map[string]bool{}
		s2Outcomes := map[string]bool{}
		for i, o := range sorted {
			if i < splitAt {
				expectedS1[o.Code] = true
			} else {
				s2Outcomes[o.Code] = true
			}
		}

		// Collect all outcome codes used in this subject's plan
		usedOutcomes := map[string]bool{}
		for _, u := range sp.Units {
			for _, code := range u.OutcomeCodes {
				usedOutcomes[code] = true
			}
		}

		// Check all expected S1 outcomes are present
		for code := range expectedS1 {
			if !usedOutcomes[code] {
				errs = append(errs, ValidationError{
					Code:        "COV_MISSING_OUTCOME",
					Category:    "coverage",
					Message:     fmt.Sprintf("expected S1 outcome '%s' not found in plan", code),
					SubjectCode: sp.SubjectCode,
				})
			}
		}

		// Check no S2 outcomes leaked into S1 (strict)
		for code := range usedOutcomes {
			if s2Outcomes[code] {
				errs = append(errs, ValidationError{
					Code:        "COV_S2_LEAK",
					Category:    "coverage",
					Message:     fmt.Sprintf("S2 outcome '%s' found in S1 plan (strict mode)", code),
					SubjectCode: sp.SubjectCode,
				})
			}
		}
	}

	return errs
}

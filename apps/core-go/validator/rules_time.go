package validator

import (
	"fmt"

	"modulajar/apps/core-go/planner"
)

// CheckTime validates week ranges and non-overlap within the semester plan.
func CheckTime(result *planner.PlannerResult) []ValidationError {
	var errs []ValidationError

	sp := result.SemesterPlan

	if sp.WeeksEffective <= 0 {
		errs = append(errs, ValidationError{
			Code:     "TIME_INVALID_WEEKS",
			Category: "time",
			Message:  fmt.Sprintf("weeks_effective must be > 0, got %d", sp.WeeksEffective),
		})
		return errs
	}

	for _, subj := range sp.SubjectPlans {
		if len(subj.Units) == 0 {
			continue
		}

		prevEnd := 0
		for _, u := range subj.Units {
			// start_week >= 1
			if u.StartWeek < 1 {
				errs = append(errs, ValidationError{
					Code:        "TIME_START_BELOW_1",
					Category:    "time",
					Message:     fmt.Sprintf("unit %d start_week=%d < 1", u.UnitNo, u.StartWeek),
					SubjectCode: subj.SubjectCode,
				})
			}

			// end_week <= weeks_effective
			if u.EndWeek > sp.WeeksEffective {
				errs = append(errs, ValidationError{
					Code:        "TIME_END_EXCEEDS",
					Category:    "time",
					Message:     fmt.Sprintf("unit %d end_week=%d > weeks_effective=%d", u.UnitNo, u.EndWeek, sp.WeeksEffective),
					SubjectCode: subj.SubjectCode,
				})
			}

			// start_week <= end_week
			if u.StartWeek > u.EndWeek {
				errs = append(errs, ValidationError{
					Code:        "TIME_INVERTED_RANGE",
					Category:    "time",
					Message:     fmt.Sprintf("unit %d start_week=%d > end_week=%d", u.UnitNo, u.StartWeek, u.EndWeek),
					SubjectCode: subj.SubjectCode,
				})
			}

			// No overlap with previous unit
			if u.UnitNo > 1 && u.StartWeek <= prevEnd {
				errs = append(errs, ValidationError{
					Code:        "TIME_OVERLAP",
					Category:    "time",
					Message:     fmt.Sprintf("unit %d start_week=%d overlaps with previous end_week=%d", u.UnitNo, u.StartWeek, prevEnd),
					SubjectCode: subj.SubjectCode,
				})
			}

			prevEnd = u.EndWeek
		}
	}

	return errs
}

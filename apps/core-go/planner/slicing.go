package planner

import (
	"math"
	"sort"

	"modulajar/apps/core-go/packloader"
)

// SliceOutcomesForSemester returns the outcomes for the given semester.
// S1: first ceil(n/2) outcomes (sorted by code).
// S2: remaining outcomes.
func SliceOutcomesForSemester(outcomes []packloader.Outcome, semester string) []packloader.Outcome {
	if len(outcomes) == 0 {
		return nil
	}

	// Sort by code for deterministic ordering
	sorted := make([]packloader.Outcome, len(outcomes))
	copy(sorted, outcomes)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Code < sorted[j].Code
	})

	splitAt := int(math.Ceil(float64(len(sorted)) / 2.0))

	switch semester {
	case "S1":
		return sorted[:splitAt]
	case "S2":
		return sorted[splitAt:]
	default:
		return sorted[:splitAt] // default to S1
	}
}

// DistributeUnits distributes outcomes into units across the effective weeks.
// Each unit gets approximately equal weeks and at least one outcome.
func DistributeUnits(outcomeCodes []string, weeksEffective int) []Unit {
	n := len(outcomeCodes)
	if n == 0 {
		return nil
	}

	units := make([]Unit, 0, n)
	weeksPerUnit := float64(weeksEffective) / float64(n)

	for i, code := range outcomeCodes {
		startWeek := int(math.Floor(float64(i)*weeksPerUnit)) + 1
		endWeek := int(math.Floor(float64(i+1) * weeksPerUnit))
		if endWeek < startWeek {
			endWeek = startWeek
		}
		if i == n-1 {
			endWeek = weeksEffective // last unit absorbs remainder
		}

		units = append(units, Unit{
			UnitNo:       i + 1,
			Title:        "Unit " + itoa(i+1),
			StartWeek:    startWeek,
			EndWeek:      endWeek,
			OutcomeCodes: []string{code},
		})
	}

	return units
}

// itoa is a simple int-to-string without importing strconv.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

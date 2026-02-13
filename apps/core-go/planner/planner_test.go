package planner

import (
	"encoding/json"
	"math"
	"path/filepath"
	"testing"

	"modulajar/apps/core-go/packloader"
)

func loadTestPack(t *testing.T) *packloader.CurriculumPack {
	t.Helper()
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		t.Fatalf("failed to load pack: %v", err)
	}
	return pack
}

// TestPlanDeterministic verifies the same input always produces identical output (golden test).
func TestPlanDeterministic(t *testing.T) {
	pack := loadTestPack(t)
	config := DefaultConfig()
	input := PlannerInput{Pack: pack, Config: config}

	result1, err := Plan(input)
	if err != nil {
		t.Fatalf("Plan failed: %v", err)
	}

	result2, err := Plan(input)
	if err != nil {
		t.Fatalf("Plan failed on second run: %v", err)
	}

	json1, _ := json.Marshal(result1)
	json2, _ := json.Marshal(result2)

	if string(json1) != string(json2) {
		t.Fatal("planner output is non-deterministic: two runs produced different JSON")
	}

	t.Logf("Deterministic: %d bytes of identical JSON output", len(json1))
}

// TestS1OutcomeCounts verifies that S1 takes ceil(n/2) outcomes per subject.
func TestS1OutcomeCounts(t *testing.T) {
	pack := loadTestPack(t)
	config := DefaultConfig()
	input := PlannerInput{Pack: pack, Config: config}

	result, err := Plan(input)
	if err != nil {
		t.Fatalf("Plan failed: %v", err)
	}

	// Build a map of total outcomes per subject from the pack
	totalOutcomes := map[string]int{}
	for _, s := range pack.Subjects {
		totalOutcomes[s.Code] = len(s.Outcomes)
	}

	for _, atp := range result.Atps {
		total := totalOutcomes[atp.SubjectCode]
		expectedS1 := int(math.Ceil(float64(total) / 2.0))
		actual := len(atp.TpItems)

		if actual != expectedS1 {
			t.Errorf("subject %s: expected S1 outcomes = ceil(%d/2) = %d, got %d",
				atp.SubjectCode, total, expectedS1, actual)
		}
		t.Logf("subject %s: total=%d, S1=%d ✓", atp.SubjectCode, total, actual)
	}
}

// TestWeekRangesValid verifies week ranges are within weeks_effective and non-overlapping.
func TestWeekRangesValid(t *testing.T) {
	pack := loadTestPack(t)
	config := DefaultConfig()
	input := PlannerInput{Pack: pack, Config: config}

	result, err := Plan(input)
	if err != nil {
		t.Fatalf("Plan failed: %v", err)
	}

	for _, sp := range result.SemesterPlan.SubjectPlans {
		if len(sp.Units) == 0 {
			t.Errorf("subject %s: no units generated", sp.SubjectCode)
			continue
		}

		prevEnd := 0
		for _, u := range sp.Units {
			if u.StartWeek < 1 {
				t.Errorf("subject %s unit %d: start_week %d < 1", sp.SubjectCode, u.UnitNo, u.StartWeek)
			}
			if u.EndWeek > config.WeeksEffective {
				t.Errorf("subject %s unit %d: end_week %d > weeks_effective %d",
					sp.SubjectCode, u.UnitNo, u.EndWeek, config.WeeksEffective)
			}
			if u.StartWeek <= prevEnd && u.UnitNo > 1 {
				t.Errorf("subject %s unit %d: start_week %d overlaps with previous end_week %d",
					sp.SubjectCode, u.UnitNo, u.StartWeek, prevEnd)
			}
			if u.EndWeek < u.StartWeek {
				t.Errorf("subject %s unit %d: end_week %d < start_week %d",
					sp.SubjectCode, u.UnitNo, u.EndWeek, u.StartWeek)
			}
			prevEnd = u.EndWeek
		}

		// Last unit should end at weeks_effective
		lastUnit := sp.Units[len(sp.Units)-1]
		if lastUnit.EndWeek != config.WeeksEffective {
			t.Errorf("subject %s: last unit end_week = %d, expected %d",
				sp.SubjectCode, lastUnit.EndWeek, config.WeeksEffective)
		}

		t.Logf("subject %s: %d units, weeks 1-%d ✓", sp.SubjectCode, len(sp.Units), lastUnit.EndWeek)
	}
}

// TestPlanNilPack verifies error handling for nil pack.
func TestPlanNilPack(t *testing.T) {
	_, err := Plan(PlannerInput{Pack: nil, Config: DefaultConfig()})
	if err == nil {
		t.Fatal("expected error for nil pack")
	}
}

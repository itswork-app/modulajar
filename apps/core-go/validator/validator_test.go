package validator

import (
	"path/filepath"
	"testing"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

func loadPackAndPlan(t *testing.T) (*packloader.CurriculumPack, *planner.PlannerResult) {
	t.Helper()
	packPath := filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json")
	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		t.Fatalf("failed to load pack: %v", err)
	}

	config := planner.DefaultConfig()
	result, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		t.Fatalf("failed to plan: %v", err)
	}
	return pack, result
}

// TestHappyPath validates the real planner output passes all rules.
func TestHappyPath(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if !report.OK {
		for _, e := range report.Errors {
			t.Errorf("[%s] %s: %s", e.Category, e.Code, e.Message)
		}
		t.Fatal("expected OK=true for valid planner output")
	}

	t.Logf("Validation passed: 0 errors, %d warnings", len(report.Warnings))
}

// TestCoverageMissingOutcome verifies missing outcome is caught.
func TestCoverageMissingOutcome(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	// Remove first outcome from first subject's first unit
	if len(result.SemesterPlan.SubjectPlans) > 0 && len(result.SemesterPlan.SubjectPlans[0].Units) > 0 {
		result.SemesterPlan.SubjectPlans[0].Units[0].OutcomeCodes = []string{}
		// Also remove from ATP
		if len(result.Atps) > 0 && len(result.Atps[0].TpItems) > 0 {
			result.Atps[0].TpItems = result.Atps[0].TpItems[1:]
		}
	}

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if report.OK {
		t.Fatal("expected validation to fail for missing outcome")
	}

	found := false
	for _, e := range report.Errors {
		if e.Code == "COV_MISSING_OUTCOME" {
			found = true
			t.Logf("Caught: %s — %s", e.Code, e.Message)
		}
	}
	if !found {
		t.Fatal("expected COV_MISSING_OUTCOME error")
	}
}

// TestTimeOutOfBounds verifies out-of-bounds week is caught.
func TestTimeOutOfBounds(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	// Set end_week beyond weeks_effective
	if len(result.SemesterPlan.SubjectPlans) > 0 && len(result.SemesterPlan.SubjectPlans[0].Units) > 0 {
		last := len(result.SemesterPlan.SubjectPlans[0].Units) - 1
		result.SemesterPlan.SubjectPlans[0].Units[last].EndWeek = 25
	}

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if report.OK {
		t.Fatal("expected validation to fail for out-of-bounds week")
	}

	found := false
	for _, e := range report.Errors {
		if e.Code == "TIME_END_EXCEEDS" {
			found = true
			t.Logf("Caught: %s — %s", e.Code, e.Message)
		}
	}
	if !found {
		t.Fatal("expected TIME_END_EXCEEDS error")
	}
}

// TestTimeOverlappingUnits verifies overlapping units are caught.
func TestTimeOverlappingUnits(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	// Create overlap by setting the second unit start before first unit end
	if len(result.SemesterPlan.SubjectPlans) > 0 && len(result.SemesterPlan.SubjectPlans[0].Units) > 1 {
		result.SemesterPlan.SubjectPlans[0].Units[1].StartWeek = 1
	}

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if report.OK {
		t.Fatal("expected validation to fail for overlapping units")
	}

	found := false
	for _, e := range report.Errors {
		if e.Code == "TIME_OVERLAP" {
			found = true
			t.Logf("Caught: %s — %s", e.Code, e.Message)
		}
	}
	if !found {
		t.Fatal("expected TIME_OVERLAP error")
	}
}

// TestConsistencyInvalidOutcome verifies invalid outcome code is caught.
func TestConsistencyInvalidOutcome(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	// Inject a bogus outcome code
	if len(result.SemesterPlan.SubjectPlans) > 0 && len(result.SemesterPlan.SubjectPlans[0].Units) > 0 {
		result.SemesterPlan.SubjectPlans[0].Units[0].OutcomeCodes = append(
			result.SemesterPlan.SubjectPlans[0].Units[0].OutcomeCodes,
			"FAKE-99",
		)
	}

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if report.OK {
		t.Fatal("expected validation to fail for invalid outcome code")
	}

	foundInvalid := false
	for _, e := range report.Errors {
		if e.Code == "CON_INVALID_OUTCOME" {
			foundInvalid = true
			t.Logf("Caught: %s — %s", e.Code, e.Message)
		}
	}
	if !foundInvalid {
		t.Fatal("expected CON_INVALID_OUTCOME error")
	}
}

// TestConsistencyDuplicateOutcome verifies duplicate outcome across units is caught.
func TestConsistencyDuplicateOutcome(t *testing.T) {
	pack, result := loadPackAndPlan(t)

	// Duplicate first outcome into second unit
	if len(result.SemesterPlan.SubjectPlans) > 0 &&
		len(result.SemesterPlan.SubjectPlans[0].Units) > 1 &&
		len(result.SemesterPlan.SubjectPlans[0].Units[0].OutcomeCodes) > 0 {
		dupCode := result.SemesterPlan.SubjectPlans[0].Units[0].OutcomeCodes[0]
		result.SemesterPlan.SubjectPlans[0].Units[1].OutcomeCodes = append(
			result.SemesterPlan.SubjectPlans[0].Units[1].OutcomeCodes,
			dupCode,
		)
	}

	report, err := Validate(ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if report.OK {
		t.Fatal("expected validation to fail for duplicate outcome")
	}

	found := false
	for _, e := range report.Errors {
		if e.Code == "CON_DUPLICATE_OUTCOME" {
			found = true
			t.Logf("Caught: %s — %s", e.Code, e.Message)
		}
	}
	if !found {
		t.Fatal("expected CON_DUPLICATE_OUTCOME error")
	}
}

// TestNilInputs verifies error handling for nil inputs.
func TestNilInputs(t *testing.T) {
	_, err := Validate(ValidatorInput{Pack: nil, Result: nil})
	if err == nil {
		t.Fatal("expected error for nil pack")
	}
}

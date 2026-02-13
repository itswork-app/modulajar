package planner

import (
	"modulajar/apps/core-go/packloader"
)

// PlannerConfig holds configuration for the planner.
type PlannerConfig struct {
	Semester       string // "S1" or "S2"
	WeeksEffective int    // default: 18
	SlicingPolicy  string // "proportional" (default)
}

// DefaultConfig returns the default planner configuration for v1.
func DefaultConfig() PlannerConfig {
	return PlannerConfig{
		Semester:       "S1",
		WeeksEffective: 18,
		SlicingPolicy:  "proportional",
	}
}

// PlannerInput is the input to the planner.
type PlannerInput struct {
	Pack   *packloader.CurriculumPack
	Config PlannerConfig
}

// --- Output types ---

// TpItem represents a Tujuan Pembelajaran (derived from outcome).
type TpItem struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	OutcomeCode string `json:"outcome_code"`
}

// Atp represents the ATP (Alur Tujuan Pembelajaran) for one subject.
type Atp struct {
	SubjectCode string   `json:"subject_code"`
	SubjectName string   `json:"subject_name"`
	TpItems     []TpItem `json:"tp_items"`
}

// Unit represents one teaching unit within a semester plan.
type Unit struct {
	UnitNo       int      `json:"unit_no"`
	Title        string   `json:"title"`
	StartWeek    int      `json:"start_week"`
	EndWeek      int      `json:"end_week"`
	OutcomeCodes []string `json:"outcome_codes"`
}

// SubjectPlan represents the semester plan for one subject.
type SubjectPlan struct {
	SubjectCode string `json:"subject_code"`
	SubjectName string `json:"subject_name"`
	Units       []Unit `json:"units"`
}

// SemesterPlan represents the full semester plan.
type SemesterPlan struct {
	Semester       string        `json:"semester"`
	WeeksEffective int           `json:"weeks_effective"`
	SubjectPlans   []SubjectPlan `json:"subject_plans"`
}

// PlannerResult is the complete output of the planner.
type PlannerResult struct {
	PackID       string       `json:"pack_id"`
	Semester     string       `json:"semester"`
	Atps         []Atp        `json:"atps"`
	SemesterPlan SemesterPlan `json:"semester_plan"`
}

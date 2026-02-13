package validator

import (
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

// ValidationError represents a validation failure.
type ValidationError struct {
	Code        string `json:"code"`
	Category    string `json:"category"` // "coverage", "time", "consistency"
	Message     string `json:"message"`
	SubjectCode string `json:"subject_code,omitempty"`
}

// ValidationWarning represents a non-fatal issue.
type ValidationWarning struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	SubjectCode string `json:"subject_code,omitempty"`
}

// ValidationReport is the output of the validator.
type ValidationReport struct {
	OK       bool                `json:"ok"`
	Errors   []ValidationError   `json:"errors"`
	Warnings []ValidationWarning `json:"warnings"`
}

// ValidatorInput is the input to the validator.
type ValidatorInput struct {
	Pack   *packloader.CurriculumPack
	Result *planner.PlannerResult
}

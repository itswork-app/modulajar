package validator

import "fmt"

// Validate runs all validation rules and returns a report.
func Validate(input ValidatorInput) (*ValidationReport, error) {
	if input.Pack == nil {
		return nil, fmt.Errorf("pack is nil")
	}
	if input.Result == nil {
		return nil, fmt.Errorf("result is nil")
	}

	var allErrors []ValidationError

	// Run all rule categories
	allErrors = append(allErrors, CheckCoverage(input.Pack, input.Result)...)
	allErrors = append(allErrors, CheckTime(input.Result)...)
	allErrors = append(allErrors, CheckConsistency(input.Pack, input.Result)...)

	report := &ValidationReport{
		OK:       len(allErrors) == 0,
		Errors:   allErrors,
		Warnings: []ValidationWarning{},
	}

	return report, nil
}

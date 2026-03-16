package qeval

import (
	"fmt"

	"modulajar/apps/core-go/curriculum"
)

func Evaluate(input interface{}) (QualityResult, error) {
	switch v := input.(type) {
	case *curriculum.ModulAjarMerdeka:
		// EvaluateMerdeka now returns only QualityResult, no error
		return EvaluateMerdeka(v), nil
	case *curriculum.Curriculum:
		return EvaluateLegacy(v), nil
	default:
		return QualityResult{}, fmt.Errorf("unknown curriculum type: %T", input)
	}
}

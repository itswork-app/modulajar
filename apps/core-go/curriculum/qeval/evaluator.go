package qeval

import (
	"fmt"

	"modulajar/apps/core-go/curriculum"
)

func Evaluate(input interface{}) (QualityResult, error) {
	switch v := input.(type) {
	case *curriculum.ModulAjarSD4:
		return EvaluateSD4(v), nil
	case *curriculum.Curriculum:
		return EvaluateLegacy(v), nil
	default:
		return QualityResult{}, fmt.Errorf("unknown curriculum type: %T", input)
	}
}

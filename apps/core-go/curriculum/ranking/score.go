package ranking

import (
	"math"
)

// CalculateScore computes the final rank score for a candidate.
// Formula: (quality_score * 0.6) + (log(usage_count + 1) * 0.2) + (similarity * 0.2)
// Input:
//   - quality: 0-100
//   - usage: 0 to N
//   - similarity: 0.0-1.0
//
// Output: 0-100 (approx)
func CalculateScore(quality int, usage int, similarity float64) float64 {
	// 1. Normalized Quality (0-60 points)
	qScore := float64(quality) * 0.6

	// 2. Usage popularity (Weighted 0-20 points)
	// We use log10 to dampen high usage numbers.
	// log10(100) = 2. Max usage of interest around 100-1000.
	uScore := math.Log10(float64(usage)+1) * 10.0 // log10(101) is ~2, so 20 points
	if uScore > 20.0 {
		uScore = 20.0
	}

	// 3. Similarity (0-20 points)
	sScore := similarity * 20.0

	return qScore + uScore + sScore
}

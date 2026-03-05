package ranking

import (
	"sort"
)

// SelectTopTemplates ranks candidates based on topic similarity and other signals,
// then returns the top 3 results.
func SelectTopTemplates(candidates []TemplateCandidate, targetTopic string) []RankedTemplate {
	if len(candidates) == 0 {
		return nil
	}

	ranked := make([]RankedTemplate, 0, len(candidates))

	for _, c := range candidates {
		similarity := ComputeSimilarity(targetTopic, c.Topic)
		score := CalculateScore(c.QualityScore, c.UsageCount, similarity)

		ranked = append(ranked, RankedTemplate{
			Candidate: c,
			RankScore: score,
		})
	}

	// Sort by rank score descending
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].RankScore > ranked[j].RankScore
	})

	// Take top 3
	limit := 3
	if len(ranked) < limit {
		limit = len(ranked)
	}

	return ranked[:limit]
}

package ranking

import (
	"regexp"
	"strings"
)

var wordRegex = regexp.MustCompile(`[\p{L}\d]+`)

// ComputeSimilarity calculates the Jaccard similarity between two topic strings.
// It tokenizes the strings, converts them to lower case, and calculates (A ∩ B) / (A ∪ B).
func ComputeSimilarity(topicA, topicB string) float64 {
	setA := tokenize(topicA)
	setB := tokenize(topicB)

	if len(setA) == 0 && len(setB) == 0 {
		return 1.0
	}
	if len(setA) == 0 || len(setB) == 0 {
		return 0.0
	}

	intersection := 0
	for word := range setA {
		if _, exists := setB[word]; exists {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	return float64(intersection) / float64(union)
}

func tokenize(s string) map[string]struct{} {
	words := wordRegex.FindAllString(strings.ToLower(s), -1)
	set := make(map[string]struct{})
	for _, w := range words {
		if len(w) > 1 { // skip single char particles
			set[w] = struct{}{}
		}
	}
	return set
}

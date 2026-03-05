package ranking

import (
	"github.com/google/uuid"
)

// TemplateCandidate represents a curriculum document from the dataset
// that is a candidate for few-shot ranking.
type TemplateCandidate struct {
	ID           uuid.UUID `json:"id"`
	Subject      string    `json:"subject"`
	Grade        int       `json:"grade"`
	Topic        string    `json:"topic"`
	ModuleJSON   []byte    `json:"module_json"`
	QualityScore int       `json:"quality_score"`
	UsageCount   int       `json:"usage_count"`
}

// RankedTemplate holds a candidate along with its computed ranking score.
type RankedTemplate struct {
	Candidate TemplateCandidate
	RankScore float64
}

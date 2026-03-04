package dataset

import "github.com/google/uuid"

// DatasetCandidate represents a curriculum document ready to be stored in the knowledge base.
type DatasetCandidate struct {
	ID           uuid.UUID `json:"id"`
	Subject      string    `json:"subject"`
	Grade        int       `json:"grade"`
	Topic        string    `json:"topic"`
	ModuleJSON   []byte    `json:"module_json"`
	QualityScore int       `json:"quality_score"`
}

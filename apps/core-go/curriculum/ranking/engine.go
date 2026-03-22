package ranking

import (
	"context"
	"fmt"

	"modulajar/apps/core-go/db"

	"github.com/google/uuid"
)

type DBQueryFunc func(ctx context.Context, subject string, grade int) ([]db.DatasetEntry, error)

var DBQuery DBQueryFunc = db.GetTemplateCandidates

// GetTemplateCandidates fetches potential templates from the dataset.
func GetTemplateCandidates(ctx context.Context, subject string, grade int) ([]TemplateCandidate, error) {
	entries, err := DBQuery(ctx, subject, grade)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch templates from db: %w", err)
	}

	candidates := make([]TemplateCandidate, 0, len(entries))
	for _, e := range entries {
		id, err := uuid.Parse(e.ID)
		if err != nil {
			continue // skip invalid IDs
		}

		candidates = append(candidates, TemplateCandidate{
			ID:           id,
			Subject:      e.Subject,
			Grade:        e.Grade,
			Topic:        e.Topic,
			ModuleJSON:   e.ModuleJSON,
			QualityScore: e.QualityScore,
			UsageCount:   e.UsageCount,
		})
	}

	return candidates, nil
}

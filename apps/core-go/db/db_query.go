package db

import (
	"context"
	"fmt"
)

// GetTemplateCandidates fetches up to 50 high-quality curriculum documents
// for a specific subject and grade, ordered by quality score.
func GetTemplateCandidates(ctx context.Context, subject string, grade int) ([]DatasetEntry, error) {
	if pool == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	query := `
		SELECT id, subject, grade, topic, module_json, quality_score, usage_count, original_hash
		FROM curriculum_dataset
		WHERE subject = $1 AND grade = $2
		ORDER BY quality_score DESC
		LIMIT 50
	`

	rows, err := pool.Query(ctx, query, subject, grade)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []DatasetEntry
	for rows.Next() {
		var entry DatasetEntry
		err := rows.Scan(
			&entry.ID,
			&entry.Subject,
			&entry.Grade,
			&entry.Topic,
			&entry.ModuleJSON,
			&entry.QualityScore,
			&entry.UsageCount,
			&entry.OriginalHash,
		)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// IncrementDatasetUsage increments the usage_count for a specific dataset entry.
func IncrementDatasetUsage(ctx context.Context, id string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `UPDATE curriculum_dataset SET usage_count = usage_count + 1 WHERE id = $1`
	_, err := pool.Exec(ctx, query, id)
	return err
}

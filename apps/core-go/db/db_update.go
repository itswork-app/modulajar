package db

import (
	"context"
	"encoding/json"
	"fmt"
)

// UpdateJobMetadata updates the metadata of a job (merges with existing).
func UpdateJobMetadata(ctx context.Context, jobID string, metadata map[string]interface{}) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Use || operator to merge JSONB
	query := `UPDATE generation_jobs SET metadata = metadata || $1 WHERE id = $2`
	_, err = pool.Exec(ctx, query, metadataJSON, jobID)
	return err
}

package db

import (
	"context"
	"encoding/json"
	"fmt"
)

// UpdateJobMetadata updates the metadata of a job (merges with existing).
func UpdateJobMetadata(ctx context.Context, workspaceID string, jobID string, metadata map[string]interface{}) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Use || operator to merge JSONB
	query := `UPDATE generation_jobs SET metadata = metadata || $1 WHERE id = $2 AND workspace_id = $3`
	_, err = pool.Exec(ctx, query, metadataJSON, jobID, workspaceID)
	return err
}

// SaveDocument upserts a document.
func SaveDocument(ctx context.Context, doc Document) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	metadataJSON, err := json.Marshal(doc.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		INSERT INTO documents (id, workspace_id, package_id, public_id, subject_code, version, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (workspace_id, public_id) 
		DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata, version = EXCLUDED.version
	`
	_, err = pool.Exec(ctx, query,
		doc.ID, doc.WorkspaceID, doc.PackageID, doc.PublicID,
		doc.SubjectCode, doc.Version, doc.Status, metadataJSON,
	)
	return err
}

// UpdateDocumentStatus updates the status of a document.
func UpdateDocumentStatus(ctx context.Context, workspaceID string, publicID string, status string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `UPDATE documents SET status = $1 WHERE workspace_id = $2 AND public_id = $3`
	_, err := pool.Exec(ctx, query, status, workspaceID, publicID)
	return err
}

// UpdateDocumentMetadata updates the metadata of a document (merges).
func UpdateDocumentMetadata(ctx context.Context, workspaceID string, publicID string, metadata map[string]interface{}) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `UPDATE documents SET metadata = metadata || $1 WHERE workspace_id = $2 AND public_id = $3`
	_, err = pool.Exec(ctx, query, metadataJSON, workspaceID, publicID)
	return err
}

// InsertDatasetEntry adds a high-quality curriculum document to the dataset collector.
// It uses ON CONFLICT (original_hash) DO NOTHING to prevent duplicates.
// Returns true if inserted, false if skipped as duplicate.
func InsertDatasetEntry(ctx context.Context, entry DatasetEntry) (bool, error) {
	if pool == nil {
		return false, fmt.Errorf("database not initialized")
	}

	query := `
		INSERT INTO curriculum_dataset (id, subject, grade, topic, module_json, quality_score, original_hash)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (original_hash) DO NOTHING
	`
	cmd, err := pool.Exec(ctx, query,
		entry.ID, entry.Subject, entry.Grade, entry.Topic,
		entry.ModuleJSON, entry.QualityScore, entry.OriginalHash,
	)
	if err != nil {
		return false, err
	}
	return cmd.RowsAffected() > 0, nil
}

package db

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var pool *pgxpool.Pool

// Init initializes the database connection pool.
func Init(ctx context.Context) error {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL must be set")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	// Configure pool
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.HealthCheckPeriod = 1 * time.Minute

	p, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("failed to create pool: %w", err)
	}

	if err := p.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping db: %w", err)
	}

	pool = p
	return nil
}

// Close closes the database connection pool.
func Close() {
	if pool != nil {
		pool.Close()
	}
}

// GenerationJob represents a job row.
type GenerationJob struct {
	ID           string
	WorkspaceID  string
	GenerationID string
	PackageID    string
	Status       string
	AttemptCount int
	Metadata     map[string]interface{}
}

// AcquireJob atomically acquires the next available queued job.
// It uses FOR UPDATE SKIP LOCKED to ensure only one worker processes a job.
func AcquireJob(ctx context.Context) (*GenerationJob, error) {
	if pool == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Atomic Acquire Query
	query := `
		WITH next_job AS (
			SELECT id
			FROM generation_jobs
			WHERE status = 'queued'
			  AND next_run_at <= NOW()
			ORDER BY created_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE generation_jobs j
		SET
			status = 'running',
			locked_at = NOW(),
			attempt_count = attempt_count + 1,
			next_run_at = NOW() + (INTERVAL '1 second' * POWER(2, attempt_count + 1)) -- default backoff, overridden on failure
		FROM next_job
		WHERE j.id = next_job.id
		RETURNING j.id, j.workspace_id, j.generation_id, j.package_id, j.status, j.attempt_count, j.metadata
	`

	var job GenerationJob
	var metadataJSON []byte

	err = tx.QueryRow(ctx, query).Scan(
		&job.ID,
		&job.WorkspaceID,
		&job.GenerationID,
		&job.PackageID,
		&job.Status,
		&job.AttemptCount,
		&metadataJSON,
	)

	if err == pgx.ErrNoRows {
		return nil, nil // No job available
	}
	if err != nil {
		return nil, fmt.Errorf("failed to acquire job: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &job.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &job, nil
}

// MarkJobDone updates the job status to 'done'.
func MarkJobDone(ctx context.Context, jobID string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `
		UPDATE generation_jobs
		SET status = 'done', locked_at = NULL
		WHERE id = $1
	`
	_, err := pool.Exec(ctx, query, jobID)
	return err
}

// MarkJobFailed updates the job status to 'queued' (retry) or 'failed' (max attempts).
func MarkJobFailed(ctx context.Context, jobID string, errMsg string, attemptCount int) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	// Exponential backoff: 5s, 10s, 20s, 40s, 80s
	// Max attempts: 5. If attempt_count >= 5, mark as 'failed'.
	// attempt_count was already incremented during Acquire.
	// So if current attempt_count is 5, and it failed, we mark as failed.

	maxAttempts := 5
	status := "queued"
	if attemptCount >= maxAttempts {
		status = "failed"
	}

	// Calculate next_run_at
	// Base delay: 5 seconds.
	// Delay = 5 * 2^(attempt_count - 1)
	// If attempt_count=1 (first retry), delay=5.
	// If attempt_count=2, delay=10.
	backoffSeconds := 5 * (1 << (attemptCount - 1))
	if backoffSeconds < 5 {
		backoffSeconds = 5 // Minimum 5s
	}

	intervalStr := fmt.Sprintf("%d seconds", backoffSeconds)

	// If failed, next_run_at doesn't matter much but keep it for record
	query := `
		UPDATE generation_jobs
		SET
			status = $1,
			last_error = $2,
			next_run_at = NOW() + $3::INTERVAL,
			locked_at = NULL
		WHERE id = $4
	`
	// Status updates logic
	_, err := pool.Exec(ctx, query, status, errMsg, intervalStr, jobID)
	return err
}

// UpdatePackageStatus updates the status of a package.
func UpdatePackageStatus(ctx context.Context, packageID string, status string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `UPDATE packages SET status = $1 WHERE id = $2`
	_, err := pool.Exec(ctx, query, status, packageID)
	return err
}

// QueueStats holds queue depth metrics.
type QueueStats struct {
	Queued  int
	Running int
	Failed  int
}

// GetQueueStats returns the count of jobs in each status.
func GetQueueStats(ctx context.Context) (QueueStats, error) {
	if pool == nil {
		return QueueStats{}, fmt.Errorf("database not initialized")
	}

	query := `
		SELECT
			count(*) FILTER (WHERE status = 'queued') as queued,
			count(*) FILTER (WHERE status = 'running') as running,
			count(*) FILTER (WHERE status = 'failed') as failed
		FROM generation_jobs
	`
	var s QueueStats
	err := pool.QueryRow(ctx, query).Scan(&s.Queued, &s.Running, &s.Failed)
	return s, err
}

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
		pool = nil
	}
}

// Ping checks the database connection.
func Ping(ctx context.Context) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}
	return pool.Ping(ctx)
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

// Document represents a document row.
type Document struct {
	ID          string
	WorkspaceID string
	PackageID   string
	PublicID    string
	SubjectCode string
	Version     int
	Status      string
	Metadata    map[string]interface{}
}

// DatasetEntry represents a row in the curriculum_dataset table.
type DatasetEntry struct {
	ID           string
	Subject      string
	Grade        int
	Topic        string
	ModuleJSON   []byte
	QualityScore int
	UsageCount   int
	OriginalHash string
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

	// Atomic Acquire Query with Workspace Settings joined
	query := `
		WITH next_job AS (
			SELECT id, workspace_id
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
			next_run_at = NOW() + (INTERVAL '1 second' * POWER(2, attempt_count + 1))
		FROM next_job
		LEFT JOIN workspace_settings ws ON next_job.workspace_id = ws.workspace_id
		WHERE j.id = next_job.id
		RETURNING 
			j.id, 
			j.workspace_id, 
			j.generation_id, 
			j.package_id, 
			j.status, 
			j.attempt_count, 
			j.metadata,
			ws.letterhead_line1,
			ws.letterhead_line2,
			ws.letterhead_line3,
			ws.letterhead_line4,
			ws.letterhead_contact,
			ws.logo_file_path
	`

	var job GenerationJob
	var metadataJSON []byte

	// Letterhead Optional Fields
	var l1, l2, l3, l4, contact, logo *string

	err = tx.QueryRow(ctx, query).Scan(
		&job.ID,
		&job.WorkspaceID,
		&job.GenerationID,
		&job.PackageID,
		&job.Status,
		&job.AttemptCount,
		&metadataJSON,
		&l1,
		&l2,
		&l3,
		&l4,
		&contact,
		&logo,
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

	// Merge Letterhead fields into Metadata if they exist
	if l1 != nil {
		job.Metadata["letterhead_line1"] = *l1
	}
	if l2 != nil {
		job.Metadata["letterhead_line2"] = *l2
	}
	if l3 != nil {
		job.Metadata["letterhead_line3"] = *l3
	}
	if l4 != nil {
		job.Metadata["letterhead_line4"] = *l4
	}
	if contact != nil {
		job.Metadata["letterhead_contact"] = *contact
	}
	if logo != nil {
		job.Metadata["logo_file_path"] = *logo
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &job, nil
}

// MarkJobDone updates the job status to 'done', and atomically evaluates referral rewards.
func MarkJobDone(ctx context.Context, workspaceID string, jobID string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	// Atomically:
	// 1. Update the generation_job to 'done'
	// 2. Find the workspace_id that owns this job
	// 3. Check if that workspace has an UNREWARDED referral
	// 4. Update the referral to reward_granted = true
	// 5. Insert +5 credits into the referrer's wallet
	query := `
		WITH updated_job AS (
			UPDATE generation_jobs
			SET status = 'done', locked_at = NULL
			WHERE id = $1 AND workspace_id = $2
			RETURNING workspace_id
		),
		updated_referral AS (
			UPDATE referrals r
			SET reward_granted = true
			FROM updated_job uj
			WHERE r.referred_workspace = uj.workspace_id
			  AND r.reward_granted = false
			RETURNING r.referrer_workspace
		)
		INSERT INTO wallet_ledger (id, workspace_id, type, amount, reference_id)
		SELECT REPLACE(gen_random_uuid()::text, '-', '')::CHAR(26), referrer_workspace, 'credit', 5, 'referral_reward'
		FROM updated_referral;
	`
	_, err := pool.Exec(ctx, query, jobID, workspaceID)

	// If the CTE doesn't update a referral, no wallet_ledger entry is inserted.
	// The job status is always updated to 'done'.
	return err
}

// MarkJobFailed updates the job status to 'queued' (retry) or 'failed' (max attempts).
func MarkJobFailed(ctx context.Context, workspaceID string, jobID string, errMsg string, attemptCount int) error {
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
	backoffSeconds := 5
	if attemptCount > 0 {
		backoffSeconds = 5 * (1 << (attemptCount - 1))
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
		WHERE id = $4 AND workspace_id = $5
	`
	// Status updates logic
	_, err := pool.Exec(ctx, query, status, errMsg, intervalStr, jobID, workspaceID)
	return err
}

// UpdatePackageStatus updates the status of a package.
func UpdatePackageStatus(ctx context.Context, workspaceID string, packageID string, status string) error {
	if pool == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `UPDATE packages SET status = $1 WHERE workspace_id = $2 AND id = $3`
	_, err := pool.Exec(ctx, query, status, workspaceID, packageID)
	return err
}

// QueueStats holds queue depth metrics.
type QueueStats struct {
	Queued  int
	Running int
	Failed  int
	Stuck   int
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

// CountStuckJobs returns the number of jobs that are running but locked
// for longer than the given threshold in seconds.
func CountStuckJobs(ctx context.Context, thresholdSeconds int) (int, error) {
	if pool == nil {
		return 0, fmt.Errorf("database not initialized")
	}

	query := `
		SELECT count(*)
		FROM generation_jobs
		WHERE status = 'running'
		  AND locked_at IS NOT NULL
		  AND locked_at < NOW() - make_interval(secs => $1)
	`
	var count int
	err := pool.QueryRow(ctx, query, thresholdSeconds).Scan(&count)
	return count, err
}

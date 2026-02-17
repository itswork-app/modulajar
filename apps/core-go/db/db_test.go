package db_test

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"modulajar/apps/core-go/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Setup: Connect to DB and truncate generation_jobs
func setup(t *testing.T) *pgxpool.Pool {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set")
	}

	ctx := context.Background()
	if err := db.Init(ctx); err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	// Direct pool access for cleanup (we can re-use the pool from db package if exported? No, it's private 'pool')
	// But db.Init initializes the private pool.
	// We can use a separate pool for cleanup.
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect for cleanup: %v", err)
	}

	// Truncate tables to ensure clean state
	// Order matters: generation_jobs refs packages refs workspaces
	// We might need to just delete the rows we insert?
	// Truncating might affect other data if using shared DB.
	// Better to just INSERT minimal valid data for FKs.

	// We assume workspace and package exists? Or create them.
	// Let's create a test workspace and package.

	// Cleanup first
	_, err = pool.Exec(ctx, "DELETE FROM generation_jobs WHERE generation_id LIKE 'test-gen-%'")
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	return pool
}

func TestAtomicAcquire(t *testing.T) {
	pool := setup(t)
	defer pool.Close()
	ctx := context.Background()

	// 1. Seed Data
	wsID := "test-ws-01" // CHAR(26)
	// Ensure WS exists? If not, we need to create it.
	// existing schema: workspaces(id)
	// We use a dummy ID and hope FK constraints don't block us?
	// FK `workspace_id` REF `workspaces(id)`.
	// We MUST insert workspace.

	// Check if WS exists, if not insert
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=$1)", wsID).Scan(&exists)
	if err == nil && !exists {
		_, err = pool.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3)", wsID, "clerk_01", "Test WS")
		if err != nil {
			// Maybe clerk_org_id conflict? Ignore
		}
	}

	// Insert Package
	pkgID := "test-pkg-01"
	_, err = pool.Exec(ctx, `
        INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
        VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft')
        ON CONFLICT (id) DO NOTHING
    `, pkgID, wsID, "PKG-TEST-01")
	if err != nil {
		t.Logf("Pkg insert error (might exist): %v", err)
	}

	// Insert 2 Queued Jobs
	genID1 := "test-gen-01"
	genID2 := "test-gen-02"

	meta := `{"foo":"bar"}`

	_, err = pool.Exec(ctx, `
        INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, metadata, next_run_at)
        VALUES 
        ($1, $2, $3, 'queued', $4, $5, NOW()),
        ($6, $7, $8, 'queued', $9, $10, NOW())
        ON CONFLICT (workspace_id, generation_id) DO UPDATE SET status='queued', next_run_at=NOW(), attempt_count=0
    `,
		"job-01", wsID, pkgID, genID1, meta,
		"job-02", wsID, pkgID, genID2, meta)

	if err != nil {
		t.Fatalf("Failed to insert jobs: %v", err)
	}

	// 2. Concurrent Acquire
	var wg sync.WaitGroup
	wg.Add(2)

	results := make(chan *db.GenerationJob, 2)

	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			job, err := db.AcquireJob(ctx)
			if err != nil {
				t.Errorf("Acquire error: %v", err)
				return
			}
			results <- job
		}()
	}

	wg.Wait()
	close(results)

	// 3. Verify
	jobsAcquired := 0
	ids := make(map[string]bool)

	for job := range results {
		if job != nil {
			jobsAcquired++
			ids[job.ID] = true
			// Check status in memory (Acquire returns running job)
			if job.Status != "running" {
				t.Errorf("Job status should be running, got %s", job.Status)
			}
			if job.AttemptCount != 1 {
				t.Errorf("Attempt count should be 1, got %d", job.AttemptCount)
			}
		}
	}

	if jobsAcquired != 2 {
		t.Errorf("Expected 2 jobs acquired, got %d", jobsAcquired)
	}

	if len(ids) != 2 {
		t.Errorf("Expected 2 distinct job IDs, got %v", ids)
	}

	// Verify DB state
	var count int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM generation_jobs WHERE status='running' AND generation_id IN ($1, $2)", genID1, genID2).Scan(&count)
	if count != 2 {
		t.Errorf("Expected 2 running jobs in DB, got %d", count)
	}

	// Test Retry Logic
	// Fail job-01
	err = db.MarkJobFailed(ctx, "job-01", "test error", 1) // attempt 1 -> next run +5s
	if err != nil {
		t.Fatalf("MarkJobFailed error: %v", err)
	}

	// Check next_run_at > now
	var nextRun time.Time
	pool.QueryRow(ctx, "SELECT next_run_at FROM generation_jobs WHERE id=$1", "job-01").Scan(&nextRun)
	if nextRun.Before(time.Now().Add(2 * time.Second)) {
		t.Errorf("Next run at should be in future (backoff), got %v", nextRun)
	}

	// Test Max Attempts
	// Fail job-01 with attempt 5
	err = db.MarkJobFailed(ctx, "job-01", "max attempt", 5)
	if err != nil {
		t.Fatalf("MarkJobFailed error: %v", err)
	}

	var status string
	pool.QueryRow(ctx, "SELECT status FROM generation_jobs WHERE id=$1", "job-01").Scan(&status)
	if status != "failed" {
		t.Errorf("Expected status failed after 5 attempts, got %s", status)
	}

	// Cleanup
	_, err = pool.Exec(ctx, "DELETE FROM generation_jobs WHERE generation_id LIKE 'test-gen-%'")
}

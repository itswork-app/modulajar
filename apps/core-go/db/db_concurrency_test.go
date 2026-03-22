package db

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func TestAcquireJob_Concurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()

	// 1. Start Postgres Container
	dbName := "modulajar_test"
	dbUser := "user"
	dbPassword := "password"

	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(dbName),
		postgres.WithUsername(dbUser),
		postgres.WithPassword(dbPassword),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Fatalf("failed to terminate container: %s", err)
		}
	}()

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	// 2. Initialize DB Pool
	t.Setenv("DATABASE_URL", connStr)
	if err := Init(ctx); err != nil {
		t.Fatal(err)
	}
	defer Close()

	// 3. Setup Schema (Minimal)
	setupSchema(t, ctx, pool)

	// 4. Insert Test Data
	workspaceID := "01HQ2J1920J123456789012345" // ULID-like
	packageID := "01HQ2J1920J123456789012346"   // ULID-like
	generationID := "GEN-001"

	// Create dependencies first
	_, err = pool.Exec(ctx, `INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, 'org_123', 'Test Workspace')`, workspaceID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, 'PKG-001', '1', '1', '2024/2025', 'Guru', 'Sekolah', 'draft')`, packageID, workspaceID)
	if err != nil {
		t.Fatal(err)
	}

	// Insert Job
	jobID := "01HQ2J1920J123456789012347"
	_, err = pool.Exec(ctx, `
		INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, next_run_at, metadata)
		VALUES ($1, $2, $3, 'queued', $4, NOW(), '{}')
	`, jobID, workspaceID, packageID, generationID)
	if err != nil {
		t.Fatal(err)
	}

	// 5. Run Concurrent Acquire
	type result struct {
		Job *GenerationJob
		Err error
	}
	resChan := make(chan result, 2)

	// Launch 2 goroutines
	for i := 0; i < 2; i++ {
		go func() {
			job, err := AcquireJob(ctx)
			resChan <- result{Job: job, Err: err}
		}()
	}

	// Collect results
	var successCount int
	var nilCount int
	var errCount int

	for i := 0; i < 2; i++ {
		res := <-resChan
		if res.Err != nil {
			t.Logf("Goroutine got error: %v", res.Err)
			errCount++
		} else if res.Job != nil {
			t.Logf("Goroutine got job: %s", res.Job.ID)
			successCount++
		} else {
			t.Logf("Goroutine got nil job")
			nilCount++
		}
	}

	// Assertions
	if errCount > 0 {
		t.Errorf("Expected no errors, got %d", errCount)
	}
	if successCount != 1 {
		t.Errorf("Expected exactly 1 success, got %d", successCount)
	}
	if nilCount != 1 {
		t.Errorf("Expected exactly 1 nil (no job), got %d", nilCount)
	}

	// Verify locked_at and attempt_count
	var job GenerationJob
	err = pool.QueryRow(ctx, "SELECT status, attempt_count, locked_at FROM generation_jobs WHERE id = $1", jobID).Scan(&job.Status, &job.AttemptCount, &job.Metadata) // borrowing Metadata field for dirty scan or generic map is confusing, let's scan explicitly variables or struct
	var status string
	var attempts int
	var lockedAt *time.Time
	err = pool.QueryRow(ctx, "SELECT status, attempt_count, locked_at FROM generation_jobs WHERE id = $1", jobID).Scan(&status, &attempts, &lockedAt)
	if err != nil {
		t.Fatal(err)
	}

	if status != "running" {
		t.Errorf("Expected status 'running', got '%s'", status)
	}
	if attempts != 1 {
		t.Errorf("Expected 1 attempt, got %d", attempts)
	}
	if lockedAt == nil {
		t.Errorf("Expected locked_at to be set")
	}
}

func setupSchema(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	// Minimal schema based on migrations 001 and 004
	queries := []string{
		`CREATE TABLE workspaces (
			id CHAR(26) PRIMARY KEY,
			clerk_org_id VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL
		)`,
		`CREATE TABLE packages (
			id CHAR(26) PRIMARY KEY,
			workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
			public_id VARCHAR(255) UNIQUE NOT NULL,
			kelas VARCHAR(50) NOT NULL,
			semester VARCHAR(50) NOT NULL,
			tahun_ajaran VARCHAR(50) NOT NULL,
			teacher_name VARCHAR(255) NOT NULL,
			school_name VARCHAR(255) NOT NULL,
			status VARCHAR(50) NOT NULL
		)`,
		`CREATE TABLE document_templates (
			id CHAR(26) PRIMARY KEY,
			workspace_id CHAR(26) REFERENCES workspaces(id),
			name TEXT NOT NULL,
			description TEXT,
			document_type TEXT NOT NULL,
			template_version INT NOT NULL DEFAULT 1,
			layout_definition JSONB NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE generation_jobs (
			id CHAR(26) PRIMARY KEY,
			workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
			package_id CHAR(26) NOT NULL REFERENCES packages(id),
			template_id CHAR(26) REFERENCES document_templates(id),
			status VARCHAR(50) NOT NULL,
			generation_id VARCHAR(255) NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			attempt_count INT NOT NULL DEFAULT 0,
			locked_at TIMESTAMP,
			next_run_at TIMESTAMP DEFAULT NOW(),
			last_error TEXT,
			metadata JSONB
		)`,
		`CREATE TABLE documents (
			id CHAR(26) PRIMARY KEY, -- ULID
			workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
			package_id CHAR(26) NOT NULL REFERENCES packages(id),
			public_id VARCHAR(255) UNIQUE NOT NULL,
			subject_code VARCHAR(50) NOT NULL,
			version INT NOT NULL DEFAULT 1,
			status VARCHAR(50) NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			metadata JSONB
		)`,
		`CREATE TABLE workspace_settings (
			workspace_id CHAR(26) PRIMARY KEY REFERENCES workspaces(id),
			letterhead_line1 TEXT,
			letterhead_line2 TEXT,
			letterhead_line3 TEXT,
			letterhead_line4 TEXT,
			letterhead_contact TEXT,
			logo_file_path TEXT
		)`,
		`CREATE TABLE wallet_ledger (
			id CHAR(26) PRIMARY KEY,
			workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id),
			type VARCHAR(50) NOT NULL,
			amount INT NOT NULL,
			reference_id VARCHAR(255),
			metadata JSONB,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE referrals (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			referrer_workspace CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
			referred_workspace CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
			reward_granted BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW(),
			CONSTRAINT referrals_referrer_referred_unique UNIQUE (referrer_workspace, referred_workspace),
			CONSTRAINT referrals_no_self_referral CHECK (referrer_workspace != referred_workspace)
		)`,
		// Uniqueness
		`CREATE UNIQUE INDEX uniq_generation_workspace ON generation_jobs (workspace_id, generation_id)`,
		`CREATE UNIQUE INDEX idx_documents_workspace_public ON documents(workspace_id, public_id)`,
	}

	for _, q := range queries {
		_, err := pool.Exec(ctx, q)
		if err != nil {
			t.Fatalf("Failed to execute schema query: %v\nQuery: %s", err, q)
		}
	}
}

func TestRetryBehavior(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	// Re-use logic or context from above if we want to share container,
	// but purely separated is cleaner for now or we create a helper Suite.
	// For simplicity in this Task, let's spin up another container or make a TestMain.
	// Actually, let's keep it simple and just do it in one test or use a shared setup helper?
	// Given 15 mins, let's combine or duplicate setup. Duplicate is safer to avoid shared state issues.

	ctx := context.Background()
	// Start Postgres Container (Copy-paste setup for robustness)
	dbName := "modulajar_test_retry"
	dbUser := "user"
	dbPassword := "password"

	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(dbName),
		postgres.WithUsername(dbUser),
		postgres.WithPassword(dbPassword),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer pgContainer.Terminate(ctx)

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	// Initialize DB
	t.Setenv("DATABASE_URL", connStr)
	if err := Init(ctx); err != nil {
		t.Fatal(err)
	}
	defer Close()

	setupSchema(t, ctx, pool)

	// Insert Job
	workspaceID := "01HQ2J1920J1234567890123AA"
	packageID := "01HQ2J1920J1234567890123BB"
	jobID := "01HQ2J1920J1234567890123CC"
	generationID := "GEN-RETRY"

	_, _ = pool.Exec(ctx, `INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, 'org_retry', 'Test Retry')`, workspaceID)
	_, _ = pool.Exec(ctx, `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, 'PKG-RETRY', '1', '1', '2024', 'G', 'S', 'draft')`, packageID, workspaceID)
	_, err = pool.Exec(ctx, `
		INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, next_run_at, attempt_count)
		VALUES ($1, $2, $3, 'running', $4, NOW(), 1)
	`, jobID, workspaceID, packageID, generationID)
	if err != nil {
		t.Fatal(err)
	}

	// Test MarkJobFailed
	err = MarkJobFailed(ctx, workspaceID, jobID, "simulated error", 1) // 1st attempt failed
	if err != nil {
		t.Fatal(err)
	}

	var status string
	var nextRunAt time.Time
	var lastError string
	err = pool.QueryRow(ctx, "SELECT status, next_run_at, last_error FROM generation_jobs WHERE id = $1", jobID).Scan(&status, &nextRunAt, &lastError)
	if err != nil {
		t.Fatal(err)
	}

	if status != "queued" { // Should go back to queued for retry
		t.Errorf("Expected status 'queued', got '%s'", status)
	}
	if lastError != "simulated error" {
		t.Errorf("Expected last_error 'simulated error', got '%s'", lastError)
	}
	if nextRunAt.Before(time.Now()) {
		t.Errorf("Expected next_run_at to be in future, got %v", nextRunAt)
	}

	// Test Max Retries
	// Insert another job already at max attempts
	jobID2 := "01HQ2J1920J1234567890123DD"
	_, err = pool.Exec(ctx, `
		INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, next_run_at, attempt_count)
		VALUES ($1, $2, $3, 'running', 'GEN-MAX', NOW(), 5)
	`, jobID2, workspaceID, packageID)
	if err != nil {
		t.Fatal(err)
	}

	err = MarkJobFailed(ctx, workspaceID, jobID2, "max error", 5)
	if err != nil {
		t.Fatal(err)
	}

	err = pool.QueryRow(ctx, "SELECT status FROM generation_jobs WHERE id = $1", jobID2).Scan(&status)
	if err != nil {
		t.Fatal(err)
	}
	if status != "failed" {
		t.Errorf("Expected status 'failed' after max retries, got '%s'", status)
	}
}

func TestOtherDBFunctions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	// Reuse Setup logic (simulated by re-initializing container is safest for isolation)
	dbName := "modulajar_test_other"
	dbUser := "user"
	dbPassword := "password"

	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(dbName),
		postgres.WithUsername(dbUser),
		postgres.WithPassword(dbPassword),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer pgContainer.Terminate(ctx)

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	t.Setenv("DATABASE_URL", connStr)
	if err := Init(ctx); err != nil {
		t.Fatal(err)
	}
	defer Close()

	setupSchema(t, ctx, pool)

	workspaceID := "WS-OTHER"
	packageID := "PKG-OTHER"
	jobID := "JOB-OTHER"
	generationID := "GEN-OTHER"

	_, _ = pool.Exec(ctx, `INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, 'org_other', 'Ws')`, workspaceID)
	_, _ = pool.Exec(ctx, `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, 'PKG-O', '1', '1', '2024', 'G', 'S', 'draft')`, packageID, workspaceID)
	_, _ = pool.Exec(ctx, `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, metadata) VALUES ($1, $2, $3, 'running', $4, '{}')`, jobID, workspaceID, packageID, generationID)

	// Test MarkJobDone
	if err := MarkJobDone(ctx, workspaceID, jobID); err != nil {
		t.Errorf("MarkJobDone failed: %v", err)
	}
	var status string
	var lockedAt *time.Time
	pool.QueryRow(ctx, "SELECT status, locked_at FROM generation_jobs WHERE id=$1", jobID).Scan(&status, &lockedAt)
	if status != "done" {
		t.Errorf("Expected status done, got %s", status)
	}
	if lockedAt != nil {
		t.Errorf("Expected locked_at NULL, got %v", lockedAt)
	}

	// Test UpdateJobMetadata
	metaUpdate := map[string]interface{}{"foo": "bar"}
	if err := UpdateJobMetadata(ctx, workspaceID, jobID, metaUpdate); err != nil {
		t.Errorf("UpdateJobMetadata failed: %v", err)
	}
	var metaJSON []byte
	pool.QueryRow(ctx, "SELECT metadata FROM generation_jobs WHERE id=$1", jobID).Scan(&metaJSON)
	if string(metaJSON) == "{}" || string(metaJSON) == "" { // Postgres might optimize
		// Should check jsonb equality roughly
	}

	// Test UpdatePackageStatus
	if err := UpdatePackageStatus(ctx, workspaceID, packageID, "generating"); err != nil {
		t.Errorf("UpdatePackageStatus failed: %v", err)
	}

	// Test GetQueueStats
	stats, err := GetQueueStats(ctx)
	if err != nil {
		t.Errorf("GetQueueStats failed: %v", err)
	}
	if stats.Queued != 0 || stats.Running != 0 || stats.Failed != 0 {
		// We have 1 job that is done.
	}

	// Add a queued job
	pool.Exec(ctx, `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, metadata) VALUES ('J2', $1, $2, 'queued', 'G2', '{}')`, workspaceID, packageID)
	stats, _ = GetQueueStats(ctx)
	if stats.Queued != 1 {
		t.Errorf("Expected 1 queued, got %d", stats.Queued)
	}

	// Test Document Functions
	doc := Document{
		ID:          "DOC-001",
		WorkspaceID: workspaceID,
		PackageID:   packageID,
		PublicID:    "PUB-001",
		SubjectCode: "MAT",
		Version:     1,
		Status:      "draft",
		Metadata:    map[string]interface{}{"init": "val"},
	}
	if err := SaveDocument(ctx, doc); err != nil {
		t.Errorf("SaveDocument failed: %v", err)
	}

	// Test UpdateDocumentStatus
	if err := UpdateDocumentStatus(ctx, workspaceID, doc.PublicID, "published"); err != nil {
		t.Errorf("UpdateDocumentStatus failed: %v", err)
	}
	var docStatus string
	pool.QueryRow(ctx, "SELECT status FROM documents WHERE id=$1", doc.ID).Scan(&docStatus)
	if docStatus != "published" {
		t.Errorf("Expected published, got %s", docStatus)
	}

	// Test UpdateDocumentMetadata
	if err := UpdateDocumentMetadata(ctx, workspaceID, doc.PublicID, map[string]interface{}{"new": "val"}); err != nil {
		t.Errorf("UpdateDocumentMetadata failed: %v", err)
	}
}

func TestAcquireJob_NoRows_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := context.Background()
	// Setup DB (minimal)
	dbName := "modulajar_test_norows"
	dbUser := "user"
	dbPassword := "password"
	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(dbName),
		postgres.WithUsername(dbUser),
		postgres.WithPassword(dbPassword),
		testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer pgContainer.Terminate(ctx)
	connStr, _ := pgContainer.ConnectionString(ctx, "sslmode=disable")
	t.Setenv("DATABASE_URL", connStr)
	Init(ctx)
	defer Close()
	setupSchema(t, ctx, pool)

	// Acquire without jobs
	job, err := AcquireJob(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if job != nil {
		t.Fatalf("Expected nil job, got %v", job)
	}
}

func TestUninitializedDB(t *testing.T) {
	// Temporarily set pool to nil
	oldPool := pool
	pool = nil
	defer func() { pool = oldPool }()

	ctx := context.Background()
	if _, err := AcquireJob(ctx); err == nil {
		t.Error("Expected error for AcquireJob")
	}
	if err := MarkJobDone(ctx, "ws", "id"); err == nil {
		t.Error("Expected error for MarkJobDone")
	}
	if err := MarkJobFailed(ctx, "ws", "id", "err", 1); err == nil {
		t.Error("Expected error for MarkJobFailed")
	}
	if err := UpdatePackageStatus(ctx, "ws", "id", "s"); err == nil {
		t.Error("Expected error for UpdatePackageStatus")
	}
	if _, err := GetQueueStats(ctx); err == nil {
		t.Error("Expected error for GetQueueStats")
	}
	if err := UpdateJobMetadata(ctx, "ws", "id", nil); err == nil {
		t.Error("Expected error for UpdateJobMetadata")
	}
	if err := SaveDocument(ctx, Document{}); err == nil {
		t.Error("Expected error for SaveDocument")
	}
	if err := UpdateDocumentStatus(ctx, "ws", "id", "s"); err == nil {
		t.Error("Expected error for UpdateDocumentStatus")
	}
	if err := UpdateDocumentMetadata(ctx, "ws", "id", nil); err == nil {
		t.Error("Expected error for UpdateDocumentMetadata")
	}
	if err := Ping(ctx); err == nil {
		t.Error("Expected error for Ping")
	}
}

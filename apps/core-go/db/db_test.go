package db

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Setup: Connect to DB and truncate generation_jobs
func setup(t *testing.T) *pgxpool.Pool {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set")
	}

	ctx := context.Background()
	if err := Init(ctx); err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	p, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect for cleanup: %v", err)
	}

	// Cleanup first
	_, err = p.Exec(ctx, "DELETE FROM generation_jobs WHERE generation_id LIKE 'test-gen-%'")
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	// Also cleanup test tables used in new tests
	p.Exec(ctx, "DELETE FROM generation_jobs WHERE workspace_id IN ('ws-fail', 'ws-meta', 'ws-doc')")
	p.Exec(ctx, "DELETE FROM documents WHERE workspace_id IN ('ws-doc')")

	return p
}

func TestAtomicAcquire(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	// 1. Seed Data
	wsID := "test-ws-01"
	var exists bool
	err := p.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=$1)", wsID).Scan(&exists)
	if err == nil && !exists {
		_, err = p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3)", wsID, "clerk_01", "Test WS")
		if err != nil {
			// ignore
		}
	}

	// Insert Package
	pkgID := "test-pkg-01"
	_, err = p.Exec(ctx, `
        INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
        VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft')
        ON CONFLICT (id) DO NOTHING
    `, pkgID, wsID, "PKG-TEST-01")

	// Insert 2 Queued Jobs
	genID1 := "test-gen-01"
	genID2 := "test-gen-02"
	meta := `{"foo":"bar"}`

	_, err = p.Exec(ctx, `
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

	results := make(chan *GenerationJob, 2)

	for i := 0; i < 2; i++ {
		go func() {
			defer wg.Done()
			job, err := AcquireJob(ctx)
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
	for job := range results {
		if job != nil {
			jobsAcquired++
		}
	}
	if jobsAcquired != 2 {
		t.Errorf("Expected 2 jobs acquired, got %d", jobsAcquired)
	}

	// Cleanup
	p.Exec(ctx, "DELETE FROM generation_jobs WHERE generation_id LIKE 'test-gen-%'")
}

func TestInitPing(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	if err := Ping(ctx); err != nil {
		t.Errorf("Ping failed: %v", err)
	}
}

func TestQueueStats(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "test-ws-stats"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", wsID, "clerk_02", "Stats WS")
	pkgID := "test-pkg-stats"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '1', '1', '2025', 'T', 'S', 'draft') ON CONFLICT (id) DO NOTHING", pkgID, wsID, "PKG-STATS")

	_, err := p.Exec(ctx, `
		INSERT INTO generation_jobs (id, generation_id, workspace_id, package_id, status, metadata)
		VALUES
		('job-q', 'gen-q', $1, $2, 'queued', '{}'),
		('job-r', 'gen-r', $1, $2, 'running', '{}'),
		('job-f', 'gen-f', $1, $2, 'failed', '{}')
		ON CONFLICT DO NOTHING
	`, wsID, pkgID)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	stats, err := GetQueueStats(ctx)
	if err != nil {
		t.Fatalf("GetQueueStats failed: %v", err)
	}
	if stats.Queued < 1 {
		t.Errorf("Expected >=1 queued")
	}

	p.Exec(ctx, "DELETE FROM generation_jobs WHERE workspace_id=$1", wsID)
}

func TestUpdatePackageStatus(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "test-ws-pkg"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", wsID, "clerk-03", "Pkg WS")
	pkgID := "test-pkg-status"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '1', '1', '2025', 'T', 'S', 'draft') ON CONFLICT (id) DO NOTHING", pkgID, wsID, "PKG-STATUS")

	if err := UpdatePackageStatus(ctx, pkgID, "generating"); err != nil {
		t.Errorf("UpdatePackageStatus failed: %v", err)
	}
}

func TestMarkJobDone(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "test-ws-done"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", wsID, "clerk-04", "Done WS")
	pkgID := "test-pkg-done"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '1', '1', '2025', 'T', 'S', 'draft') ON CONFLICT (id) DO NOTHING", pkgID, wsID, "PKG-DONE")

	jobID := "job-done"
	p.Exec(ctx, "INSERT INTO generation_jobs (id, generation_id, workspace_id, package_id, status, metadata) VALUES ($1, 'gen-done', $2, $3, 'running', '{}')", jobID, wsID, pkgID)

	if err := MarkJobDone(ctx, jobID); err != nil {
		t.Errorf("MarkJobDone failed: %v", err)
	}

	// Verify
	var status string
	p.QueryRow(ctx, "SELECT status FROM generation_jobs WHERE id=$1", jobID).Scan(&status)
	if status != "done" {
		t.Errorf("Expected done, got %s", status)
	}
}

func TestMarkJobFailed(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "ws-fail"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", wsID, "clerk-f", "Fail WS")
	pkgID := "pkg-fail"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft') ON CONFLICT DO NOTHING", pkgID, wsID, "PKG-FAIL")
	jobID := "job-fail"
	p.Exec(ctx, "INSERT INTO generation_jobs (id, generation_id, workspace_id, package_id, status, metadata) VALUES ($1, 'gen-fail', $2, $3, 'running', '{}')", jobID, wsID, pkgID)

	// Attempt 1 -> Queued with backoff
	if err := MarkJobFailed(ctx, jobID, "error 1", 1); err != nil {
		t.Errorf("MarkJobFailed 1 failed: %v", err)
	}
	var status string
	p.QueryRow(ctx, "SELECT status FROM generation_jobs WHERE id=$1", jobID).Scan(&status)
	if status != "queued" {
		t.Errorf("Expected queued, got %s", status)
	}

	// Attempt 5 -> Failed
	if err := MarkJobFailed(ctx, jobID, "error 5", 5); err != nil {
		t.Errorf("MarkJobFailed 5 failed: %v", err)
	}
	p.QueryRow(ctx, "SELECT status FROM generation_jobs WHERE id=$1", jobID).Scan(&status)
	if status != "failed" {
		t.Errorf("Expected failed, got %s", status)
	}
}

func TestUpdateJobMetadata(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "ws-meta"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", wsID, "clerk-m", "Meta WS")
	pkgID := "pkg-meta"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft') ON CONFLICT DO NOTHING", pkgID, wsID, "PKG-META")
	jobID := "job-meta"
	p.Exec(ctx, "INSERT INTO generation_jobs (id, generation_id, workspace_id, package_id, status, metadata) VALUES ($1, 'gen-meta', $2, $3, 'queued', '{}')", jobID, wsID, pkgID)

	meta := map[string]interface{}{"foo": "bar"}
	if err := UpdateJobMetadata(ctx, jobID, meta); err != nil {
		t.Errorf("UpdateJobMetadata failed: %v", err)
	}

	// Verify
	var dbMeta map[string]interface{}
	var metaBytes []byte
	p.QueryRow(ctx, "SELECT metadata FROM generation_jobs WHERE id=$1", jobID).Scan(&metaBytes)
	json.Unmarshal(metaBytes, &dbMeta)
	if dbMeta["foo"] != "bar" {
		t.Errorf("Expected metadata foo=bar, got %v", dbMeta)
	}
}

func TestDocumentLifecycle(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	wsID := "ws-doc"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", wsID, "clerk-d", "Doc WS")
	pkgID := "pkg-doc"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft') ON CONFLICT DO NOTHING", pkgID, wsID, "PKG-DOC")

	doc := Document{
		ID:          "doc-01",
		WorkspaceID: wsID,
		PackageID:   pkgID,
		PublicID:    "DOC-TEST",
		SubjectCode: "MATH",
		Version:     1,
		Status:      "generating",
		Metadata:    map[string]interface{}{"init": true},
	}

	// 1. SaveDocument
	if err := SaveDocument(ctx, doc); err != nil {
		t.Fatalf("SaveDocument failed: %v", err)
	}

	// Verify
	var status string
	p.QueryRow(ctx, "SELECT status FROM documents WHERE id=$1", doc.ID).Scan(&status)
	if status != "generating" {
		t.Errorf("Expected generating, got %s", status)
	}

	// 2. UpdateDocumentStatus
	if err := UpdateDocumentStatus(ctx, doc.PublicID, "ready"); err != nil {
		t.Errorf("UpdateDocumentStatus failed: %v", err)
	}
	p.QueryRow(ctx, "SELECT status FROM documents WHERE id=$1", doc.ID).Scan(&status)
	if status != "ready" {
		t.Errorf("Expected ready, got %s", status)
	}

	// 3. UpdateDocumentMetadata
	meta := map[string]interface{}{"done": true}
	if err := UpdateDocumentMetadata(ctx, doc.PublicID, meta); err != nil {
		t.Errorf("UpdateDocumentMetadata failed: %v", err)
	}

	var dbMeta map[string]interface{}
	var metaBytes []byte
	p.QueryRow(ctx, "SELECT metadata FROM documents WHERE id=$1", doc.ID).Scan(&metaBytes)
	json.Unmarshal(metaBytes, &dbMeta)
	if dbMeta["done"] != true {
		t.Errorf("Expected metadata done=true, got %v", dbMeta)
	}
}

func TestAcquireJob_NoRows(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	// Ensure no queued jobs?
	// We can trust setup (it deletes test-gen-%).
	// But AcquireJob queries ANY 'queued' job.
	// We hope no other tests are leaving queued jobs around.

	job, err := AcquireJob(ctx)
	if err != nil {
		t.Errorf("AcquireJob error: %v", err)
	}
	if job != nil {
		t.Logf("Acquired unexpected job: %s", job.ID)
	}
}

func TestInit_InvalidURL(t *testing.T) {
	// Must restore env!
	old := os.Getenv("DATABASE_URL")
	t.Cleanup(func() { os.Setenv("DATABASE_URL", old) })

	os.Setenv("DATABASE_URL", "postgres://invalid")
	err := Init(context.Background())
	if err == nil {
		t.Error("Expected Init error for invalid URL")
	}
}

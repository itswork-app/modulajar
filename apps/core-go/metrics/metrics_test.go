package metrics

import (
	"context"
	"os"
	"strings"
	"testing"

	"modulajar/apps/core-go/db"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func setup(t *testing.T) *pgxpool.Pool {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set")
	}

	ctx := context.Background()
	if err := db.Init(ctx); err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	p, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect for cleanup: %v", err)
	}

	// Cleanup first
	_, err = p.Exec(ctx, "DELETE FROM generation_jobs WHERE generation_id LIKE 'test-met-%'")
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}

	p.Exec(ctx, "DELETE FROM generation_jobs WHERE workspace_id='ws-met'")

	return p
}

func TestQueueCollector(t *testing.T) {
	p := setup(t)
	defer p.Close()
	ctx := context.Background()

	// Seed Data
	wsID := "ws-met"
	p.Exec(ctx, "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", wsID, "clerk-met", "Met WS")
	pkgID := "pkg-met"
	p.Exec(ctx, "INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status) VALUES ($1, $2, $3, '4', '1', '2025', 'T', 'S', 'draft') ON CONFLICT DO NOTHING", pkgID, wsID, "PKG-MET")

	// 2 Queued, 1 Running, 1 Failed
	p.Exec(ctx, `
		INSERT INTO generation_jobs (id, generation_id, workspace_id, package_id, status, metadata)
		VALUES
		('j1', 'test-met-1', $1, $2, 'queued', '{}'),
		('j2', 'test-met-2', $1, $2, 'queued', '{}'),
		('j3', 'test-met-3', $1, $2, 'running', '{}'),
		('j4', 'test-met-4', $1, $2, 'failed', '{}')
	`, wsID, pkgID)

	c := NewQueueCollector()

	// Create a channel to receive metrics
	ch := make(chan prometheus.Metric, 10)
	go func() {
		c.Collect(ch)
		close(ch)
	}()

	stats := make(map[string]float64)
	for m := range ch {
		// Extract value
		var metric dto.Metric
		m.Write(&metric)

		// Desc string is hidden but we can match value?
		// Or check Desc().String()
		desc := m.Desc().String()
		val := metric.Gauge.GetValue()

		if strings.Contains(desc, "jobs_queued_gauge") {
			stats["queued"] = val
		} else if strings.Contains(desc, "jobs_running_gauge") {
			stats["running"] = val
		} else if strings.Contains(desc, "jobs_failed_gauge") {
			stats["failed"] = val
		} else if strings.Contains(desc, "jobs_stuck") {
			stats["stuck"] = val
		}
	}

	if stats["queued"] < 2 {
		t.Errorf("Expected >=2 queued, got %v", stats["queued"])
	}
	if stats["running"] < 1 {
		t.Errorf("Expected >=1 running, got %v", stats["running"])
	}
	if stats["failed"] < 1 {
		t.Errorf("Expected >=1 failed, got %v", stats["failed"])
	}

	// Describe
	descs := make(chan *prometheus.Desc, 10)
	go func() {
		c.Describe(descs)
		close(descs)
	}()
	count := 0
	for range descs {
		count++
	}
	if count != 4 {
		t.Errorf("Expected 4 descriptors, got %d", count)
	}
}

func TestHeartbeatLoop(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	go StartHeartbeatLoop(ctx)
	// Just let it run one cycle, wait a bit, then cancel
	cancel()
}

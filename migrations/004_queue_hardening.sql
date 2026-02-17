-- +goose Up
-- +goose StatementBegin

-- 1. Rename idempotency_key -> generation_id
ALTER TABLE generation_jobs RENAME COLUMN idempotency_key TO generation_id;

-- 2. Add queue reliability columns
ALTER TABLE generation_jobs
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_at TIMESTAMP,
  ADD COLUMN next_run_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN last_error TEXT,
  ADD COLUMN metadata JSONB;

-- 3. Migrate 'completed' status to 'done' (standardize)
UPDATE generation_jobs SET status = 'done' WHERE status = 'completed';

-- 4. Add CHECK constraint for status
ALTER TABLE generation_jobs ADD CONSTRAINT chk_job_status
  CHECK (status IN ('queued', 'running', 'failed', 'done'));

-- 5. Drop old global unique index
DROP INDEX IF EXISTS idx_generation_jobs_idempotency_key;

-- 6. Add composite unique index (scoped to workspace)
CREATE UNIQUE INDEX uniq_generation_workspace
  ON generation_jobs (workspace_id, generation_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uniq_generation_workspace;
ALTER TABLE generation_jobs DROP CONSTRAINT IF EXISTS chk_job_status;
ALTER TABLE generation_jobs DROP COLUMN metadata;
ALTER TABLE generation_jobs DROP COLUMN last_error;
ALTER TABLE generation_jobs DROP COLUMN next_run_at;
ALTER TABLE generation_jobs DROP COLUMN locked_at;
ALTER TABLE generation_jobs DROP COLUMN attempt_count;
ALTER TABLE generation_jobs RENAME COLUMN generation_id TO idempotency_key;
CREATE UNIQUE INDEX idx_generation_jobs_idempotency_key ON generation_jobs(idempotency_key);
-- +goose StatementEnd

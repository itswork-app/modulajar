-- +goose Up
-- +goose StatementBegin

-- Administration bundles table
CREATE TABLE bundles (
    id CHAR(26) PRIMARY KEY,
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    kelas TEXT NOT NULL,
    semester TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    teacher_name TEXT,
    school_name TEXT,
    topic_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bundle_status CHECK (status IN ('pending', 'running', 'done', 'failed'))
);

CREATE INDEX idx_bundles_workspace_id ON bundles(workspace_id);
CREATE INDEX idx_bundles_status ON bundles(workspace_id, status);

-- Add doc_type and bundle_id to generation_jobs
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'modul_ajar';
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS bundle_id CHAR(26) REFERENCES bundles(id) ON DELETE SET NULL;

CREATE INDEX idx_generation_jobs_bundle_id ON generation_jobs(bundle_id) WHERE bundle_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS bundle_id;
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS doc_type;
DROP TABLE IF EXISTS bundles;
-- +goose StatementEnd

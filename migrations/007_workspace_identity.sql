-- +goose Up
-- +goose StatementBegin

-- PR-033: Workspace Identity + Optional NPSN Foundation
-- Add institutional identity foundation to workspace model.

ALTER TABLE workspaces
ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN npsn TEXT NULL,
ADD COLUMN school_name TEXT NULL,
ADD COLUMN province TEXT NULL,
ADD COLUMN regency TEXT NULL,
ADD COLUMN address TEXT NULL,
ADD COLUMN logo_url TEXT NULL,
ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;

-- Constraints
ALTER TABLE workspaces
ADD CONSTRAINT check_workspace_type CHECK (workspace_type IN ('personal', 'institution'));

CREATE UNIQUE INDEX idx_workspaces_npsn_unique ON workspaces(npsn) WHERE npsn IS NOT NULL;

-- Backfill: Existing rows keep workspace_type='personal' (already default)

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE workspaces
DROP CONSTRAINT IF EXISTS check_workspace_type;

DROP INDEX IF EXISTS idx_workspaces_npsn_unique;

ALTER TABLE workspaces
DROP COLUMN IF EXISTS workspace_type,
DROP COLUMN IF EXISTS npsn,
DROP COLUMN IF EXISTS school_name,
DROP COLUMN IF EXISTS province,
DROP COLUMN IF EXISTS regency,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS is_verified;

-- +goose StatementEnd

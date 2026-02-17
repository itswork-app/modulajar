-- +goose Up
-- +goose StatementBegin

-- ═══════════════════════════════════════════════
-- PR-018: Tenant Isolation Hardening
-- Non-destructive migration.
-- ═══════════════════════════════════════════════

-- 1. Replace global UNIQUE on packages.public_id with workspace-scoped
DROP INDEX IF EXISTS idx_packages_public_id;
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_public_id_key;
CREATE UNIQUE INDEX uniq_packages_workspace_public ON packages (workspace_id, public_id);

-- 2. Replace global UNIQUE on documents.public_id with workspace-scoped
DROP INDEX IF EXISTS idx_documents_public_id;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_public_id_key;
CREATE UNIQUE INDEX uniq_documents_workspace_public ON documents (workspace_id, public_id);

-- 3. Composite indexes (workspace_id, id) for efficient tenant-scoped lookups
CREATE INDEX idx_packages_workspace_id_id ON packages (workspace_id, id);
CREATE INDEX idx_documents_workspace_id_id ON documents (workspace_id, id);
CREATE INDEX idx_generation_jobs_workspace_id_id ON generation_jobs (workspace_id, id);
CREATE INDEX idx_wallet_ledger_workspace_id_id ON wallet_ledger (workspace_id, id);
CREATE INDEX idx_receipts_workspace_id_id ON receipts (workspace_id, id);
CREATE INDEX idx_workspace_members_workspace_id_id ON workspace_members (workspace_id, id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Reverse composite indexes
DROP INDEX IF EXISTS idx_workspace_members_workspace_id_id;
DROP INDEX IF EXISTS idx_receipts_workspace_id_id;
DROP INDEX IF EXISTS idx_wallet_ledger_workspace_id_id;
DROP INDEX IF EXISTS idx_generation_jobs_workspace_id_id;
DROP INDEX IF EXISTS idx_documents_workspace_id_id;
DROP INDEX IF EXISTS idx_packages_workspace_id_id;

-- Restore global UNIQUE on documents.public_id
DROP INDEX IF EXISTS uniq_documents_workspace_public;
CREATE UNIQUE INDEX idx_documents_public_id ON documents (public_id);

-- Restore global UNIQUE on packages.public_id
DROP INDEX IF EXISTS uniq_packages_workspace_public;
CREATE UNIQUE INDEX idx_packages_public_id ON packages (public_id);

-- +goose StatementEnd

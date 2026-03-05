-- +goose Up
-- +goose StatementBegin

-- We enhance document_versions to support the structured editor.
-- We use JSONB for the module content and html_sha256 for integrity checks of the rendered output.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS module_json JSONB;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS html_sha256 TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS created_by CHAR(26); -- Reference to clerk_user_id or internal ID if needed

-- Ensure document_id + version is unique (standard versioning constraint)
-- Note: documents table already has 'version' column, which we will treat as 'current_version'
-- The version in document_versions is the historical/specific version number.
ALTER TABLE document_versions ADD CONSTRAINT doc_version_unique UNIQUE(document_id, version);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS doc_version_unique;
ALTER TABLE document_versions DROP COLUMN IF EXISTS created_by;
ALTER TABLE document_versions DROP COLUMN IF EXISTS html_sha256;
ALTER TABLE document_versions DROP COLUMN IF EXISTS module_json;
-- +goose StatementEnd

-- +goose Up
-- +goose StatementBegin

-- PR-025: Verify Service Hardening
-- Add metadata to documents table for efficient verify query (no joins needed)

ALTER TABLE documents ADD COLUMN metadata JSONB;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE documents DROP COLUMN IF EXISTS metadata;

-- +goose StatementEnd

-- +goose Up
-- +goose StatementBegin
ALTER TABLE workspace_settings
    ADD COLUMN letterhead_line1 TEXT NULL,
    ADD COLUMN letterhead_line2 TEXT NULL,
    ADD COLUMN letterhead_line3 TEXT NULL,
    ADD COLUMN letterhead_line4 TEXT NULL,
    ADD COLUMN letterhead_contact TEXT NULL,
    ADD COLUMN logo_file_path TEXT NULL,
    ADD COLUMN logo_sha256 TEXT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE workspace_settings
    DROP COLUMN letterhead_line1,
    DROP COLUMN letterhead_line2,
    DROP COLUMN letterhead_line3,
    DROP COLUMN letterhead_line4,
    DROP COLUMN letterhead_contact,
    DROP COLUMN logo_file_path,
    DROP COLUMN logo_sha256;
-- +goose StatementEnd

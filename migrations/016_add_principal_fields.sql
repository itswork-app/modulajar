-- +goose Up
-- +goose StatementBegin
ALTER TABLE workspace_settings
    ADD COLUMN principal_name TEXT NULL,
    ADD COLUMN principal_nip TEXT NULL,
    ADD COLUMN signature_location TEXT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE workspace_settings
    DROP COLUMN principal_name,
    DROP COLUMN principal_nip,
    DROP COLUMN signature_location;
-- +goose StatementEnd

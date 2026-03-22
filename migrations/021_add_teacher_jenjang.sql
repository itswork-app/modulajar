-- +goose Up
-- +goose StatementBegin
ALTER TABLE teachers ADD COLUMN primary_jenjang VARCHAR(20) NOT NULL DEFAULT 'SD';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE teachers DROP COLUMN IF EXISTS primary_jenjang;
-- +goose StatementEnd

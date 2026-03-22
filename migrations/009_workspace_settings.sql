-- +goose Up
-- +goose StatementBegin
CREATE TABLE workspace_settings (
    workspace_id CHAR(26) PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    school_display_name TEXT NOT NULL,
    kab_kota TEXT NULL,
    provinsi TEXT NULL,
    alamat TEXT NULL,
    school_npsn TEXT NULL,
    school_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS workspace_settings;
-- +goose StatementEnd

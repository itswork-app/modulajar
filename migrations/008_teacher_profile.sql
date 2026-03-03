-- +goose Up
-- +goose StatementBegin
CREATE TABLE teachers (
    id CHAR(26) PRIMARY KEY, -- ULID
    workspace_id CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    primary_grade INT NOT NULL DEFAULT 4,
    primary_subject TEXT NOT NULL,
    nip TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_workspace_teacher UNIQUE(workspace_id),
    CONSTRAINT check_primary_grade CHECK (primary_grade >= 1 AND primary_grade <= 12)
);

CREATE INDEX idx_teachers_workspace_id ON teachers(workspace_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS teachers;
-- +goose StatementEnd

-- +goose Up
-- +goose StatementBegin

-- PR-105: Audit Console & Security Infrastructure
-- Persistent log table for tracking sensitive platform actions.

CREATE TABLE platform_audit_logs (
    id CHAR(26) PRIMARY KEY, -- ULID
    event_type TEXT NOT NULL, -- e.g., 'AUTH_LOGIN', 'WORKSPACE_DELETE', 'SETTINGS_UPDATE'
    actor_id TEXT NOT NULL, -- Clerk User ID or System
    actor_email TEXT NULL,
    target_id TEXT NULL, -- Workspace ID, User ID, etc.
    action_details JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- info, warn, critical
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_event_type ON platform_audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor_id ON platform_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON platform_audit_logs(created_at DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS platform_audit_logs;

-- +goose StatementEnd

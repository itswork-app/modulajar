-- +goose Up
-- +goose StatementBegin

-- 1. Global Platform Configuration
CREATE TABLE platform_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial config
INSERT INTO platform_config (key, value) VALUES 
('platform_name', '"Modulajar HQ"'),
('support_email', '"support@modulajar.app"'),
('maintenance_mode', 'false'),
('global_banner', '{"text": "Production environment active", "visible": false}');

-- 2. Infrastructure Keys Manager
CREATE TABLE platform_keys (
    id CHAR(26) PRIMARY KEY, -- ULID
    service_name VARCHAR(100) NOT NULL, -- e.g. 'OpenAI', 'Clerk', 'Xendit'
    key_type VARCHAR(50) NOT NULL, -- 'public', 'secret', 'webhook'
    key_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 3. Platform Outbound Webhooks
CREATE TABLE platform_webhooks (
    id CHAR(26) PRIMARY KEY, -- ULID
    target_url TEXT NOT NULL,
    event_filters TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'PAYMENT_SUCCESS', 'USER_SIGNUP'}
    secret_token VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS platform_webhooks;
DROP TABLE IF EXISTS platform_keys;
DROP TABLE IF EXISTS platform_config;

-- +goose StatementEnd

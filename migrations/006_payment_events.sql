-- +goose Up
-- +goose StatementBegin

-- PR-026: Payment Webhook Hardening
-- Table to track payment events for replay protection and auditing.

CREATE TABLE payment_events (
    id CHAR(26) PRIMARY KEY, -- ULID
    provider_event_id TEXT UNIQUE NOT NULL, -- External ID from provider (e.g. Xendit ID)
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    payload_hash TEXT NOT NULL, -- SHA256 of raw payload for audit
    status TEXT NOT NULL, -- 'processed', 'ignored', 'failed'
    metadata JSONB -- Extra context if needed
);

CREATE INDEX idx_payment_events_provider_id ON payment_events(provider_event_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS payment_events;

-- +goose StatementEnd

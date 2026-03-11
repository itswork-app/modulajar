-- +goose Up
-- +goose StatementBegin

-- PR-C16: Payment Rail (Xendit + Voucher System)
-- Supporting vouchers and traceable receipts.

-- 1. Create voucher_codes table
CREATE TABLE IF NOT EXISTS voucher_codes (
    code VARCHAR(50) PRIMARY KEY, -- User-facing code (e.g. VA-XXXX-XXXX)
    credits INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'redeemed', 'expired'
    expires_at TIMESTAMP,
    workspace_id CHAR(26) REFERENCES workspaces(id), -- Nullable until redeemed
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voucher_codes_status ON voucher_codes(status);
CREATE INDEX IF NOT EXISTS idx_voucher_codes_workspace_id ON voucher_codes(workspace_id);

-- 2. Enhance receipts table for traceability and multi-method payments
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'topup_xendit';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ledger_id CHAR(26);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_method ON receipts(payment_method);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_receipts_payment_method;
DROP INDEX IF EXISTS idx_receipts_status;
ALTER TABLE receipts DROP COLUMN IF EXISTS ledger_id;
ALTER TABLE receipts DROP COLUMN IF EXISTS payment_method;

DROP TABLE IF EXISTS voucher_codes;

-- +goose StatementEnd

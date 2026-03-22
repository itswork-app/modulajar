-- +goose Up
-- +goose StatementBegin

-- PR-019: Append-Only Wallet Ledger Hardening
-- Makes wallet_ledger industrial-grade: immutable, idempotent, constrained.

-- 1. Rename reference → reference_id
ALTER TABLE wallet_ledger RENAME COLUMN reference TO reference_id;

-- 2. Add metadata JSONB (optional per-entry context)
ALTER TABLE wallet_ledger ADD COLUMN metadata JSONB;

-- 3. Add CHECK constraints
ALTER TABLE wallet_ledger ADD CONSTRAINT chk_wallet_type
  CHECK (type IN ('credit', 'debit'));
ALTER TABLE wallet_ledger ADD CONSTRAINT chk_wallet_amount
  CHECK (amount > 0);

-- 4. Critical: unique constraint for idempotent debit/credit
-- Prevents double-charge for same generation_id, double-credit for same voucher
CREATE UNIQUE INDEX uniq_wallet_reference
  ON wallet_ledger (workspace_id, reference_id, type);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS uniq_wallet_reference;
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS chk_wallet_amount;
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS chk_wallet_type;
ALTER TABLE wallet_ledger DROP COLUMN IF EXISTS metadata;
ALTER TABLE wallet_ledger RENAME COLUMN reference_id TO reference;

-- +goose StatementEnd

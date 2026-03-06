# Wallet System Architecture

The Wallet System is a production-grade, institutional-grade accounting engine designed to track credits, debits, and transaction history for the ModulAjar platform.

## 1. Append-Only Ledger Model
At its core, the system uses an **append-only ledger** stored in the `wallet_ledger` table. 

### Key Design Principles:
- **No Mutability**: There is no `UPDATE` or `DELETE` ever performed on a transaction row. Once recorded, it is permanent.
- **Derived Balance**: Current balance is computed as `SUM(credits) - SUM(debits)`. There is no single "balance" column in the database because mutable balance columns are prone to race conditions and audit drift.
- **Idempotency**: Every operation is protected by a unique constraint `UNIQUE(workspace_id, reference_id, type)`. This prevents double-charges or duplicate credits if an API call is retried or enqueued twice.

## 2. Core Ledger Schema

```sql
CREATE TABLE wallet_ledger (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reference_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Strict idempotency
    CONSTRAINT uniq_wallet_reference UNIQUE (workspace_id, reference_id, type)
);
```

## 3. Transaction Types & Metadata
To satisfy SaaS requirements (e.g., showing "Top Up", "Redeem Voucher", or "Generate Module" in the UI) while maintaining a strict binary ledger (`credit`/`debit`), we use the `metadata` JSONB column.

Mapped transaction types:
- `topup`: Credits added via payment gateway.
- `voucher_redeem`: Credits added via promo codes.
- `generate_module`: Credits deducted for AI generation.
- `referral_bonus`: Credits added for social sharing.

## 4. API Layer
The Wallet API maps the raw ledger into a user-friendly format:

- `GET /w/:workspaceId/wallet/summary`: Returns the derived balance, lifetime documents generated, and current month's usage.
- `GET /w/:workspaceId/wallet/transactions`: Returns a history of transactions with mapped types, negative amounts for debits, and human-readable notes.

## 5. Security & Isolation
- **Workspace Scoped**: All operations strictly check for `workspace_id`. Cross-workspace ledger operations are impossible at the database and application levels.
- **Atomic Deduction**: The `debit()` function uses a Common Table Expression (CTE) to check balance and insert the debit row in a single atomic database roundtrip.

```sql
WITH balance_check AS (
    SELECT SUM(credits) - SUM(debits) AS balance FROM ...
)
INSERT INTO wallet_ledger ...
WHERE balance >= @amount
```

## 6. Observability
The following Prometheus metrics are exported:
- `wallet_balance_checks_total`: Total balance lookups.
- `wallet_debit_total`: Total successful deductions.
- `wallet_debit_failed_total`: Count of failed debits (e.g., insufficient balance).
- `wallet_transactions_total`: Total ledger entries created.

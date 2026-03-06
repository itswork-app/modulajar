/**
 * Wallet Service — Industrial-grade append-only ledger operations.
 *
 * Rules:
 * - No UPDATE wallet_ledger ever
 * - No DELETE
 * - No mutable balance column
 * - Balance = SUM(credits) - SUM(debits)
 * - Idempotent via UNIQUE(workspace_id, reference_id, type)
 */

import {
    walletBalanceChecksTotal,
    walletDebitTotal,
    walletDebitFailedTotal,
    walletTransactionsTotal
} from '../utils/metrics';

export interface DbClient {
    query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface LedgerEntry {
    id: string;
    workspaceId: string;
    type: 'credit' | 'debit';
    amount: number;
    referenceId: string;
    metadata?: Record<string, unknown>;
}

export interface WalletResult {
    inserted: boolean;
    ledgerId: string | null;
}

/**
 * Get derived balance for a workspace.
 * Balance = SUM(credits) - SUM(debits). No mutable column.
 */
export async function getBalance(db: DbClient, workspaceId: string): Promise<number> {
    const result = await db.query(
        `SELECT COALESCE(SUM(
            CASE
                WHEN type = 'credit' THEN amount
                WHEN type = 'debit' THEN -amount
            END
        ), 0) AS balance
        FROM wallet_ledger
        WHERE workspace_id = $1`,
        [workspaceId]
    );
    walletBalanceChecksTotal.inc();
    return parseInt(result.rows[0]?.balance as string || '0', 10);
}

/**
 * Append a credit entry. Idempotent via ON CONFLICT DO NOTHING.
 *
 * @returns { inserted: true, ledgerId } if new entry, { inserted: false, ledgerId: null } if duplicate
 */
export async function credit(
    db: DbClient,
    workspaceId: string,
    amount: number,
    referenceId: string,
    metadata?: Record<string, unknown>
): Promise<WalletResult> {
    if (amount <= 0) throw new Error('Credit amount must be positive');

    const { ulid } = await import('ulid');
    const ledgerId = ulid();

    const result = await db.query(
        `INSERT INTO wallet_ledger (id, workspace_id, type, amount, reference_id, metadata)
         VALUES ($1, $2, 'credit', $3, $4, $5)
         ON CONFLICT (workspace_id, reference_id, type) DO NOTHING`,
        [ledgerId, workspaceId, amount, referenceId, metadata ? JSON.stringify(metadata) : null]
    );

    const inserted = (result.rowCount ?? 0) > 0;
    if (inserted) {
        walletTransactionsTotal.inc({ type: 'credit' });
    }
    return { inserted, ledgerId: inserted ? ledgerId : null };
}

/**
 * Append a debit entry. Atomic: checks balance then inserts.
 * Idempotent via ON CONFLICT DO NOTHING.
 *
 * @returns { inserted: true, ledgerId } if debited, { inserted: false, ledgerId: null } if duplicate
 * @throws Error('Insufficient balance') if balance < amount
 */
export async function debit(
    db: DbClient,
    workspaceId: string,
    amount: number,
    referenceId: string,
    metadata?: Record<string, unknown>
): Promise<WalletResult> {
    if (amount <= 0) throw new Error('Debit amount must be positive');

    // Atomic: CTE checks balance, then inserts debit only if sufficient funds.
    // ON CONFLICT DO NOTHING handles idempotency.
    const { ulid } = await import('ulid');
    const ledgerId = ulid();

    const result = await db.query(
        `WITH balance_check AS (
            SELECT COALESCE(SUM(
                CASE
                    WHEN type = 'credit' THEN amount
                    WHEN type = 'debit' THEN -amount
                END
            ), 0) AS current_balance
            FROM wallet_ledger
            WHERE workspace_id = $1
        )
        INSERT INTO wallet_ledger (id, workspace_id, type, amount, reference_id, metadata)
        SELECT $2, $1, 'debit', $3, $4, $5
        FROM balance_check
        WHERE current_balance >= $3
        ON CONFLICT (workspace_id, reference_id, type) DO NOTHING`,
        [workspaceId, ledgerId, amount, referenceId, metadata ? JSON.stringify(metadata) : null]
    );

    const inserted = (result.rowCount ?? 0) > 0;

    if (!inserted) {
        // Could be idempotent duplicate OR insufficient balance. Check which.
        const existingResult = await db.query(
            `SELECT id FROM wallet_ledger
             WHERE workspace_id = $1 AND reference_id = $2 AND type = 'debit'`,
            [workspaceId, referenceId]
        );

        if (existingResult.rowCount && existingResult.rowCount > 0) {
            // Already debited — idempotent safe
            return { inserted: false, ledgerId: null };
        }

        // Not a duplicate → insufficient balance
        walletDebitFailedTotal.inc({ reason: 'insufficient_balance' });
        throw new Error('Insufficient balance');
    }

    walletDebitTotal.inc();
    walletTransactionsTotal.inc({ type: 'debit' });
    return { inserted, ledgerId };
}

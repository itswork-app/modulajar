import tap from 'tap';
import { getBalance, credit, debit, DbClient } from '../src/lib/wallet';

const test = tap.test;

/**
 * In-memory mock DB that simulates wallet_ledger table behavior
 * with UNIQUE(workspace_id, reference_id, type) constraint.
 */
function createMockLedgerDb(): DbClient & { ledger: any[] } {
    const ledger: any[] = [];

    return {
        ledger,
        query: async (sql: string, params: unknown[]) => {
            // getBalance query (pure SELECT, no INSERT)
            if (sql.includes('SUM(') && sql.includes('wallet_ledger') && !sql.includes('INSERT')) {
                const workspaceId = params[0];
                const entries = ledger.filter(e => e.workspace_id === workspaceId);
                if (entries.length === 0) {
                    return { rowCount: 0, rows: [] }; // Test line 54 fallback
                }
                let balance = 0;
                for (const e of entries) {
                    balance += e.type === 'credit' ? e.amount : -e.amount;
                }
                return { rowCount: 1, rows: [{ balance: String(balance) }] };
            }

            // CTE debit (INSERT ... SELECT ... FROM balance_check WHERE current_balance >= $3)
            // Must test BEFORE generic ON CONFLICT handler since CTE also has ON CONFLICT
            if (sql.includes('balance_check') && sql.includes('INSERT INTO wallet_ledger')) {
                const [workspaceId, id, amount, referenceId, metadata] = params as any[];

                // Check unique constraint first
                const duplicate = ledger.find(
                    e => e.workspace_id === workspaceId && e.reference_id === referenceId && e.type === 'debit'
                );
                if (duplicate) {
                    return { rowCount: 0, rows: [] };
                }

                // Check balance
                const entries = ledger.filter(e => e.workspace_id === workspaceId);
                let balance = 0;
                for (const e of entries) {
                    balance += e.type === 'credit' ? e.amount : -e.amount;
                }

                if (balance < (amount as number)) {
                    return { rowCount: 0, rows: [] }; // Insufficient balance
                }

                ledger.push({
                    id,
                    workspace_id: workspaceId,
                    type: 'debit',
                    amount,
                    reference_id: referenceId,
                    metadata
                });
                return { rowCount: 1, rows: [] };
            }

            // INSERT ... ON CONFLICT DO NOTHING (credit only — CTE debit already handled above)
            if (sql.includes('INSERT INTO wallet_ledger') && sql.includes('ON CONFLICT')) {
                const [id, workspaceId, amount, referenceId, metadata] = params as any[];
                const type = sql.includes("'credit'") ? 'credit' : 'debit';

                // Check unique constraint
                const duplicate = ledger.find(
                    e => e.workspace_id === workspaceId && e.reference_id === referenceId && e.type === type
                );
                if (duplicate) {
                    return { rowCount: 0, rows: [] }; // ON CONFLICT DO NOTHING
                }

                ledger.push({
                    id,
                    workspace_id: workspaceId,
                    type,
                    amount,
                    reference_id: referenceId,
                    metadata
                });
                return { rowCount: 1, rows: [] };
            }

            // SELECT for idempotency check in debit
            if (sql.includes('SELECT id FROM wallet_ledger') && sql.includes('reference_id')) {
                const [workspaceId, referenceId] = params as any[];
                const found = ledger.filter(
                    e => e.workspace_id === workspaceId && e.reference_id === referenceId && e.type === 'debit'
                );
                return { rowCount: found.length, rows: found };
            }

            return { rowCount: 0, rows: [] };
        }
    };
}

test('Wallet Service — Append-Only Ledger (PR-019)', async (t) => {

    await t.test('Test 1: Double debit prevented (idempotent)', async (t) => {
        const db = createMockLedgerDb();

        // Seed balance
        await credit(db, 'ws-1', 100, 'SEED:initial');

        // First debit
        const result1 = await debit(db, 'ws-1', 10, 'JOB:job-1');
        t.equal(result1.inserted, true, 'First debit should insert');
        t.ok(result1.ledgerId, 'First debit should return ledgerId');

        // Second debit with same reference — idempotent
        const result2 = await debit(db, 'ws-1', 10, 'JOB:job-1');
        t.equal(result2.inserted, false, 'Second debit should be ignored');
        t.equal(result2.ledgerId, null, 'Second debit ledgerId should be null');

        // Balance should only reflect ONE debit
        const balance = await getBalance(db, 'ws-1');
        t.equal(balance, 90, 'Balance should be 100 - 10 = 90 (not 80)');
    });

    await t.test('Test 2: Double credit prevented (idempotent)', async (t) => {
        const db = createMockLedgerDb();

        // First credit
        const result1 = await credit(db, 'ws-1', 50, 'VOUCHER:v-1');
        t.equal(result1.inserted, true, 'First credit should insert');
        t.ok(result1.ledgerId, 'First credit should return ledgerId');

        // Second credit with same reference — idempotent
        const result2 = await credit(db, 'ws-1', 50, 'VOUCHER:v-1');
        t.equal(result2.inserted, false, 'Second credit should be ignored');
        t.equal(result2.ledgerId, null, 'Second credit ledgerId should be null');

        // Balance should only reflect ONE credit
        const balance = await getBalance(db, 'ws-1');
        t.equal(balance, 50, 'Balance should be 50 (not 100)');
    });

    await t.test('Test 3: Balance correct after 10 credits + 3 debits', async (t) => {
        const db = createMockLedgerDb();

        // 10 credits of 10 each = 100
        for (let i = 0; i < 10; i++) {
            await credit(db, 'ws-1', 10, `TOPUP:t-${i}`);
        }

        const balanceAfterCredits = await getBalance(db, 'ws-1');
        t.equal(balanceAfterCredits, 100, 'Balance after 10 credits × 10 = 100');

        // 3 debits of 5 each = 15
        for (let i = 0; i < 3; i++) {
            await debit(db, 'ws-1', 5, `JOB:j-${i}`);
        }

        const finalBalance = await getBalance(db, 'ws-1');
        t.equal(finalBalance, 85, 'Balance = 100 - 15 = 85');
    });

    await t.test('Test 4: Insufficient balance rejected', async (t) => {
        const db = createMockLedgerDb();

        // Seed small balance
        await credit(db, 'ws-1', 3, 'SEED:small');

        try {
            await debit(db, 'ws-1', 10, 'JOB:too-expensive');
            t.fail('Should have thrown Insufficient balance');
        } catch (err) {
            t.equal((err as Error).message, 'Insufficient balance', 'Should throw Insufficient balance');
        }

        // Balance unchanged
        const balance = await getBalance(db, 'ws-1');
        t.equal(balance, 3, 'Balance should remain 3');
    });

    await t.test('Test 5: Zero balance returns 0', async (t) => {
        const db = createMockLedgerDb();
        const balance = await getBalance(db, 'ws-empty');
        t.equal(balance, 0, 'Empty workspace should have 0 balance');
    });

    await t.test('Test 6: Multi-tenant isolation', async (t) => {
        const db = createMockLedgerDb();

        await credit(db, 'ws-1', 100, 'SEED:ws1');
        await credit(db, 'ws-2', 200, 'SEED:ws2');

        const balance1 = await getBalance(db, 'ws-1');
        const balance2 = await getBalance(db, 'ws-2');

        t.equal(balance1, 100, 'ws-1 balance correct');
        t.equal(balance2, 200, 'ws-2 balance correct');

        // Debit from ws-1 shouldn't affect ws-2
        await debit(db, 'ws-1', 50, 'JOB:ws1-job');
        t.equal(await getBalance(db, 'ws-1'), 50, 'ws-1 balance after debit = 50');
        t.equal(await getBalance(db, 'ws-2'), 200, 'ws-2 balance unchanged');
    });

    await t.test('Test 7: Invalid amounts rejected', async (t) => {
        const db = createMockLedgerDb();

        try {
            await credit(db, 'ws-1', 0, 'BAD:zero');
            t.fail('Should reject zero credit');
        } catch (err) {
            t.equal((err as Error).message, 'Credit amount must be positive');
        }

        try {
            await credit(db, 'ws-1', -5, 'BAD:negative');
            t.fail('Should reject negative credit');
        } catch (err) {
            t.equal((err as Error).message, 'Credit amount must be positive');
        }

        try {
            await debit(db, 'ws-1', 0, 'BAD:zero-debit');
            t.fail('Should reject zero debit');
        } catch (err) {
            t.equal((err as Error).message, 'Debit amount must be positive');
        }
    });

    await t.test('Test 8: Handing metadata correctly', async (t) => {
        const db = createMockLedgerDb();
        await credit(db, 'ws-meta', 10, 'CREDIT:1', { reason: 'bonus' });
        await debit(db, 'ws-meta', 5, 'DEBIT:1', { job: '123' });
        const balance = await getBalance(db, 'ws-meta');
        t.equal(balance, 5);
    });

});

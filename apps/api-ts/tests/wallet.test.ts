import tap from 'tap';
import { getBalance, credit, debit } from '../src/lib/wallet';

const test = tap.test;

test('Wallet Service (Ledger)', async (t) => {
    function buildDb() {
        const rows: Array<any> = [];
        return {
            rows,
            query: async (sql: string, params: any[]) => {
                const s = sql.toLowerCase();

                // 1. INSERT (Credit or Debit) - Priority to avoid CTE collision
                if (s.includes('insert into wallet_ledger')) {
                    const isDebit = s.includes('with') || s.includes('balance_check');
                    const wid = isDebit ? params[0] : params[1];
                    const amount = params[2];
                    const ref = params[3];
                    const type = isDebit ? 'debit' : 'credit';

                    if (isDebit) {
                        const currentBal = rows.reduce((acc, r) => {
                            if (r.workspace_id !== wid) return acc;
                            return r.type === 'credit' ? acc + r.amount : acc - r.amount;
                        }, 0);
                        if (currentBal < amount) return { rowCount: 0, rows: [] };
                    }

                    // Idempotency check
                    if (rows.find(r => r.workspace_id === wid && r.reference_id === ref && r.type === type)) {
                        return { rowCount: 0, rows: [] };
                    }

                    rows.push({ workspace_id: wid, type, amount, reference_id: ref });
                    return { rowCount: 1, rows: [] };
                }

                // 2. getBalance
                if (s.includes('select coalesce(sum')) {
                    const wid = params[0];
                    const bal = rows.reduce((acc, r) => {
                        if (r.workspace_id !== wid) return acc;
                        return r.type === 'credit' ? acc + r.amount : acc - r.amount;
                    }, 0);
                    return { rowCount: 1, rows: [{ balance: bal.toString() }] };
                }

                // 3. Conflict check (debit fallback)
                if (s.includes('select id from wallet_ledger')) {
                    const found = rows.find(r => r.workspace_id === params[0] && r.reference_id === params[1] && r.type === 'debit');
                    return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
                }

                return { rowCount: 0, rows: [] };
            }
        } as any;
    }

    await t.test('Full Sequence', async (t) => {
        const db = buildDb();
        const WID = 'ws_final_ok';

        await credit(db, WID, 100, 'c1', { event_type: 'TopupConfirmed' });
        t.equal(await getBalance(db, WID), 100);

        const d1 = await debit(db, WID, 40, 'd1', { event_type: 'GenerationUsageDebit' });
        t.ok(d1.inserted);
        t.equal(await getBalance(db, WID), 60);

        const d2 = await debit(db, WID, 40, 'd1', { event_type: 'GenerationUsageDebit' });
        t.notOk(d2.inserted);
        t.equal(await getBalance(db, WID), 60);

        await t.rejects(debit(db, WID, 100, 'd2', { event_type: 'GenerationUsageDebit' }), /Insufficient/);
    });
});

import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import voucherRoutes from '../src/routes/voucher';

const test = tap.test;

test('Voucher Module', async (t) => {
    const WORKSPACE_ID = 'ws_voucher_test';
    const USER_ID = 'user_voucher_1';

    function buildApp() {
        const vouchers: Record<string, any> = {};
        const receipts: Record<string, any> = {};
        const ledger: Array<any> = [];

        const fastify = Fastify();

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                // Workspace membership
                if (sql.includes('SELECT 1 FROM workspace_members')) {
                    return { rowCount: 1, rows: [] };
                }

                // Get voucher (Voucher Service implementation)
                if (sql.includes('SELECT credits, status, expires_at')) {
                    const [code] = values;
                    const found = vouchers[code];
                    if (found) return { rowCount: 1, rows: [found] };
                    return { rowCount: 0, rows: [] };
                }

                // Update voucher status (Voucher Service implementation)
                if (sql.includes('UPDATE voucher_codes')) {
                    const [wid, code] = values;
                    if (vouchers[code]) {
                        vouchers[code].status = 'redeemed';
                        vouchers[code].workspace_id = wid;
                    }
                    return { rowCount: 1, rows: [] };
                }

                // Insert receipt
                if (sql.includes('INSERT INTO receipts')) {
                    const [id, wid, extRef, amount, status] = values;
                    receipts[id] = { id, workspace_id: wid, external_ref: extRef, amount, status };
                    return { rowCount: 1, rows: [] };
                }

                // Update receipt with ledger_id
                if (sql.includes('UPDATE receipts SET ledger_id = $1 WHERE id = $2')) {
                    const [lid, rid] = values;
                    if (receipts[rid]) receipts[rid].ledger_id = lid;
                    return { rowCount: 1, rows: [] };
                }

                // Ledger Credit
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    const [id, wid, amount, ref] = values;
                    ledger.push({ id, workspace_id: wid, amount, reference_id: ref, type: 'credit' });
                    return { rowCount: 1, rows: [] };
                }

                if (sql.includes('INSERT INTO voucher_codes (code, credits, status, expires_at)')) {
                    const [code, credits, expiresAt] = values;
                    vouchers[code] = { code, credits, status: 'active', expires_at: expiresAt || null };
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => {
                return {
                    query: async (sql: string, values: any[]) => {
                        return (fastify as any).db.query(sql, values);
                    },
                    release: () => { }
                };
            }
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(voucherRoutes);

        return { fastify, vouchers, receipts, ledger };
    }

    await t.test('Redeem: Valid Voucher', async (t) => {
        const { fastify, vouchers, ledger, receipts } = buildApp();
        await fastify.ready();

        vouchers['VALID123'] = { code: 'VALID123', credits: 50, status: 'active', expires_at: null };

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/voucher/redeem`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { code: 'VALID123' }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.success, true);
        t.equal(body.credits_redeemed, 50);

        // Verify state
        t.equal(vouchers['VALID123'].status, 'redeemed');
        t.equal(ledger.length, 1);
        t.equal(ledger[0].amount, 50);
        t.equal(Object.keys(receipts).length, 1);

        await fastify.close();
    });

    await t.test('Redeem: Expired Voucher', async (t) => {
        const { fastify, vouchers } = buildApp();
        await fastify.ready();

        vouchers['EXPIRED'] = {
            code: 'EXPIRED',
            credits: 10,
            status: 'active',
            expires_at: new Date(Date.now() - 1000).toISOString()
        };

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/voucher/redeem`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { code: 'EXPIRED' }
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().message, /expired/i);

        await fastify.close();
    });

    await t.test('Redeem: Already Used', async (t) => {
        const { fastify, vouchers } = buildApp();
        await fastify.ready();

        vouchers['USED'] = { code: 'USED', credits: 10, status: 'redeemed' };

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/voucher/redeem`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { code: 'USED' }
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().message, /already redeemed/i);

        await fastify.close();
    });

    await t.test('Redeem: Invalid Code', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/voucher/redeem`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { code: 'NOT_EXIST' }
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().message, /not found/i);

        await fastify.close();
    });

    await t.test('Admin: Generate Vouchers', async (t) => {
        const { fastify, vouchers } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/admin/vouchers/generate',
            payload: {
                count: 5,
                credits: 100,
                expires_in_days: 30
            }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.success, true);
        t.equal(body.count, 5);
        t.equal(Object.keys(vouchers).length, 5);

        const firstVoucher = Object.values(vouchers)[0] as any;
        t.equal(firstVoucher.credits, 100);
        t.ok(firstVoucher.expires_at, 'should have expiration date');

        await fastify.close();
    });

    await t.test('Admin: Validation', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/admin/vouchers/generate',
            payload: { count: 101, credits: 10 } // Over max count
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });
});

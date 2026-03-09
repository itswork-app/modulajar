import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import walletRoutes from '../src/routes/wallet';

const test = tap.test;
const WORKSPACE_ID = 'ws_wallet_routes';
const USER_ID = 'user_wallet_routes';

function buildApp(mocks: {
    dbQuery?: (sql: string, values: any[]) => Promise<any>;
} = {}) {
    const fastify = Fastify();
    fastify.decorate('db', {
        query: mocks.dbQuery || (async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
            return { rowCount: 0, rows: [] };
        }),
    } as any);
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);

    // The walletRoutes plugin already applies { prefix: '/w' } internally
    fastify.register(walletRoutes);

    return fastify;
}

test('Wallet Routes', async (t) => {
    await t.test('GET /w/:workspaceId/wallet/summary - returns proper usage counts', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [] };

                // getBalance mock
                if (sql.includes('AS balance')) return { rowCount: 1, rows: [{ balance: '150' }] };

                // docs generated mock -> COUNT(id)
                if (sql.includes('generate_module')) return { rowCount: 1, rows: [{ count: '24' }] };

                // month usage mock -> SUM(amount) AS usage
                if (sql.includes("date_trunc('month', created_at)")) return { rowCount: 1, rows: [{ usage: '12' }] };

                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/wallet/summary`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const json = res.json();
        t.equal(json.credits_remaining, 150);
        t.equal(json.documents_generated, 24);
        t.equal(json.month_usage, 12);

        await fastify.close();
    });

    await t.test('GET /w/:workspaceId/wallet/transactions - maps ledger rows cleanly', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [] };

                if (sql.includes('wallet_ledger')) {
                    return {
                        rowCount: 2,
                        rows: [
                            {
                                date: new Date('2026-03-01T12:00:00Z'),
                                type: 'credit',
                                amount: 100,
                                metadata: { transaction_type: 'topup', note: 'Promo' }
                            },
                            {
                                date: new Date('2026-03-05T12:00:00Z'),
                                type: 'debit',
                                amount: 1,
                                metadata: { transaction_type: 'generate_module', note: 'Matematika' }
                            }
                        ]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/wallet/transactions`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const json = res.json();
        t.equal(json.length, 2);
        t.equal(json[0].type, 'topup');
        t.equal(json[0].amount, 100);
        t.equal(json[1].type, 'generate_module');
        t.equal(json[1].amount, -1);

        await fastify.close();
    });

    await t.test('GET /w/:workspaceId/wallet/summary - handles empty/null rows', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [] };
                // Return empty rows to hit fallback branches (|| '0')
                if (sql.includes('AS balance')) return { rowCount: 0, rows: [{}] };
                if (sql.includes('generate_module')) return { rowCount: 0, rows: [{}] };
                if (sql.includes("date_trunc('month', created_at)")) return { rowCount: 0, rows: [{}] };
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/wallet/summary`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const json = res.json();
        t.equal(json.credits_remaining, 0);
        t.equal(json.documents_generated, 0);
        t.equal(json.month_usage, 0);

        await fastify.close();
    });

    await t.test('GET /w/:workspaceId/wallet/transactions - handles null metadata and fallback types', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('workspace_members')) return { rowCount: 1, rows: [] };

                if (sql.includes('wallet_ledger')) {
                    return {
                        rowCount: 2,
                        rows: [
                            {
                                date: new Date('2026-03-01T12:00:00Z'),
                                type: 'credit',
                                amount: 50,
                                metadata: null // null metadata - triggers || {} fallback
                            },
                            {
                                date: new Date('2026-03-02T12:00:00Z'),
                                type: 'debit',
                                amount: 1,
                                metadata: {} // empty metadata - triggers fallback type and note
                            }
                        ]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/wallet/transactions`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const json = res.json();
        t.equal(json.length, 2);
        // credit with null metadata -> fallback type 'topup', fallback note ''
        t.equal(json[0].type, 'topup');
        t.equal(json[0].note, '');
        // debit with empty metadata -> fallback type 'generate_module', fallback note ''
        t.equal(json[1].type, 'generate_module');
        t.equal(json[1].note, '');

        await fastify.close();
    });
});

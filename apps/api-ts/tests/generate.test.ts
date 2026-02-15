import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import generateRoutes from '../src/routes/generate';
import { ulid } from 'ulid';

const test = tap.test;

test('Generate Semester Endpoint', async (t) => {
    // Track DB state in memory
    const jobs: Record<string, any> = {};
    const ledger: Array<{ id: string; workspace_id: string; type: string; amount: number; reference: string }> = [];
    const WORKSPACE_ID = 'ws_test_001';
    const USER_ID = 'user_1';

    // Seed initial balance of 10 credits
    ledger.push({
        id: ulid(),
        workspace_id: WORKSPACE_ID,
        type: 'credit',
        amount: 10,
        reference: 'SEED'
    });

    const buildApp = () => {
        const fastify = Fastify();

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                // Workspace membership check
                if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                    const [wid, uid] = values || [];
                    if (wid === WORKSPACE_ID && uid === USER_ID) {
                        return { rowCount: 1, rows: [] };
                    }
                    return { rowCount: 0, rows: [] };
                }

                // Existing job lookup by idempotency_key
                if (sql.includes('SELECT id, status FROM generation_jobs WHERE idempotency_key')) {
                    const [key] = values;
                    const found = Object.values(jobs).find((j: any) => j.idempotency_key === key);
                    if (found) {
                        return { rowCount: 1, rows: [found] };
                    }
                    return { rowCount: 0, rows: [] };
                }

                // Active jobs check
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('pending')) {
                    const [wid] = values;
                    const active = Object.values(jobs).filter(
                        (j: any) => j.workspace_id === wid && (j.status === 'pending' || j.status === 'running')
                    );
                    return { rowCount: active.length, rows: active };
                }

                // Balance query
                if (sql.includes('SELECT COALESCE(SUM')) {
                    const [wid] = values;
                    const balance = ledger
                        .filter(l => l.workspace_id === wid)
                        .reduce((sum, l) => sum + (l.type === 'credit' ? l.amount : -l.amount), 0);
                    return { rowCount: 1, rows: [{ balance: String(balance) }] };
                }

                // Insert package
                if (sql.includes('INSERT INTO packages')) {
                    return { rowCount: 1, rows: [] };
                }

                // Insert generation_jobs
                if (sql.includes('INSERT INTO generation_jobs')) {
                    const [id, wid, pid, status, key] = values;
                    jobs[id] = { id, workspace_id: wid, package_id: pid, status, idempotency_key: key };
                    return { rowCount: 1, rows: [] };
                }

                // Debit existence check
                if (sql.includes('SELECT id FROM wallet_ledger WHERE reference')) {
                    const [ref] = values;
                    const found = ledger.find(l => l.reference === ref);
                    return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
                }

                // Insert wallet_ledger
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    const [id, wid, type, amount, ref] = values;
                    ledger.push({ id, workspace_id: wid, type, amount, reference: ref });
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({
                query: async () => ({ rowCount: 1, rows: [] }),
                release: () => { },
            } as any),
            totalCount: 0,
            idleCount: 0,
            waitingCount: 0,
            end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(generateRoutes);
        return fastify;
    };

    // Test 1: Create job successfully
    await t.test('Create generate job — 201', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                pack_id: 'merdeka-sd4-v1',
                semester: 'S1',
                tahun_ajaran: '2025/2026'
            }
        });

        t.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.ok(body.job_id, 'job_id returned');
        t.equal(body.status, 'pending');
        t.equal(body.cost, 5);
        t.equal(body.balance_after, 5); // 10 - 5

        await fastify.close();
    });

    // Test 2: Duplicate request returns same job (idempotent)
    await t.test('Duplicate request returns existing job — 200 idempotent', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        // First request
        const res1 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { pack_id: 'merdeka-sd4-v1', semester: 'S1', tahun_ajaran: '2025/2026' }
        });

        // Second request (same params)
        const res2 = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { pack_id: 'merdeka-sd4-v1', semester: 'S1', tahun_ajaran: '2025/2026' }
        });

        t.equal(res2.statusCode, 200);
        const body2 = res2.json();
        t.equal(body2.idempotent, true, 'Should be marked idempotent');
        t.equal(body2.job_id, res1.json().job_id, 'Same job returned');

        // Verify single debit
        const debitCount = ledger.filter(l => l.type === 'debit').length;
        t.equal(debitCount, 1, `Expected 1 debit, got ${debitCount}`);

        await fastify.close();
    });

    // Test 3: Insufficient balance
    await t.test('Insufficient balance — 402', async (t) => {
        // Create fresh app with zero balance
        const emptyLedger: typeof ledger = [];
        const emptyJobs: typeof jobs = {};

        const fastify = Fastify();
        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                    return { rowCount: 1, rows: [] };
                }
                if (sql.includes('SELECT id, status FROM generation_jobs WHERE idempotency_key')) {
                    return { rowCount: 0, rows: [] };
                }
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('pending')) {
                    return { rowCount: 0, rows: [] };
                }
                if (sql.includes('SELECT COALESCE(SUM')) {
                    return { rowCount: 1, rows: [{ balance: '0' }] };
                }
                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
            totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(generateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { pack_id: 'merdeka-sd4-v1', semester: 'S1', tahun_ajaran: '2025/2026' }
        });

        t.equal(res.statusCode, 402);
        t.equal(res.json().error, 'Insufficient balance');

        await fastify.close();
    });

    // Test 4: Concurrency guard
    await t.test('Concurrency guard — 409 when active job exists', async (t) => {
        const fastify = Fastify();
        // Pre-seed an active job
        const activeJob = { id: 'existing-job', workspace_id: WORKSPACE_ID, status: 'running' };

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                    return { rowCount: 1, rows: [] };
                }
                if (sql.includes('SELECT id, status FROM generation_jobs WHERE idempotency_key')) {
                    return { rowCount: 0, rows: [] }; // Different idempotency key
                }
                if (sql.includes('SELECT id FROM generation_jobs') && sql.includes('pending')) {
                    return { rowCount: 1, rows: [activeJob] };
                }
                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
            totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(generateRoutes);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/generate-semester`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { pack_id: 'merdeka-sd4-v1', semester: 'S1', tahun_ajaran: '2025/2026-new' }
        });

        t.equal(res.statusCode, 409);

        await fastify.close();
    });

    t.teardown(() => { });
});

import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import authRoutes from '../src/routes/auth';

const test = tap.test;

// mock_auth maps:
//   'Bearer user_1' → clerk_user_id: 'user_1'
//   anything else   → clerk_user_id: 'test_user'
const AUTH_TOKEN = 'Bearer user_1';
const CLERK_USER_ID = 'user_1';

/**
 * Build a test Fastify app wired with mock_auth + authRoutes.
 * DB behaviour can be customised per-test with overrides.
 */
function buildApp(opts: {
    memberRows?: number;          // 0 = new user, 1 = already bootstrapped
    workspaceRows?: any[];        // rows returned by GET /me query
    simulateInsertError?: boolean;// make client.query throw after BEGIN
    existingWorkspaceRows?: any[];// rows returned by SELECT id FROM workspaces
} = {}) {
    const fastify = Fastify();
    const {
        memberRows = 0,
        workspaceRows = [{ id: 'ws-1', name: 'My Workspace', clerk_org_id: 'org-1', role: 'owner' }],
        simulateInsertError = false,
        existingWorkspaceRows = []
    } = opts;

    fastify.decorate('db', {
        // Pool-level query (non-transactional)
        query: async (sql: string, _values: any[]) => {
            // GET /me — user's workspaces
            if (sql.includes('SELECT w.id, w.name, w.clerk_org_id')) {
                return { rowCount: workspaceRows.length, rows: workspaceRows };
            }
            // POST /bootstrap — has membership?
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                return { rowCount: memberRows, rows: [] };
            }
            return { rowCount: 0, rows: [] };
        },
        // Client checkout for transactional bootstrap
        connect: async () => {
            return {
                query: async (sql: string, _values?: any[]) => {
                    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK')
                        return { rowCount: 0, rows: [] };

                    if (simulateInsertError)
                        throw new Error('Simulated DB insert failure');

                    // SELECT id FROM workspaces WHERE clerk_org_id = ?
                    if (sql.includes('SELECT id FROM workspaces') && sql.includes('clerk_org_id')) {
                        return {
                            rowCount: existingWorkspaceRows.length,
                            rows: existingWorkspaceRows
                        };
                    }

                    // INSERT INTO workspaces / workspace_members
                    return { rowCount: 1, rows: [] };
                },
                release: () => { }
            } as any;
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(authRoutes);
    return fastify;
}

// ═══════════════════════════════════════════
// GET /me
// ═══════════════════════════════════════════
test('GET /me', async (t) => {

    await t.test('200 — returns clerk_user_id and workspace list', async (t) => {
        const fastify = buildApp({
            workspaceRows: [{ id: 'ws-1', name: 'Work', clerk_org_id: 'org-1', role: 'owner' }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/me',
            headers: { Authorization: AUTH_TOKEN }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.ok(body.clerk_user_id, 'has clerk_user_id');
        t.equal(body.clerk_user_id, CLERK_USER_ID);
        t.ok(Array.isArray(body.workspaces), 'has workspaces array');
        t.equal(body.workspaces.length, 1);

        await fastify.close();
    });

    await t.test('200 — empty workspace list when user has no workspaces', async (t) => {
        const fastify = buildApp({ workspaceRows: [] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/me',
            headers: { Authorization: AUTH_TOKEN }
        });

        t.equal(res.statusCode, 200);
        t.same(res.json().workspaces, []);

        await fastify.close();
    });

    await t.test('401 — no auth header', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({ method: 'GET', url: '/me' });
        t.equal(res.statusCode, 401);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// POST /bootstrap — already bootstrapped
// ═══════════════════════════════════════════
test('POST /bootstrap — already bootstrapped', async (t) => {
    const fastify = buildApp({ memberRows: 1 });
    await fastify.ready();

    const res = await fastify.inject({
        method: 'POST',
        url: '/bootstrap',
        headers: { Authorization: AUTH_TOKEN }
    });

    t.equal(res.statusCode, 200);
    t.equal(res.json().message, 'User already bootstrapped');

    await fastify.close();
});

// ═══════════════════════════════════════════
// POST /bootstrap — new user (success paths)
// ═══════════════════════════════════════════
test('POST /bootstrap — new user creates workspace', async (t) => {

    await t.test('creates workspace with default name + personal org fallback', async (t) => {
        const fastify = buildApp({ memberRows: 0 });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/bootstrap',
            headers: { Authorization: AUTH_TOKEN }
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.status, 'bootstrapped');
        t.ok(body.workspaceId, 'returns workspaceId');

        await fastify.close();
    });

    await t.test('custom name + clerk_org_id are accepted', async (t) => {
        const fastify = buildApp({ memberRows: 0 });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/bootstrap',
            headers: { Authorization: AUTH_TOKEN },
            payload: { name: 'Sekolah Kita', clerk_org_id: 'org-custom-123' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'bootstrapped');

        await fastify.close();
    });

    await t.test('existing workspace resolved via SELECT after ON CONFLICT DO NOTHING', async (t) => {
        // existing.rows.length > 0 → finalWorkspaceId = existing.rows[0].id
        const fastify = buildApp({
            memberRows: 0,
            existingWorkspaceRows: [{ id: 'existing-ws-999' }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/bootstrap',
            headers: { Authorization: AUTH_TOKEN }
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.status, 'bootstrapped');
        t.equal(body.workspaceId, 'existing-ws-999', 'should resolve existing workspace id');

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// POST /bootstrap — DB error → ROLLBACK + rethrow
// ═══════════════════════════════════════════
test('POST /bootstrap — DB error triggers ROLLBACK', async (t) => {
    const fastify = buildApp({ memberRows: 0, simulateInsertError: true });
    await fastify.ready();

    const res = await fastify.inject({
        method: 'POST',
        url: '/bootstrap',
        headers: { Authorization: AUTH_TOKEN }
    });

    // Fastify translates unhandled throws to 500
    t.equal(res.statusCode, 500, `Expected 500 on DB error, got ${res.statusCode}: ${res.body}`);

    await fastify.close();
});

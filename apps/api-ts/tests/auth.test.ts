import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import authRoutes from '../src/routes/auth';

const test = tap.test;

// ═══════════════════════════════════════════
// AUTH ROUTE TESTS
// ═══════════════════════════════════════════

test('Auth Routes', async (t) => {
    const MOCK_TOKEN = 'Bearer user_1';
    const USER_ID = 'user_1'; // must match mock_auth.ts user_1 mapping

    function buildApp() {
        const workspaces: Record<string, any> = {};
        const members: Record<string, any[]> = {};

        const app = Fastify({ logger: false });

        // Mock auth plugin (injects verifyClerk decorator)
        app.register(mockAuthPlugin);

        // Mock DB
        app.decorate('db', {
            query: async (sql: string, params: any[]) => {
                // GET /me: SELECT workspaces
                if (sql.includes('FROM workspaces w')) {
                    const userMembers = members[params[0]] || [];
                    const rows = userMembers.map((m: any) => ({
                        id: m.workspace_id,
                        name: workspaces[m.workspace_id]?.name || 'Unknown',
                        clerk_org_id: workspaces[m.workspace_id]?.clerk_org_id,
                        role: m.role,
                    }));
                    return { rows, rowCount: rows.length };
                }
                // POST /bootstrap: check membership
                if (sql.includes('FROM workspace_members WHERE clerk_user_id')) {
                    const userMembers = members[params[0]] || [];
                    return { rows: userMembers, rowCount: userMembers.length };
                }
                return { rows: [], rowCount: 0 };
            },
            connect: async () => {
                return {
                    query: async (sql: string, params?: any[]) => {
                        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                            return { rows: [], rowCount: 0 };
                        }
                        if (sql.includes('INSERT INTO workspaces')) {
                            const wsId = params![0];
                            const orgId = params![1];
                            const name = params![2];
                            if (!workspaces[wsId]) {
                                workspaces[wsId] = { id: wsId, clerk_org_id: orgId, name };
                            }
                            return { rows: [], rowCount: 1 };
                        }
                        if (sql.includes('INSERT INTO workspace_members')) {
                            const wsId = params![1];
                            const userId = params![2];
                            const role = params![3];
                            if (!members[userId]) members[userId] = [];
                            const exists = members[userId].some((m: any) => m.workspace_id === wsId);
                            if (!exists) {
                                members[userId].push({ workspace_id: wsId, role });
                            }
                            return { rows: [], rowCount: 1 };
                        }
                        // SELECT workspace by clerk_org_id (inside transaction)
                        if (sql.includes('FROM workspaces WHERE clerk_org_id')) {
                            const orgId = params![0];
                            const ws = Object.values(workspaces).find((w: any) => w.clerk_org_id === orgId) as any;
                            return { rows: ws ? [ws] : [], rowCount: ws ? 1 : 0 };
                        }
                        return { rows: [], rowCount: 0 };
                    },
                    release: () => { },
                };
            },
        } as any);

        app.register(authRoutes, { prefix: '/auth' });
        return app;
    }

    // ─── GET /me ───────────────────────────────────────────────────
    await t.test('GET /me returns 401 without auth', async (t) => {
        const app = buildApp();
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: '/auth/me',
            // No authorization header
        });

        t.equal(res.statusCode, 401, 'Should return 401 without auth header');
        await app.close();
    });

    await t.test('GET /me returns clerk_user_id and workspaces', async (t) => {
        const app = buildApp();
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: { authorization: MOCK_TOKEN },
        });

        t.equal(res.statusCode, 200, 'Should return 200');
        const body = JSON.parse(res.payload);
        t.equal(body.clerk_user_id, USER_ID, 'Should return correct user ID');
        t.ok(Array.isArray(body.workspaces), 'Should return workspaces array');
        await app.close();
    });

    // ─── POST /bootstrap — new user ────────────────────────────────
    await t.test('POST /bootstrap creates workspace for new user', async (t) => {
        const app = buildApp();
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/auth/bootstrap',
            headers: {
                authorization: MOCK_TOKEN,
                'content-type': 'application/json',
            },
            payload: JSON.stringify({ name: 'Test Workspace' }),
        });

        t.equal(res.statusCode, 200, 'Should return 200');
        const body = JSON.parse(res.payload);
        t.equal(body.status, 'bootstrapped', 'Should return bootstrapped status');
        t.ok(body.workspaceId, 'Should return workspaceId');
        await app.close();
    });

    // ─── POST /bootstrap — idempotent ──────────────────────────────
    await t.test('POST /bootstrap is idempotent for existing user', async (t) => {
        const app = buildApp();
        await app.ready();

        // First bootstrap
        const first = await app.inject({
            method: 'POST',
            url: '/auth/bootstrap',
            headers: {
                authorization: MOCK_TOKEN,
                'content-type': 'application/json',
            },
            payload: JSON.stringify({ name: 'My Workspace' }),
        });
        t.equal(first.statusCode, 200, 'First bootstrap should succeed');

        // Second bootstrap (idempotent) — same user, now has a workspace
        const res = await app.inject({
            method: 'POST',
            url: '/auth/bootstrap',
            headers: {
                authorization: MOCK_TOKEN,
                'content-type': 'application/json',
            },
            payload: JSON.stringify({ name: 'My Workspace' }),
        });

        t.equal(res.statusCode, 200, 'Should return 200 for idempotent call');
        const body = JSON.parse(res.payload);
        t.equal(body.message, 'User already bootstrapped', 'Should indicate already bootstrapped');
        await app.close();
    });

    // ─── POST /bootstrap — with custom clerk_org_id ─────────────────
    await t.test('POST /bootstrap accepts custom clerk_org_id', async (t) => {
        const app = buildApp();
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/auth/bootstrap',
            headers: {
                authorization: MOCK_TOKEN,
                'content-type': 'application/json',
            },
            payload: JSON.stringify({
                clerk_org_id: 'org_custom_123',
                name: 'Custom Org Workspace',
            }),
        });

        t.equal(res.statusCode, 200, 'Should return 200');
        const body = JSON.parse(res.payload);
        t.equal(body.status, 'bootstrapped', 'Should bootstrap successfully');
        t.ok(body.workspaceId, 'Should return workspaceId');
        await app.close();
    });
});

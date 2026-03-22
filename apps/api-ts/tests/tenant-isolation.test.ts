import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';

const test = tap.test;

/**
 * Mock DB factory for tenant isolation tests.
 * ws_1 has user_1 as member.
 * ws_2 has user_2 as member.
 * Neither user has access to the other's workspace.
 */
function createMockDb() {
    return {
        query: async (sql: string, values: any[]) => {
            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                const [workspaceId, clerkUserId] = values || [];
                // user_1 → ws_1 only
                if (workspaceId === 'ws_1' && clerkUserId === 'user_1') {
                    return { rowCount: 1, rows: [{}] };
                }
                // user_2 → ws_2 only
                if (workspaceId === 'ws_2' && clerkUserId === 'user_2') {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }
            // Generation jobs list (workspace-scoped)
            if (sql.includes('FROM generation_jobs')) {
                return { rowCount: 0, rows: [] };
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
    } as any;
}

function buildApp() {
    const fastify = Fastify();
    fastify.decorate('db', createMockDb());
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(workspaceRoutes);
    return fastify;
}

// ═══════════════════════════════════════════
// Test 1: Cross-tenant access denied
// ═══════════════════════════════════════════
test('Cross-tenant access: user_1 cannot access ws_2', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_2/ping',
        headers: { Authorization: 'Bearer user_1' }
    });

    t.equal(res.statusCode, 403, 'Should reject cross-tenant access');
    const body = res.json();
    t.equal(body.error, 'Forbidden');

    t.teardown(() => app.close());
});

test('Cross-tenant access: user_2 cannot access ws_1', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_1/ping',
        headers: { Authorization: 'Bearer user_2' }
    });

    t.equal(res.statusCode, 403, 'Should reject cross-tenant access');

    t.teardown(() => app.close());
});

// ═══════════════════════════════════════════
// Test 2: Missing workspace context rejected
// ═══════════════════════════════════════════
test('Missing workspace context: request without workspaceId path param', async (t) => {
    const app = Fastify();
    app.decorate('db', createMockDb());
    app.register(mockAuthPlugin);
    app.register(workspaceGuardPlugin);

    // Register a route inside a plugin so workspaceGuard is available
    app.register(async (childServer) => {
        childServer.get('/no-workspace', {
            preHandler: [childServer.workspaceGuard]
        }, async () => ({ status: 'should-not-reach' }));
    });

    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/no-workspace',
        headers: { Authorization: 'Bearer user_1' }
    });

    t.equal(res.statusCode, 403, 'Should reject when workspace context missing');
    const body = res.json();
    t.equal(body.error, 'Workspace context required');

    t.teardown(() => app.close());
});

// ═══════════════════════════════════════════
// Test 3: Unauthenticated request rejected
// ═══════════════════════════════════════════
test('Unauthenticated request: no token', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_1/ping'
        // No Authorization header
    });

    t.equal(res.statusCode, 401, 'Should reject unauthenticated request');

    t.teardown(() => app.close());
});

test('Unauthenticated request: invalid token', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_1/ping',
        headers: { Authorization: 'Bearer invalid' }
    });

    t.equal(res.statusCode, 401, 'Should reject invalid token');

    t.teardown(() => app.close());
});

// ═══════════════════════════════════════════
// Test 4: Valid access succeeds
// ═══════════════════════════════════════════
test('Valid access: user_1 can access ws_1', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_1/ping',
        headers: { Authorization: 'Bearer user_1' }
    });

    t.equal(res.statusCode, 200, 'Should allow valid workspace member');
    const body = res.json();
    t.equal(body.workspaceId, 'ws_1');
    t.equal(body.userId, 'user_1');

    t.teardown(() => app.close());
});

test('Valid access: user_2 can access ws_2', async (t) => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_2/ping',
        headers: { Authorization: 'Bearer user_2' }
    });

    t.equal(res.statusCode, 200, 'Should allow valid workspace member');
    const body = res.json();
    t.equal(body.workspaceId, 'ws_2');

    t.teardown(() => app.close());
});

// ═══════════════════════════════════════════
// Test 5: Workspace-scoped document list
// ═══════════════════════════════════════════
test('Document list is workspace-scoped', async (t) => {
    const app = buildApp();
    await app.ready();

    // user_1 accessing their own workspace
    const res = await app.inject({
        method: 'GET',
        url: '/w/ws_1/documents',
        headers: { Authorization: 'Bearer user_1' }
    });

    t.equal(res.statusCode, 200, 'Should return documents');
    t.ok(res.json().documents, 'Should have documents array');

    // user_1 accessing user_2's workspace
    const crossRes = await app.inject({
        method: 'GET',
        url: '/w/ws_2/documents',
        headers: { Authorization: 'Bearer user_1' }
    });

    t.equal(crossRes.statusCode, 403, 'Should reject cross-tenant document list');

    t.teardown(() => app.close());
});

import tap from 'tap';
import Fastify from 'fastify';
// import dbPlugin from '../src/plugins/db';
import mockAuthPlugin from '../src/plugins/mock_auth'; // Use mock
import authRoutes from '../src/routes/auth';
import workspaceRoutes from '../src/routes/workspace';
import dotenv from 'dotenv';
import { ulid } from 'ulid';

dotenv.config();

// Ensure we are testing against a test DB or handling cleanup
const test = tap.test;

test('Workspace Auth & Guard', async (t) => {
    const fastify = Fastify();

    // Mock DB Plugin
    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            // Mock /me response
            if (sql.includes('SELECT w.id, w.name')) {
                return {
                    rows: [{ id: 'ws_1', name: 'Test WS', clerk_org_id: 'org_1', role: 'owner' }],
                    rowCount: 1
                };
            }
            // Mock /bootstrap check
            if (sql.includes('SELECT 1 FROM workspace_members WHERE clerk_user_id')) {
                return { rowCount: 0, rows: [] }; // User not bootstrapped
            }
            // Mock Workspace Guard check
            if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                const [workspaceId, clerk_user_id] = values || [];
                // User 1 has access to ws_1
                if (workspaceId === 'ws_1' && clerk_user_id === 'user_1') {
                    return { rowCount: 1, rows: [] };
                }
                return { rowCount: 0, rows: [] };
            }
            // Mock Insert
            if (sql.includes('INSERT INTO')) {
                return { rowCount: 1, rows: [] };
            }
            return { rows: [], rowCount: 0 };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { },
            // Add dummy props to satisfy PoolClient if needed, or cast as any
        } as any),
        // Add dummy props to satisfy Pool
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
        end: async () => { },
    } as any);

    // Register MOCK Auth
    fastify.register(mockAuthPlugin);

    fastify.register(authRoutes);
    fastify.register(workspaceRoutes);

    await fastify.ready();

    // 1. Unauthorized Access
    await t.test('Accessing /w/:id/ping without token should fail', async (t) => {
        const response = await fastify.inject({
            method: 'GET',
            url: `/w/${ulid()}/ping`
            // No headers
        });
        t.equal(response.statusCode, 401);
    });

    // 2. Bootstrap & Authorized Access
    await t.test('Bootstrap user and access workspace', async (t) => {
        const userId = 'user_1';

        // Bootstrap
        const bootstrapRes = await fastify.inject({
            method: 'POST',
            url: '/bootstrap',
            headers: { Authorization: `Bearer ${userId}` },
            payload: { name: 'Test Workspace' }
        });

        t.equal(bootstrapRes.statusCode, 200, 'Bootstrap failed');
        const { workspaceId } = bootstrapRes.json();
        t.ok(workspaceId, 'Workspace ID returned');

        // Access Ping (Authorized)
        const pingRes = await fastify.inject({
            method: 'GET',
            url: `/w/ws_1/ping`,
            headers: { Authorization: `Bearer ${userId}` }
        });
        t.equal(pingRes.statusCode, 200, 'Ping failed');
        t.equal(pingRes.json().workspaceId, 'ws_1');
    });

    // 3. Forbidden Access (Wrong User)
    await t.test('Another user cannot access workspace', async (t) => {
        // Rely on previous workspaceId, but we need to extract it or create new setup
        // For simplicity, let's bootstrap user_2 and verify they can't access user_1's stuff
        // But we need user_1's workspace ID.

        // Let's re-bootstrap user_1 to get ID (idempotent) or just fetch /me
        const meRes = await fastify.inject({
            method: 'GET',
            url: '/me',
            headers: { Authorization: 'Bearer user_1' }
        });
        const workspaceId = meRes.json().workspaces[0].id;

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/ws_1/ping`,
            headers: { Authorization: 'Bearer user_2' } // Different user
        });

        t.equal(res.statusCode, 403);
    });

    t.teardown(async () => {
        await fastify.close();
    });
});

import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../../src/plugins/mock_auth';
import workspaceGuardPlugin from '../../src/plugins/workspace-guard';
import modulesRoutes from '../../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_sec_001';
const OTHER_WORKSPACE = 'ws_sec_002';
const USER_ID = 'user_sec_1';
const MODULE_ID = 'mod_sec_123';

function buildApp(mocks: {
    dbQuery?: (sql: string, values: any[]) => Promise<any>;
} = {}) {
    const fastify = Fastify();
    fastify.decorate('db', {
        query: mocks.dbQuery || (async (sql: string, values: any[]) => {
            // Default: user is in WORKSPACE_ID, but NOT in OTHER_WORKSPACE
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                const wsId = values[1];
                if (wsId === WORKSPACE_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }
            return { rowCount: 0, rows: [] };
        }),
    } as any);
    fastify.decorate('storage', { generateSignedUrl: async () => 'http://test' });
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('Module Editor Security — Workspace Isolation', async (t) => {

    const endpoints = [
        { method: 'GET', url: `/w/${OTHER_WORKSPACE}/modules/${MODULE_ID}/editor` },
        { method: 'PATCH', url: `/w/${OTHER_WORKSPACE}/modules/${MODULE_ID}`, body: { patch: {} } },
        { method: 'POST', url: `/w/${OTHER_WORKSPACE}/modules/${MODULE_ID}/ai-assist`, body: { section: 's', action: 'a', content: 'c' } },
        { method: 'GET', url: `/w/${OTHER_WORKSPACE}/modules/${MODULE_ID}/preview` },
        { method: 'GET', url: `/w/${OTHER_WORKSPACE}/modules/${MODULE_ID}/versions` },
    ];

    for (const ep of endpoints) {
        await t.test(`${ep.method} ${ep.url} — should return 403 for wrong workspace`, async (t) => {
            const fastify = buildApp();
            await fastify.ready();
            const res = await fastify.inject({
                method: ep.method as any,
                url: ep.url,
                headers: { Authorization: `Bearer ${USER_ID}` },
                body: ep.body
            });
            t.equal(res.statusCode, 403);
            await fastify.close();
        });
    }
});

test('Module Editor Security — Unauthenticated', async (t) => {
    const ep = { method: 'GET', url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/editor` };
    await t.test(`${ep.method} ${ep.url} — should return 401 without auth`, async (t) => {
        const fastify = buildApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: ep.method as any,
            url: ep.url
        });
        t.equal(res.statusCode, 401);
        await fastify.close();
    });
});

import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';

const test = tap.test;
const WORKSPACE_ID = 'ws_smoke_001';
const USER_ID = 'user_1';

const buildApp = () => {
    const fastify = Fastify();
    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
            if (sql.includes('SELECT full_name, school_name')) return { rowCount: 1, rows: [{ full_name: 'Guru', school_name: 'SD' }] };
            if (sql.includes("status IN ('queued', 'running')")) return { rowCount: 0, rows: [] };
            if (sql.includes("status = 'draft'")) return { rowCount: 0, rows: [] };
            return { rowCount: 1, rows: [] };
        },
        connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
};

test('Wizard Fix Verification', async (t) => {
    const app = buildApp();
    await app.ready();

    t.test('POST /generate — wizard mode with empty topic (should succeed with subject fallback)', async (t) => {
        const res = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'wizard',
                subject: 'Matematika',
                grade: 4,
                topic: '', // Empty topic
                template_id: null
            },
        });

        t.equal(res.statusCode, 201, 'Should return 201 Created');
        const body = res.json();
        t.ok(body.job_id, 'Should return a job_id');
    });

    t.test('POST /generate — template mode with empty topic (should still fail)', async (t) => {
        const res = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'template',
                subject: 'Matematika',
                grade: 4,
                topic: '',
                template_id: 'tpl_123'
            },
        });

        t.equal(res.statusCode, 400, 'Should return 400 Bad Request if topic is missing in non-wizard mode');
    });
});

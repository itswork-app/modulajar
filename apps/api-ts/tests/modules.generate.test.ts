import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_modules_001';
const USER_ID = 'user_1';

function buildApp(opts: {
    teacherRows?: any[];
    activeJobsCount?: number;
    simulateError?: boolean;
} = {}) {
    const fastify = Fastify();
    const {
        teacherRows = [{ full_name: 'Test Teacher', school_name: 'SD Testing' }],
        activeJobsCount = 0,
        simulateError = false,
    } = opts;

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (simulateError && sql.includes('INSERT INTO generation_jobs')) {
                throw new Error('Simulated DB error');
            }

            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                const [wid, uid] = values || [];
                if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }

            // Teacher lookup
            if (sql.includes('SELECT full_name, school_name')) {
                return { rowCount: teacherRows.length, rows: teacherRows };
            }

            // Active jobs count
            if (sql.includes("status IN ('queued', 'running')")) {
                return { rowCount: activeJobsCount, rows: Array(activeJobsCount).fill({ id: 'job_1' }) };
            }

            // Existing draft packages
            if (sql.includes("status = 'draft'")) {
                return { rowCount: 0, rows: [] };
            }

            if (sql.includes('document_templates') || sql.includes('workspace_default_templates')) {
                return { rowCount: 1, rows: [{ id: 'tpl_123', layout_definition: { sections: [] } }] };
            }

            // INSERT queries
            return { rowCount: 1, rows: [] };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { }
        } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('POST /w/:workspaceId/modules/generate', async (t) => {

    await t.test('201 — successful generation from_scratch', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'Matematika',
                grade: 4,
                topic: 'Pecahan',
            },
        });

        t.equal(res.statusCode, 201);
        const body = res.json();
        t.ok(body.job_id);
        t.ok(body.module_id);
        t.equal(body.status, 'queued');

        await fastify.close();
    });

    await t.test('400 — missing template_id for template mode', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'template',
                subject: 'Matematika',
                grade: 4,
                topic: 'Pecahan',
            },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /template_id is required/);

        await fastify.close();
    });

    await t.test('400 — missing topic', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'Matematika',
                grade: 4,
            },
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('429 — rate limited (max active jobs)', async (t) => {
        const fastify = buildApp({ activeJobsCount: 4 });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'Matematika',
                grade: 4,
                topic: 'Pecahan',
            },
        });

        t.equal(res.statusCode, 429);
        t.equal(res.json().error, 'Rate Limited');

        await fastify.close();
    });

    await t.test('401 — unauthenticated', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            payload: {
                mode: 'from_scratch',
                subject: 'Matematika',
                grade: 4,
                topic: 'Pecahan',
            },
        });

        t.equal(res.statusCode, 401);

        await fastify.close();
    });
});

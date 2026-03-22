import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import jobsRoutes from '../src/routes/jobs';

const test = tap.test;

const WORKSPACE_ID = 'ws_jobs_001';
const USER_ID = 'user_1';

function buildApp(opts: {
    jobRow?: any;
    docRow?: any;
} = {}) {
    const fastify = Fastify();
    const { jobRow, docRow } = opts;

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            // Workspace check
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                return { rowCount: 1, rows: [] };
            }

            if (sql.includes('FROM generation_jobs')) {
                if (jobRow) return { rowCount: 1, rows: [jobRow] };
                return { rowCount: 0, rows: [] };
            }

            if (sql.includes('FROM documents')) {
                if (docRow) return { rowCount: 1, rows: [docRow] };
                return { rowCount: 0, rows: [] };
            }

            return { rowCount: 1, rows: [] };
        },
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(jobsRoutes);
    return fastify;
}

test('GET /w/:workspaceId/jobs/:jobId', async (t) => {

    await t.test('200 — running job returns progress', async (t) => {
        const fastify = buildApp({
            jobRow: { id: 'job_1', package_id: 'pkg_1', status: 'running', metadata: { pid: 'PID-123' } }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.status, 'running');
        t.equal(body.progress.pct, 50);

        await fastify.close();
    });

    await t.test('200 — running job checks documents API for precise pct', async (t) => {
        const fastify = buildApp({
            jobRow: { id: 'job_1', package_id: 'pkg_1', status: 'running', metadata: {} },
            docRow: { status: 'generating' } // Means AI phase
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.progress.phase, 'ai');
        t.equal(body.progress.pct, 40);

        await fastify.close();
    });

    await t.test('200 — completed job', async (t) => {
        const fastify = buildApp({
            jobRow: { id: 'job_1', package_id: 'pkg_1', status: 'completed', metadata: {} }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.status, 'done');
        t.equal(body.progress.pct, 100);

        await fastify.close();
    });

    await t.test('404 — job not found', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_unknown`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);

        await fastify.close();
    });
});

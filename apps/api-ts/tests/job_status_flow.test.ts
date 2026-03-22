import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import jobsRoutes from '../src/routes/jobs';

const test = tap.test;

const WORKSPACE_ID = 'ws_smoke_002';
const OTHER_WORKSPACE_ID = 'ws_other_001';
const USER_ID = 'user_1';

function buildApp(opts: {
    jobRows?: any[];
    docRows?: any[];
} = {}) {
    const fastify = Fastify();
    const {
        jobRows = [],
        docRows = [],
    } = opts;

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                const [wid, uid] = values || [];
                if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                if (wid === OTHER_WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }

            // Job Status Query
            if (sql.includes('FROM generation_jobs')) {
                const [jid, wid] = values || [];
                const matched = jobRows.filter(j => j.id === jid && j.workspace_id === wid);
                return { rowCount: matched.length, rows: matched };
            }

            // Documents Query (precise status)
            if (sql.includes('FROM documents')) {
                const [pkgId] = values || [];
                const matched = docRows.filter(d => d.package_id === pkgId);
                return { rowCount: matched.length, rows: matched };
            }

            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { }
        } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(jobsRoutes);
    return fastify;
}

test('SMOKE PHASE 2: Job Polling Reliability', async (t) => {

    await t.test('GET /jobs/:id — returns queued status correctly', async (t) => {
        const fastify = buildApp({
            jobRows: [{
                id: 'job_queued',
                workspace_id: WORKSPACE_ID,
                package_id: 'pkg_1',
                status: 'queued',
                metadata: { pid: 'PID-1' }
            }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_queued`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.status, 'queued');
        t.equal(body.progress.phase, 'queued');
        t.equal(body.progress.pct, 5);
    });

    await t.test('GET /jobs/:id — returns running/ai status correctly', async (t) => {
        const fastify = buildApp({
            jobRows: [{
                id: 'job_running',
                workspace_id: WORKSPACE_ID,
                package_id: 'pkg_1',
                status: 'running',
                metadata: { pid: 'PID-1' }
            }],
            docRows: [{
                package_id: 'pkg_1',
                status: 'generating'
            }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_running`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        const body = res.json();
        t.equal(body.status, 'running');
        t.equal(body.progress.phase, 'ai');
        t.equal(body.progress.pct, 40);
    });

    await t.test('GET /jobs/:id — returns completed/done status correctly', async (t) => {
        const fastify = buildApp({
            jobRows: [{
                id: 'job_done',
                workspace_id: WORKSPACE_ID,
                package_id: 'pkg_1',
                status: 'completed',
                metadata: { pid: 'PID-1' }
            }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_done`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        const body = res.json();
        t.equal(body.status, 'done');
        t.equal(body.progress.pct, 100);
    });

    await t.test('GET /jobs/:id — FAIL 404 for invalid job_id', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/invalid_id`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 404);
    });

    await t.test('GET /jobs/:id — Workspace Isolation (cannot access other workspace job)', async (t) => {
        const fastify = buildApp({
            jobRows: [{
                id: 'job_secret',
                workspace_id: OTHER_WORKSPACE_ID,
                status: 'completed'
            }]
        });
        await fastify.ready();

        // User 1 is a member of BOTH workspaces in the mock, but we request via WORKSPACE_ID
        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/jobs/job_secret`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        // Should be 404 because it's filtered by WORKSPACE_ID in SQL
        t.equal(res.statusCode, 404);
    });

});

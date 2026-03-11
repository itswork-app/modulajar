import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_smoke_001';
const USER_ID = 'user_1';

function buildApp(opts: {
    teacherRows?: any[];
    activeJobsCount?: number;
} = {}) {
    const fastify = Fastify();
    const {
        teacherRows = [{ full_name: 'Guru Smoke', school_name: 'SD Smoke Test' }],
        activeJobsCount = 0,
    } = opts;

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members')) {
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

test('SMOKE PHASE 1: Wizard Generate Flow', async (t) => {

    await t.test('POST /generate — template mode (success)', async (t) => {
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
                template_id: 'tpl_123'
            },
        });

        t.equal(res.statusCode, 201);
        const body = res.json();
        t.ok(body.job_id);
        t.ok(body.module_id);
        t.equal(body.status, 'queued');
    });

    await t.test('POST /generate — edit_template mode (success)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'edit_template',
                subject: 'Seni Budaya',
                grade: 2,
                topic: 'Menggambar',
                template_id: 'tpl_456',
                template_overrides: { complexity: 'easy' }
            },
        });

        t.equal(res.statusCode, 201);
    });

    await t.test('POST /generate — from_scratch mode (success)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'IPA',
                grade: 6,
                topic: 'Energi Matahari'
            },
        });

        t.equal(res.statusCode, 201);
    });

    await t.test('POST /generate — FAILS if missing template_id in template mode', async (t) => {
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
                topic: 'Pecahan'
            },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /template_id is required/);
    });

    await t.test('POST /generate — FAILS if missing workspace_id in URL (404/Route not found)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        // Testing the URL structure
        const res = await fastify.inject({
            method: 'POST',
            url: `/w//modules/generate`, // Invalid path
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'IPA',
                grade: 6,
                topic: 'Energi Matahari'
            },
        });

        t.equal(res.statusCode, 403);
    });

    await t.test('POST /generate — FAILS if invalid grade (out of range 1-12)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                mode: 'from_scratch',
                subject: 'IPA',
                grade: 15, // Invalid grade
                topic: 'Energi Matahari'
            },
        });

        // Current implementation DOES NOT validate grade range. 
        // This test will fail if we expect it to reject.
        // I will add the validation to the route in Phase 1 fixes.
        t.equal(res.statusCode, 400, 'Should reject grade 15');
    });

    await t.test('POST /generate — FAILS if unauthenticated', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            payload: {
                mode: 'from_scratch',
                subject: 'IPA',
                grade: 6,
                topic: 'Energi'
            },
        });

        t.equal(res.statusCode, 401);
    });

});

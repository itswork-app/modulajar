import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';
import { issuePID } from '../src/lib/pid';

const test = tap.test;
const WORKSPACE_ID = 'ws_comp_001';
const USER_ID = 'user_comp_1';

function buildApp(mocks: {
    dbQuery?: (sql: string, values: any[]) => Promise<any>;
} = {}) {
    const fastify = Fastify();
    fastify.decorate('db', {
        query: mocks.dbQuery || (async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
            return { rowCount: 0, rows: [] };
        }),
    } as any);
    fastify.decorate('storage', { generateSignedUrl: async () => 'http://signed' });
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('Comprehensive Modules Routes', async (t) => {

    await t.test('POST /generate — success (wizard)', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('FROM teachers')) return { rowCount: 1, rows: [{ full_name: 'G', school_name: 'S' }] };
                if (sql.includes('SELECT id FROM generation_jobs')) return { rowCount: 0, rows: [] };
                if (sql.includes('SELECT id, public_id FROM packages')) return { rowCount: 0, rows: [] };
                if (sql.includes('INSERT INTO packages')) return { rowCount: 1, rows: [] };
                if (sql.includes('INSERT INTO generation_jobs')) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            body: { mode: 'template', subject: 'IPA', grade: 4, topic: 'X', template_id: 'T1' }
        });
        t.equal(res.statusCode, 201);
        t.ok(res.json().job_id);
        await fastify.close();
    });

    await t.test('POST /generate — handles rate limit (429)', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('SELECT id FROM generation_jobs')) {
                    // Return 4 active jobs
                    return { rowCount: 4, rows: [{}, {}, {}, {}] };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            body: { mode: 'template', subject: 'IPA', grade: 4, topic: 'X', template_id: 'T1' }
        });
        t.equal(res.statusCode, 429);
        await fastify.close();
    });

    await t.test('POST /generate — handles invalid grade (400)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/generate`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            body: { mode: 'template', subject: 'IPA', grade: 15, topic: 'X' }
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('GET /:id — success with GCS signed URL', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('FROM packages p')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            id: 'mod1', public_id: 'pid1', status: 'completed', kelas: '4',
                            job_metadata: {
                                subject: 'IPA', topic: 'Energi',
                                pdf_receipts: { 'v1': { pdf_path: 'gcs://bucket/path.pdf', pdf_sha256: 'sha' } }
                            }
                        }]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();
        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 200);
        t.equal(res.json().pdf.download_url, 'http://signed');
        await fastify.close();
    });

    await t.test('GET /editor — returns 404', async (t) => {
        const fastify = buildApp();
        await fastify.ready();
        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/not-found/editor`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 404);
        await fastify.close();
    });
});

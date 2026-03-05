import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_mod_001';
const USER_ID = 'user_1';

function buildApp(opts: {
    pkgRow?: any;
} = {}) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                return { rowCount: 1, rows: [] };
            }

            if (sql.includes('FROM packages')) {
                if (opts.pkgRow) return { rowCount: 1, rows: [opts.pkgRow] };
                return { rowCount: 0, rows: [] };
            }
            return { rowCount: 1, rows: [] };
        },
    } as any);

    fastify.decorate('storage', {
        generateSignedUrl: async () => 'https://signed.url/test'
    });
    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('GET /w/:workspaceId/modules/:moduleId', async (t) => {

    await t.test('200 — returns module details with pdf', async (t) => {
        const fastify = buildApp({
            pkgRow: {
                id: 'mod_1',
                public_id: 'PID-MOD-1',
                status: 'ready',
                kelas: '4',
                semester: '1',
                job_metadata: {
                    topic: 'Tata Surya',
                    subject: 'IPA',
                    pdf_receipts: {
                        doc1: {
                            pdf_path: 'gcs://modulajar-assets-dev/test.pdf',
                            pdf_sha256: 'abcdef123'
                        }
                    }
                }
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod_1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.module_id, 'mod_1');
        t.equal(body.topic, 'Tata Surya');
        t.equal(body.pdf?.sha256, 'abcdef123');
        t.match(body.pdf?.download_url, /https:\/\/signed\.url/);
        t.ok(body.verify?.url);

        await fastify.close();
    });

    await t.test('200 — returns null pdf if not yet rendered', async (t) => {
        const fastify = buildApp({
            pkgRow: {
                id: 'mod_1',
                public_id: 'PID-MOD-2',
                status: 'generating',
                kelas: '4',
                job_metadata: { topic: 'Testing' }
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod_1`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.status, 'generating');
        t.equal(body.pdf, null);

        await fastify.close();
    });

    await t.test('404 — module not found', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/non_existent`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);

        await fastify.close();
    });
});

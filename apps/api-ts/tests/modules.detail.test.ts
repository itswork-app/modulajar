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
            if (sql.includes('FROM document_versions')) {
                if (opts.pkgRow && opts.pkgRow.module_json) {
                    return {
                        rowCount: 1, rows: [{
                            module_json: opts.pkgRow.module_json,
                            kelas: opts.pkgRow.kelas,
                            semester: opts.pkgRow.semester,
                            tahun_ajaran: opts.pkgRow.tahun_ajaran,
                            teacher_name: opts.pkgRow.teacher_name,
                            school_name: opts.pkgRow.school_name,
                            public_id: opts.pkgRow.public_id
                        }]
                    };
                }
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

test('GET /w/:workspaceId/modules/:moduleId/preview', async (t) => {
    await t.test('200 — returns module preview html', async (t) => {
        const fastify = buildApp({
            pkgRow: {
                id: 'mod_1',
                public_id: 'PID-MOD-1',
                status: 'ready',
                kelas: '4',
                semester: '1',
                tahun_ajaran: '2025/2026',
                teacher_name: 'Guru',
                school_name: 'SDN 1',
                job_metadata: { topic: 'Tata Surya', subject: 'IPA' },
                module_json: { title: 'Custom Title', subject: 'IPA', kegiatan_pembelajaran: { pendahuluan: 'Start' } }
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod_1/preview`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const html = res.payload;
        t.ok(html);
        t.ok(html.includes('Custom Title')); // verifies title render
        t.ok(html.includes('Start')); // verifies kegiatan_pembelajaran

        await fastify.close();
    });

    await t.test('404 — preview module not found', async (t) => {
        const fastify = buildApp(); // no pkgRow configured -> 0 rows
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/unknown_module/preview`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);

        await fastify.close();
    });
});

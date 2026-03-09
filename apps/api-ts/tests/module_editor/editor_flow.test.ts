import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../../src/plugins/mock_auth';
import workspaceGuardPlugin from '../../src/plugins/workspace-guard';
import modulesRoutes from '../../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_editor_001';
const USER_ID = 'user_editor_1';
const MODULE_ID = 'mod_editor_123';

const validModuleJson = {
    meta: { jenjang: "SD", kelas: "4", mapel: "IPA", semester: "1", tahun_ajaran: "2025/2026" },
    identitas: { sekolah: "SD Test", guru: "Guru Test", alokasi_waktu: "2x35" },
    tujuan_pembelajaran: ["tujuan1"],
    materi_inti: ["materi1"],
    langkah_pembelajaran: { pendahuluan: ["p1"], inti: ["i1"], penutup: ["p1"] },
    asesmen: { diagnostik: ["d1"], formatif: ["f1"], sumatif: ["s1"] },
    subject: 'IPA',
    topic: 'Energi'
};

function buildApp(mocks: {
    dbQuery?: (sql: string, values: any[]) => Promise<any>;
} = {}) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: mocks.dbQuery || (async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
        }),
    } as any);

    fastify.decorate('storage', {
        generateSignedUrl: async () => 'https://signed.url/test'
    });

    // Mock metrics (since we import them in modules.ts)
    // Actually, the metrics are already initialized in utils/metrics.ts, 
    // so we don't necessarily need to mock them if they don't crash without a registry.

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('Module Editor Integration Flow', async (t) => {

    await t.test('GET /editor — returns latest version data and preview', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('FROM document_versions')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            version: 1,
                            module_json: validModuleJson,
                            kelas: '4',
                            semester: '1',
                            tahun_ajaran: '2025/2026',
                            teacher_name: 'Guru Test',
                            school_name: 'SD Test',
                            public_id: 'PID123',
                            subject: 'IPA',
                            topic: 'Energi'
                        }]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/editor`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.module_id, MODULE_ID);
        t.equal(body.version, 1);
        t.equal(body.module_json.topic, 'Energi');
        t.ok(body.html_preview.includes('Guru Test'));

        await fastify.close();
    });

    await t.test('PATCH /modules/:id — creates new version', async (t) => {
        let insertedVersion = 0;
        let insertedJson = '';

        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('SELECT dv.version, dv.module_json, d.package_id')) {
                    return {
                        rowCount: 1,
                        rows: [{ version: 5, module_json: { ...validModuleJson, topic: 'Old' }, package_id: 'pkg1' }]
                    };
                }
                if (sql.includes('SELECT kelas, semester, tahun_ajaran, teacher_name, school_name, public_id FROM packages')) {
                    return {
                        rowCount: 1,
                        rows: [{ kelas: '4', semester: '1', tahun_ajaran: '2025', teacher_name: 'G', school_name: 'S', public_id: 'P' }]
                    };
                }
                if (sql.includes('INSERT INTO document_versions')) {
                    insertedVersion = values[2];
                    insertedJson = values[3];
                    return { rowCount: 1, rows: [] };
                }
                return { rowCount: 1, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            body: { patch: { topic: 'New' } }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().version, 6);
        t.equal(insertedVersion, 6);
        t.ok(insertedJson.includes('"topic":"New"'));

        await fastify.close();
    });

    await t.test('GET /preview — returns rendered HTML', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('document_versions dv') && sql.includes('JOIN packages p')) {
                    return {
                        rowCount: 1,
                        rows: [{
                            module_json: {
                                ...validModuleJson,
                                tujuan_pembelajaran: ['Siswa dapat menjelaskan energi']
                            },
                            kelas: '4', semester: '1', tahun_ajaran: '2025',
                            teacher_name: 'Guru', school_name: 'SD', public_id: 'PID'
                        }]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/preview`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200, res.payload);
        // t.ok(res.headers['content-type']?.toString().includes('text/html'), 'should be HTML');
        t.ok(res.body.includes('Siswa dapat menjelaskan energi'));
        t.ok(res.body.includes('Guru'));

        await fastify.close();
    });

    await t.test('POST /ai-assist — proxies request to worker', async (t) => {
        // We can't easily mock global fetch in tap without a library, 
        // but we can at least test the route handling if we assume fetch is available 
        // or mock it. Since this is an integration test of the API, 
        // we'll assume the environment has fetch (Node 18+).

        // Mocking global fetch for this test
        const originalFetch = global.fetch;
        (global as any).fetch = async (url: string) => {
            return {
                ok: true,
                json: async () => ({ suggestion: 'AI Improved Content' })
            } as any;
        };

        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/ai-assist`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            body: { section: 'langkah', action: 'improve', content: 'stuff' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().suggestion, 'AI Improved Content');

        global.fetch = originalFetch;
        await fastify.close();
    });

    await t.test('GET /versions — returns history', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('FROM document_versions dv') && sql.includes('JOIN documents d')) {
                    return {
                        rowCount: 2,
                        rows: [
                            { version: 2, created_at: new Date(), created_by: USER_ID },
                            { version: 1, created_at: new Date(), created_by: USER_ID }
                        ]
                    };
                }
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/versions`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().length, 2);
        await fastify.close();
    });

    await t.test('GET /preview — returns 404 if not found', async (t) => {
        const fastify = buildApp({
            dbQuery: async (sql, values) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/${MODULE_ID}/preview`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        await fastify.close();
    });
});

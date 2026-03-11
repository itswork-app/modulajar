import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';
import templateRoutes from '../src/routes/templates';
import {
    computeSimilarity,
    buildPreview,
    fetchRankedTemplates,
} from '../src/services/templateService';

const test = tap.test;
const WORKSPACE_ID = 'ws_cov_001';
const USER_ID = 'user_cov';

test('templateService Boost', async (t) => {
    await t.test('computeSimilarity — union zero branch', async (t) => {
        // This is hard to trigger with tokenize splitting on space, but empty strings might do it
        // if the tokenize logic returns an empty set.
        // sets are empty -> returns 1.0 at line 17.
        // union is calculated at line 25.
        // To get union === 0 at line 26, we need to bypass line 17/18.
        // Actually, if both are empty, it returns 1.0 at line 17.
        // If one is empty, it returns 0.0 at line 18.
        // So line 26 union === 0 might be unreachable codes but let's try.
        t.equal(computeSimilarity('', ''), 1.0);
    });

    await t.test('buildPreview — null/missing branches', async (t) => {
        const p1 = buildPreview(null);
        t.equal(p1.tujuan_pembelajaran, '');

        const p2 = buildPreview({ current_page: 1 });
        t.equal(p2.ringkasan_kegiatan, '');

        const p3 = buildPreview({
            kegiatan_pembelajaran: { pendahuluan: 'Hello' }
        });
        t.equal(p3.ringkasan_kegiatan, 'Hello');

        const p4 = buildPreview({
            penilaian: { pengetahuan: 'Tes' }
        });
        t.equal(p4.assessment_summary, 'Tes');

        const p5 = buildPreview({
            penilaian: { sikap: 'Baik' }
        });
        t.equal(p5.assessment_summary, 'Baik');
    });

    await t.test('fetchRankedTemplates — JSON parse failure', async (t) => {
        const mockDb = {
            query: async () => ({
                rowCount: 1,
                rows: [{
                    id: 'tpl_1',
                    subject: 'math',
                    grade: 1,
                    topic: 'calc',
                    module_json: '{invalid-json}',
                    quality_score: 100,
                    usage_count: 10
                }]
            })
        } as any;
        const res = await fetchRankedTemplates(mockDb, 'math', 1);
        t.equal(res.length, 1);
        t.equal(res[0].preview.tujuan_pembelajaran, '');
    });
});

test('workspaceRoutes Boost', async (t) => {
    const buildApp = (queryMock: any) => {
        const fastify = Fastify();
        fastify.decorate('db', { query: queryMock } as any);
        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(workspaceRoutes);
        return fastify;
    };

    await t.test('GET /:workspaceId/workspace — 404 branch', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('workspaces')) return { rowCount: 0, rows: [] };
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 404);
        await app.close();
    });

    await t.test('PATCH /:workspaceId/workspace — empty body branch', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {}
        });
        t.equal(res.statusCode, 400);
        await app.close();
    });

    await t.test('PATCH /:workspaceId/workspace — NPSN Conflict', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('SELECT id FROM workspaces')) return { rowCount: 1, rows: [{ id: 'other' }] };
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '12345678' }
        });
        t.equal(res.statusCode, 409);
        await app.close();
    });

    await t.test('POST /:workspaceId/verify-school — 404 reference branch', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('schools_reference')) return { rowCount: 0, rows: [] };
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '00000000' }
        });
        t.equal(res.statusCode, 404);
        await app.close();
    });

    await t.test('GET /:workspaceId/usage-summary — recent_jobs missing fields', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'admin' }] };
            if (sql.includes('wallet_ledger')) return { rowCount: 1, rows: [{ balance: 100 }] };
            if (sql.includes('generation_jobs')) {
                if (sql.includes('LIMIT 10')) {
                    return { rowCount: 1, rows: [{ generation_id: 'g1', status: 'done', created_at: new Date() }] };
                }
                return { rowCount: 1, rows: [{ count: '1' }] };
            }
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/usage-summary`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.recent_jobs[0].subject, 'Modul Ajar');
        t.equal(body.recent_jobs[0].semester, 1);
        await app.close();
    });

    await t.test('GET /:workspaceId/admin/dashboard — 403 Forbidden branch', async (t) => {
        const app = buildApp(async (sql: string) => {
            if (sql.includes('workspace_members')) return { rowCount: 1, rows: [{ role: 'teacher' }] };
            return { rowCount: 0, rows: [] };
        });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/admin/dashboard`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });
        t.equal(res.statusCode, 403);
        await app.close();
    });
});

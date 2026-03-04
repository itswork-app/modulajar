import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp(documents: any[] = [], workspaceData: any = null, notFound: boolean = false) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            // Workspace membership check (used by workspaceGuard)
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                if (wid === WORKSPACE_ID && uid === USER_ID) {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Get Workspace Identity
            if (sql.includes('FROM workspaces') && sql.includes('SELECT') && !sql.includes('npsn = $1')) {
                if (notFound) return { rowCount: 0, rows: [] };
                return {
                    rowCount: 1,
                    rows: [workspaceData || {
                        id: WORKSPACE_ID,
                        workspace_type: 'personal',
                        npsn: null,
                        school_name: null,
                        province: null,
                        regency: null,
                        address: null,
                        logo_url: null,
                        is_verified: false
                    }]
                };
            }

            // NPSN Duplicate Check
            if (sql.includes('npsn = $1') && sql.includes('SELECT id FROM workspaces')) {
                const [npsn] = params;
                // Mock: '1234567890' is taken by another workspace
                if (npsn === '1234567890') {
                    return { rowCount: 1, rows: [{ id: 'ws-other' }] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Update Workspace
            if (sql.includes('UPDATE workspaces SET')) {
                return { rowCount: 1, rows: [] };
            }

            // List documents
            if (sql.includes('FROM generation_jobs gj')) {
                return { rowCount: documents.length, rows: documents };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(workspaceRoutes);

    return fastify;
}

// ═══════════════════════════════════════════
// GET /w/:workspaceId/ping
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/ping', async (t) => {
    await t.test('returns ok for authorised workspace member', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/ping`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.status, 'ok');
        t.equal(body.workspaceId, WORKSPACE_ID);
        t.ok(body.userId, 'userId is present');

        await fastify.close();
    });

    await t.test('returns 401 for unauthenticated request', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/ping`
            // No Authorization header
        });

        // mock_auth returns 401 if no header
        t.equal(res.statusCode, 401);

        await fastify.close();
    });

    await t.test('returns 403 for wrong workspace', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/ws-OTHER/ping`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        // user_1 is not a member of ws-OTHER → workspace guard: 403
        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// GET /w/:workspaceId/documents
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/documents', async (t) => {
    await t.test('returns empty list when workspace has no documents', async (t) => {
        const fastify = buildApp([]);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/documents`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        t.same(res.json().documents, []);

        await fastify.close();
    });

    await t.test('maps DB rows to document objects with correct jenjang', async (t) => {
        const rows = [
            {
                job_id: 'job-1',
                public_id: 'PKG-SD4-S1-2026-ABCDEF',
                status: 'ready',
                created_at: '2026-02-25T00:00:00.000Z',
                kelas: '4',        // SD4 → jenjang = 'SD'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'SDN 1',
                teacher_name: 'Ibu Ani'
            },
            {
                job_id: 'job-2',
                public_id: 'PKG-SMP7-S2-2026-XXXXXX',
                status: 'queued',
                created_at: '2026-02-24T00:00:00.000Z',
                kelas: '7',       // SMP → jenjang = 'SMP'
                semester: 'S2',
                tahun_ajaran: '2025/2026',
                school_name: 'SMPN 2',
                teacher_name: 'Pak Budi'
            },
            {
                job_id: 'job-3',
                public_id: 'PKG-SMA10-S1-2026-YYYYYY',
                status: 'queued',
                created_at: '2026-02-23T00:00:00.000Z',
                kelas: '10',      // SMA → jenjang = 'SMA/SMK'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'SMAN 3',
                teacher_name: 'Ibu Citra'
            },
            {
                job_id: 'job-4',
                public_id: 'PKG-KAMPUS-S1-2026-ZZZZZZ',
                status: 'queued',
                created_at: '2026-02-22T00:00:00.000Z',
                kelas: '13',      // > 12 → jenjang = 'Kampus'
                semester: 'S1',
                tahun_ajaran: '2025/2026',
                school_name: 'Universitas X',
                teacher_name: 'Prof. D'
            }
        ];

        const fastify = buildApp(rows);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/documents`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const docs = res.json().documents;

        t.equal(docs.length, 4, '4 documents returned');

        // jenjang mapping coverage
        const kelas4 = docs.find((d: any) => d.id === 'job-1');
        const kelas7 = docs.find((d: any) => d.id === 'job-2');
        const kelas10 = docs.find((d: any) => d.id === 'job-3');
        const kelas13 = docs.find((d: any) => d.id === 'job-4');

        t.equal(kelas4?.jenjang, 'SD', 'kelas 4 → SD');
        t.equal(kelas7?.jenjang, 'SMP', 'kelas 7 → SMP');
        t.equal(kelas10?.jenjang, 'SMA/SMK', 'kelas 10 → SMA/SMK');
        t.equal(kelas13?.jenjang, 'Kampus', 'kelas 13 → Kampus');

        // field mapping
        t.equal(kelas4?.public_id, 'PKG-SD4-S1-2026-ABCDEF');
        t.equal(kelas4?.school_name, 'SDN 1');
        t.equal(kelas4?.teacher_name, 'Ibu Ani');

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// Workspace Identity (PR-033)
// ═══════════════════════════════════════════
test('Workspace Identity (PR-033)', async (t) => {

    await t.test('GET /w/:wid/workspace returns defaults (personal)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.workspace_type, 'personal');
        t.equal(body.is_verified, false);
        t.equal(body.npsn, null);

        await fastify.close();
    });

    await t.test('GET /w/:wid/workspace returns 404 if not found', async (t) => {
        const fastify = buildApp([], null, true);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        t.equal(res.json().error, 'Workspace not found');

        await fastify.close();
    });

    await t.test('PATCH /w/:wid/workspace returns 400 with no fields', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {}
        });

        t.equal(res.statusCode, 400);
        t.equal(res.json().error, 'No fields to update');

        await fastify.close();
    });

    await t.test('PATCH school_name only -> 200', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { school_name: 'SDN Test' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'ok');

        await fastify.close();
    });

    await t.test('PATCH valid npsn -> 200', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '20261234' }
        });

        t.equal(res.statusCode, 200);

        await fastify.close();
    });

    await t.test('PATCH duplicate npsn -> 409', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '1234567890' } // Mocked as duplicate
        });

        t.equal(res.statusCode, 409);
        t.equal(res.json().error, 'Conflict');

        await fastify.close();
    });

    await t.test('PATCH invalid npsn (too short) -> 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { npsn: '12345' }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('PATCH invalid logo_url (not https) -> 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/${WORKSPACE_ID}/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { logo_url: 'http://evil.com/logo' }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('Cross-workspace update attempt -> 403', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'PATCH',
            url: `/w/ws-OTHER/workspace`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { school_name: 'Illegal Update' }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

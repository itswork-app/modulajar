import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import schoolRoutes from '../src/routes/school';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp(schoolData: any = null) {
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

            // GET school settings
            if (sql.includes('SELECT school_display_name, kab_kota') && sql.includes('FROM workspace_settings')) {
                if (schoolData) {
                    return { rowCount: 1, rows: [schoolData] };
                }
                return { rowCount: 0, rows: [] };
            }

            // POST (Upsert) school settings
            if (sql.includes('INSERT INTO workspace_settings')) {
                const [wid, name, kab, prov, alamat, npsn] = params;
                return {
                    rowCount: 1,
                    rows: [{
                        school_display_name: name,
                        kab_kota: kab,
                        provinsi: prov,
                        alamat: alamat,
                        school_npsn: npsn,
                        school_verified: false
                    }]
                };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(schoolRoutes);

    return fastify;
}

// ═══════════════════════════════════════════
// GET /w/:workspaceId/school
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/school', async (t) => {

    await t.test('returns 404 when school settings do not exist', async (t) => {
        const fastify = buildApp(null);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        t.equal(res.json().error, 'School identity not found for this workspace');

        await fastify.close();
    });

    await t.test('returns settings when they exist', async (t) => {
        const mockSchool = {
            school_display_name: 'SDN 1 Jakarta',
            kab_kota: 'Jakarta Pusat',
            provinsi: 'DKI Jakarta',
            alamat: 'Jl. Merdeka No. 1',
            school_npsn: '12345678',
            school_verified: false
        };
        const fastify = buildApp(mockSchool);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        t.same(res.json(), mockSchool);

        await fastify.close();
    });

    await t.test('returns 403 for cross-workspace access', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/ws-OTHER/school`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

// ═══════════════════════════════════════════
// POST /w/:workspaceId/school
// ═══════════════════════════════════════════
test('POST /w/:workspaceId/school', async (t) => {

    await t.test('creates/upserts settings with only required fields (success)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'SMP Merdeka'
            }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.school_display_name, 'SMP Merdeka');
        t.equal(body.kab_kota, null);
        t.equal(body.school_verified, false, 'Defaults to unverified');

        await fastify.close();
    });

    await t.test('creates settings with all fields including valid NPSN', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'SMA Bangsa',
                kab_kota: 'Bandung',
                provinsi: 'Jawa Barat',
                alamat: 'Jl Raya 45',
                school_npsn: '12345678'
            }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.school_display_name, 'SMA Bangsa');
        t.equal(body.kab_kota, 'Bandung');
        t.equal(body.school_npsn, '12345678');
        t.equal(body.school_verified, false);

        await fastify.close();
    });

    await t.test('validation error: missing school_display_name', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                kab_kota: 'Jakarta'
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: school_display_name too short', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'SD' // Under 3 chars
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: bad school_npsn length format', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'TK Harapan',
                school_npsn: '123' // Not 8 digits
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: bad school_npsn string format', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'TK Harapan',
                school_npsn: '1234ABCD' // Contains chars
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('cross-workspace attempt is blocked (403)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/ws-OTHER/school`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                school_display_name: 'Hacker High'
            }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

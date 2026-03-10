import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import profileRoutes from '../src/routes/profile';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp(profileData: any = null) {
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

            // GET profile
            if (sql.includes('SELECT full_name, primary_grade') && sql.includes('FROM teachers')) {
                if (profileData) {
                    return { rowCount: 1, rows: [profileData] };
                }
                return { rowCount: 0, rows: [] };
            }

            // POST (Upsert) profile
            if (sql.includes('INSERT INTO teachers')) {
                const [id, wid, fullName, grade, subject, nip] = params;
                return {
                    rowCount: 1,
                    rows: [{ full_name: fullName, primary_grade: grade, primary_subject: subject, nip: nip }]
                };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(profileRoutes);

    return fastify;
}

// ═══════════════════════════════════════════
// GET /w/:workspaceId/profile
// ═══════════════════════════════════════════
test('GET /w/:workspaceId/profile', async (t) => {

    await t.test('returns 404 when profile does not exist', async (t) => {
        const fastify = buildApp(null);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        t.equal(res.json().error, 'Teacher profile not found');

        await fastify.close();
    });

    await t.test('returns profile when it exists', async (t) => {
        const mockProfile = { full_name: 'Budi Santoso', primary_grade: 4, primary_subject: 'Matematika', nip: '123' };
        const fastify = buildApp(mockProfile);
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        t.same(res.json(), mockProfile);

        await fastify.close();
    });

    await t.test('returns 403 for cross-workspace access', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/ws-OTHER/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});


// ═══════════════════════════════════════════
// POST /w/:workspaceId/profile
// ═══════════════════════════════════════════
test('POST /w/:workspaceId/profile', async (t) => {

    await t.test('creates/upserts profile and returns it (success)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Budi Santoso',
                primary_subject: 'Matematika'
            }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.full_name, 'Budi Santoso');
        t.equal(body.primary_subject, 'Matematika');
        t.equal(body.primary_grade, 4, 'Defaults grade to 4');
        t.equal(body.nip, null);

        await fastify.close();
    });

    await t.test('creates profile with custom grade and nip', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Budi Santoso',
                primary_subject: 'Matematika',
                primary_grade: 6,
                nip: '198012122005011002'
            }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.primary_grade, 6);
        t.equal(body.nip, '198012122005011002');

        await fastify.close();
    });

    await t.test('validation error: missing full_name', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                primary_subject: 'Matematika'
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: missing primary_subject', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Budi Santoso'
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: grade too low', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Budi',
                primary_subject: 'Matematika',
                primary_grade: 0
            }
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('validation error: grade too high', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Budi',
                primary_subject: 'Matematika',
                primary_grade: 13
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
            url: `/w/ws-OTHER/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Hacker',
                primary_subject: 'Hacking'
            }
        });

        t.equal(res.statusCode, 403);

        await fastify.close();
    });
});

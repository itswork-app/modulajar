import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import referralRoutes from '../src/routes/referral';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp(mockDbChecks: any = {}) {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            // Workspace Guard Mock
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                if (wid === WORKSPACE_ID && uid === USER_ID) {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            // GET /w/:workspaceId/referral -> workspaces code
            if (sql.includes('SELECT referral_code FROM workspaces WHERE id = $1')) {
                if (mockDbChecks.workspaceNotFound) {
                    return { rowCount: 0, rows: [] };
                }
                return { rowCount: 1, rows: [{ referral_code: mockDbChecks.code || 'REF123' }] };
            }

            // GET /w/:workspaceId/referral -> total referrals
            if (sql.includes('count(*) as total FROM referrals')) {
                return { rowCount: 1, rows: [{ total: '3' }] };
            }

            // POST /w/:workspaceId/referral/attach -> code resolve check
            if (sql.includes('SELECT id FROM workspaces WHERE referral_code = $1')) {
                const [code] = params;
                if (code === 'INVALID') return { rowCount: 0, rows: [] };
                if (code === 'SELFCODE') return { rowCount: 1, rows: [{ id: WORKSPACE_ID }] }; // Simulates own workspace code

                return { rowCount: 1, rows: [{ id: 'ws-ref-002' }] }; // Valid referrer
            }

            // POST /w/:workspaceId/referral/attach -> Insert relationship
            if (sql.includes('INSERT INTO referrals')) {
                return { rowCount: 1, command: 'INSERT' };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(referralRoutes, { prefix: '/w' });

    return fastify;
}

test('Referral Growth Engine - API Routes', async (t) => {

    await t.test('GET /w/:wid/referral returns info correctly', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/referral`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.referral_code, 'REF123');
        t.equal(body.referral_link, 'https://modulajar.app/r/REF123');
        t.equal(body.total_referrals, 3);
        await fastify.close();
    });

    await t.test('GET /w/:wid/referral handles 404 for missing workspaces', async (t) => {
        const fastify = buildApp({ workspaceNotFound: true });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/referral`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 404);
        t.equal(res.json().error, 'Workspace not found');
        await fastify.close();
    });

    await t.test('POST /w/:wid/referral/attach success on valid foreign code', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/referral/attach`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { referral_code: 'VALIDCODE' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'attached');
        await fastify.close();
    });

    await t.test('POST /w/:wid/referral/attach rejects invalid code with 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/referral/attach`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { referral_code: 'INVALID' }
        });

        t.equal(res.statusCode, 400);
        t.equal(res.json().error, 'Invalid referral code');
        await fastify.close();
    });

    await t.test('POST /w/:wid/referral/attach rejects self-referral with 400', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/referral/attach`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { referral_code: 'SELFCODE' }
        });

        t.equal(res.statusCode, 400);
        t.equal(res.json().error, 'Cannot refer your own workspace');
        await fastify.close();
    });

    await t.test('POST /w/:wid/referral/attach fails validation correctly without payload', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/referral/attach`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {} // missing required 'referral_code'
        });

        t.equal(res.statusCode, 400);
        await fastify.close();
    });

});

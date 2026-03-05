import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import onboardingRoutes from '../src/routes/onboarding';

const test = tap.test;

const WORKSPACE_ID = 'ws_onboard_001';
const USER_ID = 'user_1';

// ═══════════════════════════════════════
// Mock DB
// ═══════════════════════════════════════

function buildApp(opts: {
    teacherRows?: any[];
    onboardingCompleted?: boolean;
    simulateError?: boolean;
} = {}) {
    const fastify = Fastify();
    const {
        teacherRows = [],
        onboardingCompleted = false,
        simulateError = false,
    } = opts;

    // Track queries for assertions
    const queries: { sql: string; values: any[] }[] = [];

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            queries.push({ sql, values });

            if (simulateError && sql.includes('INSERT INTO')) {
                throw new Error('Simulated DB error');
            }

            // Workspace membership check
            if (sql.includes('SELECT 1 FROM workspace_members') && sql.includes('workspace_id')) {
                const [wid, uid] = values || [];
                if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }

            // Teacher lookup
            if (sql.includes('SELECT id FROM teachers') && sql.includes('workspace_id')) {
                if (teacherRows.length > 0) {
                    return { rowCount: teacherRows.length, rows: teacherRows };
                }
                return { rowCount: 0, rows: [] };
            }

            // Onboarding status
            if (sql.includes('SELECT onboarding_completed FROM teachers')) {
                if (teacherRows.length > 0) {
                    return { rowCount: 1, rows: [{ onboarding_completed: onboardingCompleted }] };
                }
                return { rowCount: 0, rows: [] };
            }

            // INSERT or UPDATE
            return { rowCount: 1, rows: [] };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { }
        } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);

    (fastify as any)._testQueries = queries;

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(onboardingRoutes);
    return fastify;
}

// ═══════════════════════════════════════
// POST /onboarding/profile
// ═══════════════════════════════════════

test('POST /onboarding/profile', async (t) => {

    await t.test('200 — saves teacher profile', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: {
                full_name: 'Reja Putra Perdana',
                nip: '1987654321',
                school_name: 'SDN Mekargalih 3',
                province: 'Jawa Barat',
                city: 'Garut',
            },
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.success, true);
        t.equal(body.step, 'profile');

        await fastify.close();
    });

    await t.test('400 — missing full_name', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { nip: '123' },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /full_name/);

        await fastify.close();
    });

    await t.test('400 — empty full_name', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { full_name: '   ' },
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('200 — optional fields omitted', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/profile`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { full_name: 'Test Teacher' },
        });

        t.equal(res.statusCode, 200);

        await fastify.close();
    });

    await t.test('401 — unauthenticated', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/profile`,
            payload: { full_name: 'Test' },
        });

        t.equal(res.statusCode, 401);

        await fastify.close();
    });
});

// ═══════════════════════════════════════
// POST /onboarding/assignment
// ═══════════════════════════════════════

test('POST /onboarding/assignment', async (t) => {

    await t.test('200 — saves teaching assignment', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { subject: 'Matematika', grade: 4 },
        });

        t.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.equal(body.success, true);
        t.equal(body.step, 'assignment');
        t.equal(body.completed, true);

        await fastify.close();
    });

    await t.test('400 — missing subject', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { grade: 4 },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /subject/);

        await fastify.close();
    });

    await t.test('400 — invalid grade 0', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { subject: 'IPA', grade: 0 },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /grade/);

        await fastify.close();
    });

    await t.test('400 — invalid grade 13', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { subject: 'IPA', grade: 13 },
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });

    await t.test('400 — no teacher profile yet', async (t) => {
        const fastify = buildApp({ teacherRows: [] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { subject: 'Matematika', grade: 4 },
        });

        t.equal(res.statusCode, 400);
        t.match(res.json().error, /Teacher profile/);

        await fastify.close();
    });

    await t.test('400 — missing grade', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/onboarding/assignment`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { subject: 'IPA' },
        });

        t.equal(res.statusCode, 400);

        await fastify.close();
    });
});

// ═══════════════════════════════════════
// GET /onboarding/status
// ═══════════════════════════════════════

test('GET /onboarding/status', async (t) => {

    await t.test('200 — completed', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }], onboardingCompleted: true });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/onboarding/status`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().completed, true);
        t.equal(res.json().has_profile, true);

        await fastify.close();
    });

    await t.test('200 — not completed', async (t) => {
        const fastify = buildApp({ teacherRows: [{ id: 'teacher-001' }], onboardingCompleted: false });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/onboarding/status`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().completed, false);
        t.equal(res.json().has_profile, true);

        await fastify.close();
    });

    await t.test('200 — no profile', async (t) => {
        const fastify = buildApp({ teacherRows: [] });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/onboarding/status`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().completed, false);
        t.equal(res.json().has_profile, false);

        await fastify.close();
    });

    await t.test('401 — unauthenticated', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/onboarding/status`,
        });

        t.equal(res.statusCode, 401);

        await fastify.close();
    });
});

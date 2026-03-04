import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';

const test = tap.test;

const WORKSPACE_ID = '01JEFXGXY86BTY61Z22Z16BVD3';
const OTHER_WORKSPACE_ID = '01JEFXGXY86BTY61Z22Z16BVD4';
const USER_ID = 'user_1';
const OTHER_USER_ID = 'user_2';

// Mock DB adapter state
let mockDbQueryCalls: any[][] = [];
let mockDbQueryResponses: any[] = [];

const mockDbQuery = async (query: string, values?: any[]) => {
    // Implement workspaceGuard membership query mock
    if (query.includes('FROM workspace_members')) {
        const [wid, uid] = values || [];
        if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [{ role: 'admin' }] };
        if (wid === OTHER_WORKSPACE_ID && uid === OTHER_USER_ID) return { rowCount: 1, rows: [{ role: 'admin' }] };
        return { rowCount: 0, rows: [] };
    }

    mockDbQueryCalls.push([query, values]);
    return mockDbQueryResponses.shift() || { rows: [], rowCount: 0 };
};

// Build app function with inline mock overrides
function buildApp() {
    const fastify = Fastify();

    fastify.decorate('db', {
        query: mockDbQuery
    });

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(workspaceRoutes);

    return fastify;
}

test('GET /w/:workspaceId/usage-summary', async (t) => {

    let app: any;

    t.beforeEach(async () => {
        app = await buildApp();
        await app.ready();
        mockDbQueryCalls = [];
        mockDbQueryResponses = [];
    });

    t.afterEach(async () => {
        await app.close();
    });

    t.test('should return all zeros for an empty workspace', async (tt) => {
        mockDbQueryResponses = [
            { rows: [{ balance: '0' }] },
            { rows: [{ count: '0' }] },
            { rows: [{ count: '0' }] },
            { rows: [] }
        ];

        const response = await app.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/usage-summary`,
            headers: {
                authorization: `Bearer ${USER_ID}`
            }
        });

        tt.equal(response.statusCode, 200);
        const data = JSON.parse(response.payload);

        tt.same(data, {
            credits_remaining: 0,
            documents_generated: 0,
            jobs_failed: 0,
            recent_jobs: []
        });

        tt.equal(mockDbQueryCalls.length, 4);
        tt.same(mockDbQueryCalls[0][1], [WORKSPACE_ID]);
    });

    t.test('should calculate ledger aggregation correctly', async (tt) => {
        mockDbQueryResponses = [
            { rows: [{ balance: '120' }] },
            { rows: [{ count: '15' }] },
            { rows: [{ count: '2' }] },
            {
                rows: [
                    {
                        generation_id: 'gen-001',
                        subject: 'Matematika',
                        semester: '1',
                        status: 'done',
                        created_at: '2026-03-01T10:00:00Z'
                    }
                ]
            }
        ];

        const response = await app.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/usage-summary`,
            headers: {
                authorization: `Bearer ${USER_ID}`
            }
        });

        tt.equal(response.statusCode, 200);
        const data = JSON.parse(response.payload);

        tt.equal(data.credits_remaining, 120);
        tt.equal(data.documents_generated, 15);
        tt.equal(data.jobs_failed, 2);

        tt.equal(data.recent_jobs.length, 1);
        tt.equal(data.recent_jobs[0].subject, 'Matematika');
        tt.equal(data.recent_jobs[0].semester, 1);
    });

    t.test('should reject cross-workspace access with 403 Forbidden', async (tt) => {
        const response = await app.inject({
            method: 'GET',
            url: `/w/${OTHER_WORKSPACE_ID}/usage-summary`,
            headers: {
                authorization: `Bearer ${USER_ID}`
            }
        });

        tt.equal(response.statusCode, 403);
        const data = JSON.parse(response.payload);
        tt.equal(data.error, 'Forbidden');

        tt.equal(mockDbQueryCalls.length, 0);
    });

    t.end();
});

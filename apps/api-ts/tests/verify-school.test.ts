import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import workspaceRoutes from '../src/routes/workspace';

const test = tap.test;

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user_1';

function buildApp() {
    const fastify = Fastify();

    let dbQueries: { sql: string, params: any[] }[] = [];

    fastify.decorate('db', {
        /* Expose executed queries to assert against */
        getExecutedQueries: () => dbQueries,

        query: async (sql: string, params: any[]) => {
            dbQueries.push({ sql, params });

            // Workspace membership check (used by workspaceGuard)
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                if (wid === WORKSPACE_ID && uid === USER_ID) {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Schools Reference Lookup
            if (sql.includes('FROM schools_reference')) {
                const [npsn] = params;
                if (npsn === '20227187') {
                    return {
                        rowCount: 1,
                        rows: [{
                            nama_resmi: 'SMAN 1 GARUT',
                            jenjang: 'SMA',
                            alamat: 'JL. MERDEKA NO. 91',
                            kab_kota: 'KAB. GARUT',
                            provinsi: 'PROV. JAWA BARAT'
                        }]
                    };
                }
                return { rowCount: 0, rows: [] };
            }

            // Workspace Settings Update
            if (sql.includes('INSERT INTO workspace_settings')) {
                return { rowCount: 1, rows: [] };
            }

            // Workspaces Identity Update
            if (sql.includes('UPDATE workspaces') && sql.includes('is_verified = true')) {
                return { rowCount: 1, rows: [] };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(workspaceRoutes);

    return fastify;
}

test('POST /w/:workspaceId/verify-school', async (t) => {
    t.test('should return 400 for missing npsn', async (t) => {
        const app = buildApp();
        t.teardown(() => app.close());

        const response = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: {
                'authorization': `Bearer ${USER_ID}`
            },
            payload: {}
        });

        t.equal(response.statusCode, 400);
        t.match(JSON.parse(response.payload), {
            message: "body must have required property 'npsn'"
        });
    });

    t.test('should return 400 for invalid npsn format', async (t) => {
        const app = buildApp();
        t.teardown(() => app.close());

        const response = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: {
                'authorization': `Bearer ${USER_ID}`
            },
            payload: { npsn: 'ABC12345' }
        });

        t.equal(response.statusCode, 400);
        t.match(JSON.parse(response.payload), {
            message: 'body/npsn must match pattern "^[0-9]{8}$"'
        });
    });

    t.test('should return 404 for non-existent npsn', async (t) => {
        const app = buildApp();
        t.teardown(() => app.close());

        const response = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: {
                'authorization': `Bearer ${USER_ID}`
            },
            payload: { npsn: '99999999' }
        });

        t.equal(response.statusCode, 404);
        t.match(JSON.parse(response.payload), {
            error: 'NPSN not found in official reference.'
        });
    });

    t.test('should return 200 and run update queries for valid npsn', async (t) => {
        const app = buildApp();
        t.teardown(() => app.close());

        const response = await app.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/verify-school`,
            headers: {
                'authorization': `Bearer ${USER_ID}`
            },
            payload: { npsn: '20227187' }
        });

        t.equal(response.statusCode, 200);

        const payload = JSON.parse(response.payload);
        t.equal(payload.verified, true);
        t.equal(payload.school_display_name, 'SMAN 1 GARUT');
        t.equal(payload.kab_kota, 'KAB. GARUT');
        t.equal(payload.provinsi, 'PROV. JAWA BARAT');

        // Assert Database Mutations were called
        const dbMock = app.db as any;
        const queries = dbMock.getExecutedQueries();

        const updateSettingsQuery = queries.find(q => q.sql.includes('INSERT INTO workspace_settings'));
        t.ok(updateSettingsQuery, 'Should execute upsert query for workspace_settings');
        t.same(updateSettingsQuery.params, [WORKSPACE_ID, 'SMAN 1 GARUT', 'KAB. GARUT', 'PROV. JAWA BARAT', 'JL. MERDEKA NO. 91', '20227187']);

        const updateWorkspaceQuery = queries.find(q => q.sql.includes('UPDATE workspaces'));
        t.ok(updateWorkspaceQuery, 'Should execute update query for workspaces');
        t.same(updateWorkspaceQuery.params, [WORKSPACE_ID, '20227187', 'SMAN 1 GARUT']);
    });
});

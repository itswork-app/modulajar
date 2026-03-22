import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import modulesRoutes from '../src/routes/modules';

const test = tap.test;

const WORKSPACE_ID = 'ws_smoke_003';
const OTHER_WORKSPACE_ID = 'ws_other_002';
const USER_ID = 'user_1';
const BUCKET = 'test-bucket';

function buildApp(opts: {
    pkgRows?: any[];
    jobRows?: any[];
} = {}) {
    const fastify = Fastify();
    const {
        pkgRows = [],
        jobRows = [],
    } = opts;

    fastify.decorate('db', {
        query: async (sql: string, values: any[]) => {
            if (sql.includes('SELECT 1 FROM workspace_members')) {
                const [wid, uid] = values || [];
                if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }

            if (sql.includes('FROM packages')) {
                const [mid, wid] = values || [];
                const matchedPkgs = pkgRows.filter(p => p.id === mid && p.workspace_id === wid);

                // Emulate LEFT JOIN with generation_jobs
                const rows = matchedPkgs.map(p => {
                    const job = jobRows.find(j => j.package_id === p.id);
                    return { ...p, job_metadata: job ? job.metadata : null };
                });

                return { rowCount: rows.length, rows: rows };
            }

            return { rowCount: 0, rows: [] };
        },
        connect: async () => ({
            query: async () => ({ rowCount: 1, rows: [] }),
            release: () => { }
        } as any),
        totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
    } as any);

    fastify.decorate('storage', {
        generateSignedUrl: async (bucket: string, path: string) => {
            return `https://signed.url/${bucket}/${path}?token=mock`;
        }
    });

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(modulesRoutes);
    return fastify;
}

test('SMOKE PHASE 3: Module Detail Integrity', async (t) => {

    await t.test('GET /modules/:id — returns signed URL for PDF', async (t) => {
        const fastify = buildApp({
            pkgRows: [{
                id: 'mod_1',
                workspace_id: WORKSPACE_ID,
                public_id: 'PID-1',
                status: 'done',
                kelas: '4'
            }],
            jobRows: [{
                package_id: 'mod_1',
                metadata: {
                    pdf_receipts: {
                        main: {
                            pdf_path: 'gcs://test-bucket/path/to/pdf.pdf',
                            pdf_sha256: 'sha256-hash'
                        }
                    }
                }
            }]
        });
        await fastify.ready();
        process.env.GCS_BUCKET = BUCKET;

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod_1`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.match(body.pdf.download_url, /https:\/\/signed\.url/);
        t.equal(body.pdf.sha256, 'sha256-hash');
    });

    await t.test('GET /modules/:id — FAIL 404 for wrong workspace', async (t) => {
        const fastify = buildApp({
            pkgRows: [{
                id: 'mod_secret',
                workspace_id: OTHER_WORKSPACE_ID,
                status: 'done'
            }]
        });
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/modules/mod_secret`,
            headers: { Authorization: `Bearer ${USER_ID}` },
        });

        t.equal(res.statusCode, 404);
    });

});

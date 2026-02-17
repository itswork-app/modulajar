import tap from 'tap';
import Fastify from 'fastify';
import documentsRoutes from '../src/routes/documents';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';

const test = tap.test;

const buildApp = () => {
    const fastify = Fastify();

    // Mock Storage
    fastify.decorate('storage', {
        generateSignedUrl: async (bucket: string, path: string) => `https://signed.gcs/${path}?token=mock`
    });

    // Mock DB — queries now filter by (workspace_id, public_id) instead of global public_id
    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            // Workspace membership check (used by workspaceGuard)
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                if (wid === 'ws-1' && uid === 'user_1') {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Document lookup — now scoped by workspace_id AND public_id
            if (sql.includes('FROM generated_documents')) {
                const [workspaceId, publicId] = params;

                if (workspaceId === 'ws-1' && publicId === 'doc-ready') {
                    return { rowCount: 1, rows: [{ id: '1', workspace_id: 'ws-1', status: 'ready', gcs_path: 'files/doc.pdf' }] };
                }
                if (workspaceId === 'ws-1' && publicId === 'doc-pending') {
                    return { rowCount: 1, rows: [{ id: '2', workspace_id: 'ws-1', status: 'pending', gcs_path: 'files/pending.pdf' }] };
                }
                // doc-other belongs to ws-2 — querying with ws-1 returns nothing (tenant isolation!)
                if (workspaceId === 'ws-2' && publicId === 'doc-other') {
                    return { rowCount: 1, rows: [{ id: '3', workspace_id: 'ws-2', status: 'ready', gcs_path: 'files/secret.pdf' }] };
                }
                return { rowCount: 0, rows: [] };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
    fastify.register(workspaceGuardPlugin);
    fastify.register(documentsRoutes);

    return fastify;
};

test('Download Endpoint', async (t) => {
    process.env.GCS_BUCKET = 'mock-bucket';

    await t.test('Success: Ready document owned by user', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/w/ws-1/documents/doc-ready/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 200, 'Status should be 200');
        const body = res.json();
        t.match(body.download_url, 'https://signed.gcs/files/doc.pdf', 'URL should be correct');
        t.equal(body.expires_in, 600, 'Expires in 600s');

        await fastify.close();
    });

    await t.test('Error: Document not found', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/w/ws-1/documents/doc-missing/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 404, 'Status should be 404');
        t.match(res.json().error, 'Document not found');

        await fastify.close();
    });

    await t.test('Error: Forbidden (other workspace document)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        // user_1 tries to access doc-other via ws-1 — document belongs to ws-2
        // With tenant isolation, querying ws-1 + doc-other returns nothing → 404
        const res = await fastify.inject({
            method: 'GET',
            url: '/w/ws-1/documents/doc-other/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 404, 'Status should be 404 for cross-tenant doc');

        await fastify.close();
    });

    await t.test('Error: Valid document but not ready', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/w/ws-1/documents/doc-pending/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 409, 'Status should be 409 Conflict');
        t.match(res.json().error, 'Document not ready');

        await fastify.close();
    });

});

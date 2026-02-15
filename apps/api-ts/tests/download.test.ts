import tap from 'tap';
import Fastify from 'fastify';
import documentsRoutes from '../src/routes/documents';
import mockAuthPlugin from '../src/plugins/mock_auth';

const test = tap.test;

const buildApp = () => {
    const fastify = Fastify();

    // Mock Storage
    fastify.decorate('storage', {
        generateSignedUrl: async (bucket: string, path: string) => `https://signed.gcs/${path}?token=mock`
    });

    // Mock DB
    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            // Document lookup
            if (sql.includes('FROM generated_documents')) {
                const pid = params[0];
                if (pid === 'doc-ready') {
                    return { rowCount: 1, rows: [{ id: '1', workspace_id: 'ws-1', status: 'ready', gcs_path: 'files/doc.pdf' }] };
                }
                if (pid === 'doc-pending') {
                    return { rowCount: 1, rows: [{ id: '2', workspace_id: 'ws-1', status: 'pending', gcs_path: 'files/pending.pdf' }] };
                }
                if (pid === 'doc-other') {
                    return { rowCount: 1, rows: [{ id: '3', workspace_id: 'ws-2', status: 'ready', gcs_path: 'files/secret.pdf' }] };
                }
                return { rowCount: 0, rows: [] };
            }

            // Membership lookup
            if (sql.includes('FROM workspace_members')) {
                const [wid, uid] = params;
                // Mock auth plugin provides user_1
                if (wid === 'ws-1' && uid === 'user_1') {
                    return { rowCount: 1, rows: [{}] };
                }
                return { rowCount: 0, rows: [] };
            }

            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(mockAuthPlugin);
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
            url: '/doc-ready/download',
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
            url: '/doc-missing/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 404, 'Status should be 404');
        t.match(res.json().error, 'Document not found');

        await fastify.close();
    });

    await t.test('Error: Forbidden (other workspace owner)', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/doc-other/download', // belongs to ws-2
            headers: { Authorization: 'Bearer user_1' } // user_1 only in ws-1
        });

        // Should be 404 to avoid leaking existence
        t.equal(res.statusCode, 404, 'Status should be 404 for forbidden doc');

        await fastify.close();
    });

    await t.test('Error: Valid document but not ready', async (t) => {
        const fastify = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'GET',
            url: '/doc-pending/download',
            headers: { Authorization: 'Bearer user_1' }
        });

        t.equal(res.statusCode, 409, 'Status should be 409 Conflict');
        t.match(res.json().error, 'Document not ready');

        await fastify.close();
    });

});

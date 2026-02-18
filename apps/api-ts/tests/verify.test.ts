import tap from 'tap';
import Fastify from 'fastify';
import verifyRoutes from '../src/routes/verify';

const test = tap.test;

const buildVerifyApp = () => {
    const fastify = Fastify();
    // decorate request with dummy IP for rate limiting
    fastify.addHook('onRequest', async (req) => {
        Object.defineProperty(req, 'ip', { value: '127.0.0.1' });
    });

    // Mock DB
    fastify.decorate('db', {
        query: async (sql: string, params: any[]) => {
            const id = params[0];

            // Verify query pattern
            if (sql.includes('FROM documents')) {
                // Valid done case
                if (id === 'DOC-VALID-1234') {
                    return {
                        rowCount: 1,
                        rows: [{
                            public_id: 'DOC-VALID-1234',
                            generated_at: '2025-01-01T10:00:00Z',
                            status: 'done',
                            metadata: {
                                model: 'gemini-pro',
                                pdf_sha256: 'deadbeef',
                                html_sha256: 'feedface',
                                watermark_summary: {
                                    teacher_masked: 'SUP****',
                                    school_name: 'SDN 1'
                                }
                            }
                        }]
                    };
                }
                // Not done case
                if (id === 'DOC-PENDING-5678') {
                    return { rowCount: 0, rows: [] }; // Query has AND status='done', so it returns 0 rows
                }
            }
            return { rowCount: 0, rows: [] };
        }
    } as any);

    fastify.register(verifyRoutes);
    return fastify;
};

test('Verification Service Hardening (PR-025)', async (t) => {

    await t.test('Success: Verify Valid Done Document', async (t) => {
        const fastify = buildVerifyApp();
        const res = await fastify.inject({
            method: 'GET',
            url: '/DOC-VALID-1234'
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.public_id, 'DOC-VALID-1234');
        t.equal(body.pdf_sha256, 'deadbeef');
        t.equal(body.model, 'gemini-pro');
        t.same(body.watermark_summary, { teacher_masked: 'SUP****', school_name: 'SDN 1' });

        // Assert absence of sensitive fields
        t.notOk(body.workspace_id, 'Should not leak workspace_id');
        t.notOk(body.package_id, 'Should not leak package_id');
        t.notOk(body.file_path, 'Should not leak file_path');

        t.equal(res.headers['cache-control'], 'public, max-age=60');
    });

    await t.test('Fail: Invalid Format (Anti-Enumeration)', async (t) => {
        const fastify = buildVerifyApp();
        const res = await fastify.inject({
            method: 'GET',
            url: '/short'
        });

        t.equal(res.statusCode, 404);
        const body = res.json();
        t.equal(body.error, 'Not found'); // Generic error
    });

    await t.test('Fail: Document Not Done or Not Found', async (t) => {
        const fastify = buildVerifyApp();
        const res = await fastify.inject({
            method: 'GET',
            url: '/DOC-PENDING-5678'
        });

        t.equal(res.statusCode, 404);
        const body = res.json();
        t.equal(body.error, 'Not found');
    });

    await t.test('Fail: Rate Limit Exceeded', async (t) => {
        // Rate limiter is global module-level in verify.ts.
        // We rely on it possibly accumulating state.
        // We need to trigger distinct IPs or loop many times.
        // Since we mock IP as 127.0.0.1 in buildVerifyApp, checking limit is easy.

        const fastify = buildVerifyApp();

        // Exhaust limit (assuming 60)
        // Note: other tests run might have consumed some quota if they ran in same process?
        // `tap` runs tests potentially in same process.

        // Let's fire 65 requests.
        let hitLimit = false;
        for (let i = 0; i < 65; i++) {
            const res = await fastify.inject({
                method: 'GET',
                url: '/DOC-VALID-1234'
            });
            if (res.statusCode === 429) {
                hitLimit = true;
                break;
            }
        }
        t.equal(hitLimit, true, 'Should hit rate limit 429');
    });

});

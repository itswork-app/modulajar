import tap from 'tap';
import Fastify from 'fastify';
import cors from '@fastify/cors';

tap.test('CORS Policy', async (t) => {
    // Setup a minimal Fastify instance with the SAME config as production
    const fastify = Fastify();

    await fastify.register(cors, {
        origin: [
            'https://modulajar.app',
            'https://app.modulajar.app',
            'http://localhost:3000'
        ],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: false,
        strictPreflight: true
    });

    fastify.get('/test', async () => ({ status: 'ok' }));

    t.test('Allowed Origin (modulajar.app)', async (t) => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test',
            headers: {
                Origin: 'https://modulajar.app'
            }
        });

        t.equal(response.statusCode, 200);
        t.equal(response.headers['access-control-allow-origin'], 'https://modulajar.app');
        t.end();
    });

    t.test('Allowed Origin (localhost:3000)', async (t) => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test',
            headers: {
                Origin: 'http://localhost:3000'
            }
        });

        t.equal(response.statusCode, 200);
        t.equal(response.headers['access-control-allow-origin'], 'http://localhost:3000');
        t.end();
    });

    t.test('Disallowed Origin (evil.com)', async (t) => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test',
            headers: {
                Origin: 'https://evil.com'
            }
        });

        t.equal(response.statusCode, 200); // Request succeeds but no CORS headers
        t.notOk(response.headers['access-control-allow-origin'], 'Should not return Allow-Origin header');
        t.end();
    });

    t.test('Preflight OPTIONS', async (t) => {
        const response = await fastify.inject({
            method: 'OPTIONS',
            url: '/test',
            headers: {
                Origin: 'https://modulajar.app',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        t.equal(response.statusCode, 204);
        t.equal(response.headers['access-control-allow-origin'], 'https://modulajar.app');
        t.equal(response.headers['access-control-allow-methods'], 'GET, POST');
        t.end();
    });

    t.end();
});

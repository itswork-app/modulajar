import { test } from 'tap';
import Fastify from 'fastify';
import { register } from '../src/utils/metrics';

test('GET /metrics returns prometheus metrics', async (t) => {
    const fastify = Fastify();

    fastify.get('/metrics', async (_req, reply) => {
        reply.header('Content-Type', register.contentType!);
        return register.metrics();
    });

    const response = await fastify.inject({
        method: 'GET',
        url: '/metrics'
    });

    t.equal(response.statusCode, 200);
    t.ok(response.headers['content-type'].includes('text/plain'));
    t.ok(response.payload.includes('modulajar_api_'));
});

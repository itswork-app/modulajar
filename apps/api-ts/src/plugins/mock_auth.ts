import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock Auth Plugin for Testing
const mockAuthPlugin = fp(async (fastify, options) => {
    fastify.decorateRequest('auth', null);

    fastify.decorate('verifyClerk', async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;

        // Simulate invalid token
        if (!authHeader || authHeader === 'Bearer invalid') {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Simulate different users based on token content
        if (authHeader === 'Bearer user_1') {
            request.auth = { clerk_user_id: 'user_1', userId: 'user_1' };
        } else if (authHeader === 'Bearer user_2') {
            request.auth = { clerk_user_id: 'user_2', userId: 'user_2' };
        } else {
            request.auth = { clerk_user_id: 'test_user', userId: 'test_user' };
        }
    });
});

export default mockAuthPlugin;

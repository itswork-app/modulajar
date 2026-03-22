import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate('platformGuard', async (request: FastifyRequest, reply: FastifyReply) => {
        const clerkUserId = request.auth?.clerk_user_id;
        const email = request.auth?.email;

        if (!clerkUserId) {
            return reply.code(401).send({ error: 'Unauthorized', message: 'User not authenticated' });
        }

        // Hardcoded Superadmin Override for Initial Setup
        if (email === 'rejaputraperdana@gmail.com') {
            request.platformRole = 'owner';
            return;
        }

        // Check platform_roles table
        const result = await fastify.db.query(
            'SELECT role FROM platform_roles WHERE clerk_user_id = $1',
            [clerkUserId]
        );

        if (result.rowCount === 0) {
            return reply.code(403).send({ error: 'Forbidden', message: 'Platform Admin access required' });
        }

        request.platformRole = result.rows[0].role;
    });
});

declare module 'fastify' {
    interface FastifyInstance {
        platformGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        platformRole?: string;
    }
}

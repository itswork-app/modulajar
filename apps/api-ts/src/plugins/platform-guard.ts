import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate('platformGuard', async (request: FastifyRequest, reply: FastifyReply) => {
        const clerkUserId = request.auth?.clerk_user_id;

        if (!clerkUserId) {
            return reply.code(401).send({ error: 'Unauthorized', message: 'User not authenticated' });
        }

        // Check platform_roles table
        const result = await fastify.db.query(
            'SELECT role FROM platform_roles WHERE clerk_user_id = $1',
            [clerkUserId]
        );

        if (result.rowCount === 0) {
            // For production safety, we might want to allow a specific hardcoded ID if the table is empty
            // But let's stick to the database for now.
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

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate('platformGuard', async (request: FastifyRequest, reply: FastifyReply) => {
        const clerkUserId = request.auth?.clerk_user_id;

        if (!clerkUserId) {
            return reply.code(401).send({ error: 'Unauthorized', message: 'User not authenticated' });
        }

        // Optional bootstrap: comma-separated Clerk user IDs (set in deployment env only, never commit secrets)
        const bootstrapIds = (process.env.PLATFORM_ADMIN_CLERK_USER_IDS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (bootstrapIds.includes(clerkUserId)) {
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

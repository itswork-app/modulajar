import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import schemasPlugin from './schemas';

/**
 * Centralized Workspace Guard Plugin.
 *
 * Provides a single reusable preHandler that:
 * 1. Verifies Clerk JWT authentication
 * 2. Extracts workspaceId from route params
 * 3. Checks workspace membership
 * 4. Injects workspaceId into request context
 *
 * Usage:
 *   preHandler: [fastify.workspaceGuard]
 */
const workspaceGuardPlugin = fp(async (fastify) => {
    fastify.register(schemasPlugin);
    fastify.decorateRequest('workspaceId', '');

    fastify.decorate('workspaceGuard', async (request: FastifyRequest, reply: FastifyReply) => {
        // 1. Verify auth
        await fastify.verifyClerk(request, reply);
        if (reply.sent) return;

        const { workspaceId } = request.params as { workspaceId?: string };
        const clerkUserId = request.auth?.clerk_user_id;

        // 2. Require workspace context
        if (!workspaceId) {
            return reply.code(403).send({
                error: 'Workspace context required',
                message: 'All operations require a workspace context'
            });
        }

        // 3. Check membership
        const result = await fastify.db.query(
            `SELECT 1 FROM workspace_members
             WHERE TRIM(workspace_id) = $1 AND clerk_user_id = $2`,
            [workspaceId, clerkUserId]
        );

        if (result.rowCount === 0) {
            return reply.code(403).send({
                error: 'Forbidden',
                message: 'Not a member of this workspace'
            });
        }

        // 4. Inject workspace context
        request.workspaceId = workspaceId;
    });
});

export default workspaceGuardPlugin;

declare module 'fastify' {
    interface FastifyRequest {
        workspaceId: string;
    }
    interface FastifyInstance {
        workspaceGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

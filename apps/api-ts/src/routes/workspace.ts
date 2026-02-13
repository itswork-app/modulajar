import { FastifyInstance } from 'fastify';

export default async function workspaceRoutes(fastify: FastifyInstance) {

    // Guard Logic
    const workspaceGuard = async (request: any, reply: any) => {
        // 1. Verify Auth
        await fastify.verifyClerk(request, reply);

        const { workspaceId } = request.params as { workspaceId: string };
        const { clerk_user_id } = request.auth || {};

        if (!workspaceId) {
            return reply.code(400).send({ error: 'Missing workspaceId' });
        }

        // 2. Check Membership
        const result = await fastify.db.query(
            `SELECT 1 FROM workspace_members 
         WHERE workspace_id = $1 AND clerk_user_id = $2`,
            [workspaceId, clerk_user_id]
        );

        if (result.rowCount === 0) {
            return reply.code(403).send({ error: 'Forbidden', message: 'Not a member of this workspace' });
        }
    };

    fastify.register(async (childServer) => {
        // Validated Routes
        childServer.get('/:workspaceId/ping', {
            preHandler: [workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            return {
                status: 'ok',
                workspaceId,
                userId: request.auth?.clerk_user_id
            };
        });

    }, { prefix: '/w' });
}

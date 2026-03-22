import { FastifyInstance } from 'fastify';

export default async function referralRoutes(fastify: FastifyInstance) {
    // GET /w/:workspaceId/referral
    fastify.get('/:workspaceId/referral', {
        preHandler: [fastify.workspaceGuard]
    }, async (request, reply) => {
        const workspaceId = request.workspaceId;

        const wRes = await fastify.db.query(
            `SELECT referral_code FROM workspaces WHERE id = $1`,
            [workspaceId]
        );

        if (wRes.rowCount === 0) {
            return reply.code(404).send({ error: 'Workspace not found' });
        }

        const referral_code = wRes.rows[0].referral_code;

        // In a production app you'd inject BASE_URL through env
        const referral_link = referral_code ? `https://modulajar.app/r/${referral_code}` : null;

        const countRes = await fastify.db.query(
            `SELECT count(*) as total FROM referrals WHERE referrer_workspace = $1`,
            [workspaceId]
        );

        return {
            referral_code,
            referral_link,
            total_referrals: parseInt(countRes.rows[0].total, 10)
        };
    });

    // POST /referral/attach
    // Called usually natively under the hood during the signup/bootstrap process if a code is present
    fastify.post('/:workspaceId/referral/attach', {
        preHandler: [fastify.workspaceGuard],
        schema: {
            body: {
                type: 'object',
                required: ['referral_code'],
                properties: {
                    referral_code: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const workspaceId = request.workspaceId;
        const { referral_code } = request.body as { referral_code: string };

        // 1. Resolve referrer_workspace from code
        const refRes = await fastify.db.query(
            `SELECT id FROM workspaces WHERE referral_code = $1`,
            [referral_code]
        );

        if (refRes.rowCount === 0) {
            return reply.code(400).send({ error: 'Invalid referral code' });
        }

        const referrerWorkspaceId = refRes.rows[0].id;

        // 2. Reject if self-referral
        if (referrerWorkspaceId === workspaceId) {
            return reply.code(400).send({ error: 'Cannot refer your own workspace' });
        }

        // 3. Insert relationship securely (ignores duplicates via ON CONFLICT)
        await fastify.db.query(
            `INSERT INTO referrals (referrer_workspace, referred_workspace)
       VALUES ($1, $2)
       ON CONFLICT (referrer_workspace, referred_workspace) DO NOTHING`,
            [referrerWorkspaceId, workspaceId]
        );

        return { status: 'attached' };
    });
}

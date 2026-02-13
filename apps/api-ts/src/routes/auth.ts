import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';

export default async function authRoutes(fastify: FastifyInstance) {
    // GET /me
    fastify.get('/me', {
        preHandler: [fastify.verifyClerk]
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;

        // Fetch user's workspaces
        const result = await fastify.db.query(
            `SELECT w.id, w.name, w.clerk_org_id, m.role 
       FROM workspaces w
       JOIN workspace_members m ON w.id = m.workspace_id
       WHERE m.clerk_user_id = $1`,
            [clerk_user_id]
        );

        return {
            clerk_user_id,
            workspaces: result.rows
        };
    });

    // POST /bootstrap
    // Idempotent: Ensures user has at least one workspace (personal)
    fastify.post('/bootstrap', {
        preHandler: [fastify.verifyClerk]
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;
        const body = request.body as { clerk_org_id?: string; name?: string };

        // 1. Check if user already has any workspace
        const check = await fastify.db.query(
            `SELECT 1 FROM workspace_members WHERE clerk_user_id = $1 LIMIT 1`,
            [clerk_user_id]
        );

        if (check.rowCount && check.rowCount > 0) {
            return { message: 'User already bootstrapped' };
        }

        // 2. Create Personal Workspace
        const workspaceId = ulid();
        const workspaceName = body.name || 'My Workspace';
        const clerkOrgId = body.clerk_org_id || `personal_${clerk_user_id}`; // Fallback if not provided

        const client = await fastify.db.connect();
        try {
            await client.query('BEGIN');

            // Insert Workspace
            await client.query(
                `INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (clerk_org_id) DO NOTHING`, // Handle race condition or re-run
                [workspaceId, clerkOrgId, workspaceName]
            );

            // Get actual workspace ID in case of conflict (if we want to join existing org)
            // But for strictly personal bootstrap, we might just fail or fetch existing.
            // For v0, let's assume we create a new one or ignore if unique constraint violates (meaning handled)

            // Insert Member (Owner)
            // We need to fetch the ID again if ON CONFLICT DO NOTHING triggered? 
            // Actually, if we use ULID, the ID is generated here. If conflict on clerk_org_id, 
            // it means workspace exists. 

            let finalWorkspaceId = workspaceId;
            if (check.rowCount === 0) { // Should match Insert logic
                const existing = await client.query(
                    `SELECT id FROM workspaces WHERE clerk_org_id = $1`,
                    [clerkOrgId]
                );
                if (existing.rows.length > 0) {
                    finalWorkspaceId = existing.rows[0].id;
                }
            }

            await client.query(
                `INSERT INTO workspace_members (id, workspace_id, clerk_user_id, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, clerk_user_id) DO NOTHING`,
                [ulid(), finalWorkspaceId, clerk_user_id, 'owner']
            );

            await client.query('COMMIT');

            return {
                status: 'bootstrapped',
                workspaceId: finalWorkspaceId
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    });
}

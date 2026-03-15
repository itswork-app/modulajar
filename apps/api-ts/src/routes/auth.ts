import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import crypto from 'crypto';

function generateReferralCode(): string {
    // Generate 5 random bytes and conver to base32-like string (uppercase alphanumeric)
    // 5 bytes = 40 bits = 8 base32 chars
    return crypto.randomBytes(5)
        .toString('base64')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .substring(0, 8);
}

export default async function authRoutes(fastify: FastifyInstance) {
    // GET /me
    fastify.get('/me', {
        preHandler: [fastify.verifyClerk],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        clerk_user_id: { type: 'string' },
                        workspaces: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    clerk_org_id: { type: 'string' },
                                    role: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }
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

    // GET /workspaces
    // List all workspaces for the authenticated user
    fastify.get('/workspaces', {
        preHandler: [fastify.verifyClerk],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        workspaces: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    role: { type: 'string' },
                                    school_name: { type: 'string' },
                                    is_verified: { type: 'boolean' },
                                    workspace_type: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;

        const result = await fastify.db.query(
            `SELECT w.id, w.name, w.school_name, w.is_verified, w.workspace_type, m.role 
             FROM workspaces w
             JOIN workspace_members m ON w.id = m.workspace_id
             WHERE m.clerk_user_id = $1
             ORDER BY w.created_at ASC`,
            [clerk_user_id]
        );

        return { workspaces: result.rows };
    });

    // POST /workspaces
    // Create a new workspace manually
    fastify.post('/workspaces', {
        preHandler: [fastify.verifyClerk],
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 3, maxLength: 50 }
                }
            }
        }
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;
        const { name } = request.body as { name: string };

        const workspaceId = ulid();
        const refCode = generateReferralCode();

        const client = await fastify.db.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO workspaces (id, name, referral_code) VALUES ($1, $2, $3)`,
                [workspaceId, name, refCode]
            );

            await client.query(
                `INSERT INTO workspace_members (id, workspace_id, clerk_user_id, role)
                 VALUES ($1, $2, $3, $4)`,
                [ulid(), workspaceId, clerk_user_id, 'owner']
            );

            await client.query('COMMIT');

            return {
                status: 'created',
                workspaceId
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    });

    // POST /bootstrap
    // Idempotent: Ensures user has at least one workspace (personal)
    fastify.post('/bootstrap', {
        preHandler: [fastify.verifyClerk],
        schema: {
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    clerk_org_id: { type: 'string' }
                }
            },
            response: {
                200: {
                    oneOf: [
                        {
                            type: 'object',
                            required: ['status', 'workspaceId'],
                            properties: {
                                status: { type: 'string', example: 'bootstrapped' },
                                workspaceId: { type: 'string' }
                            }
                        },
                        {
                            type: 'object',
                            required: ['message', 'status'],
                            properties: {
                                message: { type: 'string', example: 'User already bootstrapped' },
                                status: { type: 'string', example: 'already_bootstrapped' }
                            }
                        }
                    ]
                }
            }
        }
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;
        const body = (request.body || {}) as { clerk_org_id?: string; name?: string };

        // 1. Check if user already has any workspace
        const check = await fastify.db.query(
            `SELECT 1 FROM workspace_members WHERE clerk_user_id = $1 LIMIT 1`,
            [clerk_user_id]
        );

        if (check.rowCount && check.rowCount > 0) {
            return { status: 'already_bootstrapped', message: 'User already bootstrapped' };
        }

        // 2. Create Personal Workspace
        const workspaceId = ulid();
        const workspaceName = body.name || 'My Workspace';
        const clerkOrgId = body.clerk_org_id || `personal_${clerk_user_id}`; // Fallback if not provided

        const client = await fastify.db.connect();
        try {
            await client.query('BEGIN');

            // Generate unique referral code
            const refCode = generateReferralCode();

            // Insert Workspace
            await client.query(
                `INSERT INTO workspaces (id, clerk_org_id, name, referral_code) VALUES ($1, $2, $3, $4)
         ON CONFLICT (clerk_org_id) DO NOTHING`, // Handle race condition or re-run
                [workspaceId, clerkOrgId, workspaceName, refCode]
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

    // POST /workspaces/join
    // Join an existing workspace via referral/invite code
    fastify.post('/workspaces/join', {
        preHandler: [fastify.verifyClerk],
        schema: {
            body: {
                type: 'object',
                required: ['code'],
                properties: {
                    code: { type: 'string', minLength: 5, maxLength: 10 }
                }
            }
        }
    }, async (request, reply) => {
        const { clerk_user_id } = request.auth!;
        const { code } = request.body as { code: string };

        // 1. Find workspace by referral code
        const workspaceResult = await fastify.db.query(
            `SELECT id, name FROM workspaces WHERE referral_code = $1`,
            [code.toUpperCase()]
        );

        if (workspaceResult.rowCount === 0) {
            return reply.code(404).send({ 
                error: 'Not Found', 
                message: 'Kode sekolah tidak valid atau tidak ditemukan.' 
            });
        }

        const workspaceId = workspaceResult.rows[0].id;

        // 2. Check if already a member
        const memberCheck = await fastify.db.query(
            `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND clerk_user_id = $2`,
            [workspaceId, clerk_user_id]
        );

        if (memberCheck.rowCount && memberCheck.rowCount > 0) {
            return reply.code(400).send({ 
                error: 'Already Member', 
                message: 'Anda sudah menjadi anggota di workspace ini.' 
            });
        }

        // 3. Add as member
        await fastify.db.query(
            `INSERT INTO workspace_members (id, workspace_id, clerk_user_id, role)
             VALUES ($1, $2, $3, $4)`,
            [ulid(), workspaceId, clerk_user_id, 'member']
        );

        return {
            status: 'joined',
            workspaceId,
            name: workspaceResult.rows[0].name
        };
    });
}

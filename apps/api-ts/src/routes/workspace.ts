import { FastifyInstance } from 'fastify';

export default async function workspaceRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {
        // Validated Routes
        childServer.get('/:workspaceId/ping', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            return {
                status: 'ok',
                workspaceId: request.workspaceId,
                userId: request.auth?.clerk_user_id
            };
        });

        // List Documents (Generation Jobs + Packages)
        childServer.get('/:workspaceId/documents', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const result = await fastify.db.query(
                `SELECT 
                    gj.id AS job_id,
                    gj.status,
                    gj.created_at,
                    p.public_id,
                    p.semester,
                    p.tahun_ajaran,
                    p.kelas,
                    p.school_name,
                    p.teacher_name
                 FROM generation_jobs gj
                 JOIN packages p ON p.id = gj.package_id
                 WHERE gj.workspace_id = $1
                 ORDER BY gj.created_at DESC
                 LIMIT 50`,
                [request.workspaceId]
            );

            const documents = result.rows.map(row => ({
                id: row.job_id,
                public_id: row.public_id,
                status: row.status,
                created_at: row.created_at,
                subject: 'Modul Ajar', // Placeholder as subject isn't in packages
                jenjang: parseInt(row.kelas) > 12 ? 'Kampus' : (parseInt(row.kelas) > 9 ? 'SMA/SMK' : (parseInt(row.kelas) > 6 ? 'SMP' : 'SD')),
                kelas: row.kelas,
                semester: row.semester,
                tahun_ajaran: row.tahun_ajaran,
                school_name: row.school_name,
                teacher_name: row.teacher_name
            }));

            return { documents };
        });

        // Get Workspace Identity
        childServer.get('/:workspaceId/workspace', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const result = await fastify.db.query(
                `SELECT 
                    id AS workspace_id,
                    workspace_type,
                    npsn,
                    school_name,
                    province,
                    regency,
                    address,
                    logo_url,
                    is_verified
                 FROM workspaces
                 WHERE id = $1`,
                [request.workspaceId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ error: 'Workspace not found' });
            }

            return result.rows[0];
        });

        // Update Workspace Identity
        childServer.patch('/:workspaceId/workspace', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        workspace_type: { type: 'string', enum: ['personal', 'institution'] },
                        npsn: { type: 'string', pattern: '^[0-9]{8,10}$' },
                        school_name: { type: 'string', maxLength: 120 },
                        province: { type: 'string' },
                        regency: { type: 'string' },
                        address: { type: 'string' },
                        logo_url: { type: 'string', pattern: '^https://' }
                    }
                }
            }
        }, async (request, reply) => {
            const updates = request.body as any;

            if (!updates || Object.keys(updates).length === 0) {
                return reply.code(400).send({ error: 'No fields to update' });
            }

            // NPSN Duplicate Check
            if (updates.npsn) {
                const dupCheck = await fastify.db.query(
                    `SELECT id FROM workspaces WHERE npsn = $1 AND id != $2`,
                    [updates.npsn, request.workspaceId]
                );
                if ((dupCheck.rowCount ?? 0) > 0) {
                    return reply.code(409).send({
                        error: 'Conflict',
                        message: 'NPSN already registered to another workspace'
                    });
                }
            }

            const fields = Object.keys(updates);
            const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
            const values = fields.map(f => updates[f]);

            await fastify.db.query(
                `UPDATE workspaces SET ${setClause}, updated_at = NOW() WHERE id = $1`,
                [request.workspaceId, ...values]
            );

            return { status: 'ok' };
        });

        // PR-056: Verify School with NPSN
        childServer.post('/:workspaceId/verify-school', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    required: ['npsn'],
                    properties: {
                        npsn: { type: 'string', pattern: '^[0-9]{8}$' }
                    }
                }
            }
        }, async (request, reply) => {
            const body = request.body as { npsn: string };
            const npsn = body.npsn;

            // 1. Lookup in reference database
            const lookupResult = await fastify.db.query(
                `SELECT nama_resmi, jenjang, alamat, kab_kota, provinsi 
                 FROM schools_reference 
                 WHERE npsn = $1`,
                [npsn]
            );

            if (lookupResult.rowCount === 0) {
                return reply.code(404).send({ error: 'NPSN not found in official reference.' });
            }

            const school = lookupResult.rows[0];

            // 2. Update workspace settings
            await fastify.db.query(
                `INSERT INTO workspace_settings (workspace_id, school_display_name, kab_kota, provinsi, alamat, school_npsn, school_verified, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
                 ON CONFLICT (workspace_id) DO UPDATE SET
                    school_display_name = $2,
                    kab_kota = $3,
                    provinsi = $4,
                    alamat = $5,
                    school_npsn = $6,
                    school_verified = true,
                    updated_at = NOW()`,
                [
                    request.workspaceId,
                    school.nama_resmi,
                    school.kab_kota,
                    school.provinsi,
                    school.alamat,
                    npsn
                ]
            );

            // 3. Mark workspace identity as verified as well
            await fastify.db.query(
                `UPDATE workspaces 
                 SET is_verified = true, 
                     npsn = $2, 
                     school_name = $3, 
                     updated_at = NOW()
                 WHERE id = $1`,
                [request.workspaceId, npsn, school.nama_resmi]
            );

            return {
                verified: true,
                school_display_name: school.nama_resmi,
                kab_kota: school.kab_kota,
                provinsi: school.provinsi
            };
        });

    }, { prefix: '/w' });
}

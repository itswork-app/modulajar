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

        // PR-057: Usage Summary Dashboard
        childServer.get('/:workspaceId/usage-summary', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;

            // 1. Compute credits_remaining
            const creditsResult = await fastify.db.query(
                `SELECT 
                    COALESCE(SUM(CASE WHEN type='credit' THEN amount END), 0) - 
                    COALESCE(SUM(CASE WHEN type='debit' THEN amount END), 0) AS balance
                 FROM wallet_ledger 
                 WHERE workspace_id = $1`,
                [workspaceId]
            );
            const creditsRemaining = parseInt(creditsResult.rows[0]?.balance || '0', 10);

            // 2. documents_generated (Using generation_jobs status = 'done')
            const generatedResult = await fastify.db.query(
                `SELECT COUNT(*) AS count 
                 FROM generation_jobs 
                 WHERE workspace_id = $1 AND status = 'done'`,
                [workspaceId]
            );
            const documentsGenerated = parseInt(generatedResult.rows[0]?.count || '0', 10);

            // 3. jobs_failed
            const failedResult = await fastify.db.query(
                `SELECT COUNT(*) AS count 
                 FROM generation_jobs 
                 WHERE workspace_id = $1 AND status = 'failed'`,
                [workspaceId]
            );
            const jobsFailed = parseInt(failedResult.rows[0]?.count || '0', 10);

            // 4. recent_jobs
            const recentJobsResult = await fastify.db.query(
                `SELECT 
                    generation_id, 
                    metadata->>'subject' AS subject,
                    metadata->>'semester' AS semester,
                    status, 
                    created_at 
                 FROM generation_jobs 
                 WHERE workspace_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [workspaceId]
            );

            const recentJobs = recentJobsResult.rows.map(row => ({
                generation_id: row.generation_id,
                subject: row.subject || 'Modul Ajar', // Fallback if missing
                semester: row.semester ? parseInt(row.semester, 10) : 1,
                status: row.status,
                created_at: row.created_at
            }));

            return {
                credits_remaining: creditsRemaining,
                documents_generated: documentsGenerated,
                jobs_failed: jobsFailed,
                recent_jobs: recentJobs
            };
        });

    }, { prefix: '/w' });
}

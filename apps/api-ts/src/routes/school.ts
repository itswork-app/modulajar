import { FastifyInstance } from 'fastify';

export default async function schoolRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/school
        childServer.get<{ Params: { workspaceId: string } }>('/:workspaceId/school', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params;

            const { rowCount, rows } = await fastify.db.query(
                `SELECT school_display_name, kab_kota, provinsi, alamat, school_npsn, school_verified,
                        principal_name, principal_nip, signature_location
                 FROM workspace_settings
                 WHERE workspace_id = $1`,
                [workspaceId]
            );

            if (rowCount === 0) {
                return reply.code(404).send({ error: 'School identity not found for this workspace' });
            }

            return rows[0];
        });

        // POST /w/:workspaceId/school
        childServer.post<{
            Params: { workspaceId: string };
            Body: {
                school_display_name: string;
                kab_kota?: string;
                provinsi?: string;
                alamat?: string;
                school_npsn?: string;
                principal_name?: string;
                principal_nip?: string;
                signature_location?: string;
            }
        }>('/:workspaceId/school', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    required: ['school_display_name'],
                    properties: {
                        school_display_name: { type: 'string', minLength: 3 },
                        kab_kota: { type: ['string', 'null'] },
                        provinsi: { type: ['string', 'null'] },
                        alamat: { type: ['string', 'null'] },
                        school_npsn: { type: ['string', 'null'], pattern: '^([0-9]{8})?$' },
                        principal_name: { type: ['string', 'null'] },
                        principal_nip: { type: ['string', 'null'] },
                        signature_location: { type: ['string', 'null'] }
                    }
                }
            }
        }, async (request, reply) => {
            const { workspaceId } = request.params;
            const body = request.body;

            // Ensure trimmed display name is at least 3 chars
            const trimmedName = body.school_display_name.trim();
            if (trimmedName.length < 3) {
                return reply.code(400).send({ error: 'school_display_name must be at least 3 characters' });
            }

            const npsn = body.school_npsn?.trim() || null;
            if (npsn && !/^[0-9]{8}$/.test(npsn)) {
                return reply.code(400).send({ error: 'school_npsn must be exactly 8 digits' });
            }

            // Upsert workspace_settings.
            const query = `
                INSERT INTO workspace_settings (
                    workspace_id, 
                    school_display_name, 
                    kab_kota, 
                    provinsi, 
                    alamat, 
                    school_npsn,
                    principal_name,
                    principal_nip,
                    signature_location,
                    school_verified,
                    updated_at
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW())
                ON CONFLICT (workspace_id) 
                DO UPDATE SET 
                    school_display_name = EXCLUDED.school_display_name,
                    kab_kota = EXCLUDED.kab_kota,
                    provinsi = EXCLUDED.provinsi,
                    alamat = EXCLUDED.alamat,
                    school_npsn = EXCLUDED.school_npsn,
                    principal_name = EXCLUDED.principal_name,
                    principal_nip = EXCLUDED.principal_nip,
                    signature_location = EXCLUDED.signature_location,
                    school_verified = false,
                    updated_at = NOW()
                RETURNING school_display_name, kab_kota, provinsi, alamat, school_npsn, school_verified,
                          principal_name, principal_nip, signature_location
            `;

            const { rows } = await fastify.db.query(query, [
                workspaceId,
                trimmedName,
                body.kab_kota?.trim() || null,
                body.provinsi?.trim() || null,
                body.alamat?.trim() || null,
                npsn,
                body.principal_name?.trim() || null,
                body.principal_nip?.trim() || null,
                body.signature_location?.trim() || null
            ]);

            // PR-L4: Mark onboarding as completed for the teacher in this workspace
            await fastify.db.query(
                `UPDATE teachers SET onboarding_completed = TRUE, updated_at = NOW()
                 WHERE workspace_id = $1`,
                [workspaceId]
            );

            request.log.info({ workspaceId, action: 'upsert_school_identity' }, "School identity updated and onboarding marked completed");

            return rows[0];
        });

    }, { prefix: '/w' });
}

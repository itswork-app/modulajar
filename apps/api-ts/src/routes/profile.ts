import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';

export default async function profileRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/profile
        childServer.get('/:workspaceId/profile', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const result = await fastify.db.query(
                `SELECT full_name, primary_grade, primary_subject, nip 
                 FROM teachers 
                 WHERE workspace_id = $1`,
                [request.workspaceId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ error: 'Teacher profile not found' });
            }

            return result.rows[0];
        });

        // POST /w/:workspaceId/profile
        childServer.post('/:workspaceId/profile', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    required: ['full_name'],
                    properties: {
                        full_name: { type: 'string', minLength: 1 },
                        primary_subject: { type: 'string', default: '' },
                        primary_grade: { type: 'integer', minimum: 1, maximum: 12, default: 4 },
                        nip: { type: ['string', 'null'] }
                    }
                }
            }
        }, async (request, reply) => {
            const body = request.body as {
                full_name: string;
                primary_subject?: string;
                primary_grade?: number;
                nip?: string | null;
            };

            const grade = body.primary_grade ?? 4;
            const nipVal = body.nip || null;
            const subject = body.primary_subject?.trim() || '';

            // Upsert profile
            const result = await fastify.db.query(
                `INSERT INTO teachers (id, workspace_id, full_name, primary_grade, primary_subject, nip)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workspace_id) 
                 DO UPDATE SET 
                    full_name = EXCLUDED.full_name,
                    primary_grade = EXCLUDED.primary_grade,
                    primary_subject = CASE WHEN EXCLUDED.primary_subject != '' THEN EXCLUDED.primary_subject ELSE teachers.primary_subject END,
                    nip = EXCLUDED.nip,
                    updated_at = NOW()
                 RETURNING full_name, primary_grade, primary_subject, nip`,
                [ulid(), request.workspaceId, body.full_name, grade, subject, nipVal]
            );

            return result.rows[0];
        });

    }, { prefix: '/w' });
}

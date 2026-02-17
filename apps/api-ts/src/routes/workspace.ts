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

    }, { prefix: '/w' });
}

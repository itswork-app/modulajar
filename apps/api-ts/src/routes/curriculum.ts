import { FastifyInstance } from 'fastify';

export default async function curriculumRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/curriculum/topics
        childServer.get<{
            Params: { workspaceId: string };
            Querystring: { jenjang: string; kelas: string; mapel: string; semester?: string };
        }>('/:workspaceId/curriculum/topics', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                querystring: {
                    type: 'object',
                    required: ['jenjang', 'kelas', 'mapel'],
                    properties: {
                        jenjang: { type: 'string' },
                        kelas: { type: 'string' },
                        mapel: { type: 'string' },
                        semester: { type: 'string' }
                    }
                }
            }
        }, async (request, reply) => {
            const { jenjang, kelas, mapel, semester } = request.query;
            const kelasNum = parseInt(kelas, 10);

            let query = `
                SELECT id, title, semester, display_order, cp_reference, notes
                FROM curriculum_topics
                WHERE jenjang = $1 AND kelas = $2 AND mata_pelajaran = $3
            `;
            const params: any[] = [jenjang, kelasNum, mapel];

            if (semester) {
                query += ` AND semester = $4`;
                params.push(parseInt(semester, 10));
            }

            query += ` ORDER BY semester ASC NULLS FIRST, display_order ASC`;

            const { rows } = await fastify.db.query(query, params);

            return { topics: rows };
        });

    }, { prefix: '/w' });
}

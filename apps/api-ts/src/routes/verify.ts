import { FastifyInstance } from 'fastify';

export default async function verifyRoutes(fastify: FastifyInstance) {
    fastify.get('/:publicId', async (request, reply) => {
        const { publicId } = request.params as { publicId: string };

        // 1. Check if it's a Document (DID)
        const docResult = await fastify.db.query(
            `SELECT 'document' as type, public_id, status, kelas, semester, tahun_ajaran, subject
             FROM generated_documents
             WHERE public_id = $1`,
            [publicId]
        );

        if (docResult.rowCount && docResult.rowCount > 0) {
            const doc = docResult.rows[0];
            reply.header('Cache-Control', 'public, max-age=60');
            return {
                type: doc.type,
                public_id: doc.public_id,
                valid: true,
                status: doc.status,
                kelas: doc.kelas,
                semester: doc.semester,
                tahun_ajaran: doc.tahun_ajaran,
                subject: doc.subject
            };
        }

        // 2. Check if it's a Curriculum Pack (PID)
        const packResult = await fastify.db.query(
            `SELECT 'package' as type, public_id, status, kelas, semester, tahun_ajaran
             FROM curriculum_packs
             WHERE public_id = $1`,
            [publicId]
        );

        if (packResult.rowCount && packResult.rowCount > 0) {
            const pack = packResult.rows[0];
            reply.header('Cache-Control', 'public, max-age=60');
            return {
                type: pack.type,
                public_id: pack.public_id,
                valid: true,
                status: pack.status,
                kelas: pack.kelas,
                semester: pack.semester,
                tahun_ajaran: pack.tahun_ajaran
            };
        }

        // 3. Not found
        return reply.code(404).send({
            valid: false,
            error: 'Not found'
        });
    });
}

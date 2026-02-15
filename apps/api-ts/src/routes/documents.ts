import { FastifyInstance } from 'fastify';

export default async function documentsRoutes(fastify: FastifyInstance) {
    fastify.get('/:publicId/download', {
        preHandler: [fastify.verifyClerk]
    }, async (request, reply) => {
        const { publicId } = request.params as { publicId: string };
        const { clerk_user_id } = request.auth || {};

        if (!publicId) {
            return reply.code(400).send({ error: 'Missing publicId' });
        }

        // 1. Lookup document + workspace
        const result = await fastify.db.query(
            `SELECT d.id, d.workspace_id, d.status, d.gcs_path
             FROM generated_documents d
             WHERE d.public_id = $1`,
            [publicId]
        );

        if (result.rowCount === 0) {
            return reply.code(404).send({ error: 'Document not found' });
        }

        const doc = result.rows[0];

        // 2. verify workspace membership
        const membership = await fastify.db.query(
            `SELECT 1 FROM workspace_members
             WHERE workspace_id = $1 AND clerk_user_id = $2`,
            [doc.workspace_id, clerk_user_id]
        );

        if (membership.rowCount === 0) {
            // Return 404 to avoid leaking existence
            return reply.code(404).send({ error: 'Document not found' });
        }

        // 3. Check status
        if (doc.status !== 'ready') {
            return reply.code(409).send({ error: 'Document not ready', status: doc.status });
        }

        // 4. Generate URL
        const bucketName = process.env.GCS_BUCKET;
        if (!bucketName) {
            fastify.log.error('GCS_BUCKET not configured');
            return reply.code(500).send({ error: 'Server configuration error' });
        }

        try {
            const url = await fastify.storage.generateSignedUrl(bucketName, doc.gcs_path);
            return {
                download_url: url,
                expires_in: 600
            };
        } catch (err) {
            fastify.log.error({ err }, 'Failed to generate signed URL');
            return reply.code(500).send({ error: 'Failed to generate download link' });
        }
    });

    fastify.log.info('Registered documents routes');
}

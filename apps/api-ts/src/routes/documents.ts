import { FastifyInstance } from 'fastify';

export default async function documentsRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        childServer.get('/:workspaceId/documents/:publicId/download', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { publicId } = request.params as { publicId: string };
            const workspaceId = request.workspaceId;

            if (!publicId) {
                return reply.code(400).send({ error: 'Missing publicId' });
            }

            // 1. Lookup document scoped to workspace — no cross-tenant leakage
            const result = await fastify.db.query(
                `SELECT d.id, d.workspace_id, d.status, d.gcs_path
                 FROM generated_documents d
                 WHERE d.workspace_id = $1 AND d.public_id = $2`,
                [workspaceId, publicId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ error: 'Document not found' });
            }

            const doc = result.rows[0];

            // 2. Check status
            if (doc.status !== 'ready') {
                return reply.code(409).send({ error: 'Document not ready', status: doc.status });
            }

            // 3. Generate URL
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

    }, { prefix: '/w' });

    fastify.log.info('Registered documents routes');
}

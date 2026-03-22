import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Global schemas used across multiple routes.
 * Registered early so they can be referenced via $ref.
 */
export default fp(async function schemasPlugin(fastify: FastifyInstance) {
    try {
        fastify.addSchema({
            $id: 'Error',
            type: 'object',
            required: ['error'],
            properties: {
                error: { type: 'string' },
                message: { type: 'string' }
            }
        });
    } catch (e) {
        fastify.log.warn('Schema Error already registered, skipping.');
    }

    // Add other common schemas here if needed (e.g. Workspace, JobStatus)
});

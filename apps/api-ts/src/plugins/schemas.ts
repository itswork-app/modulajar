import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Global schemas used across multiple routes.
 * Registered early so they can be referenced via $ref.
 */
export default fp(async function schemasPlugin(fastify: FastifyInstance) {
    fastify.addSchema({
        $id: 'Error',
        type: 'object',
        required: ['error'],
        properties: {
            error: { type: 'string' },
            message: { type: 'string' }
        }
    });

    // Add other common schemas here if needed (e.g. Workspace, JobStatus)
});

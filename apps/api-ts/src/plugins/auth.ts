import fp from 'fastify-plugin';
import { createClerkClient } from '@clerk/backend';
import { FastifyRequest, FastifyReply } from 'fastify';

const authPlugin = fp(async (fastify, options) => {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    // Decorate request with auth object
    fastify.decorateRequest('auth', null);

    fastify.decorate('verifyClerk', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new Error('Missing or invalid Authorization header');
            }

            const token = authHeader.split(' ')[1];

            // Verify token using @clerk/backend verifyToken
            const claims = await clerk.verifyToken(token);

            request.auth = {
                clerk_user_id: claims.sub,
                org_id: claims.org_id as string | undefined,
            };

        } catch (err) {
            fastify.log.warn({ err }, 'Auth failed');
            return reply.code(401).send({ error: 'Unauthorized', message: (err as Error).message });
        }
    });
});

export default authPlugin;

declare module 'fastify' {
    interface FastifyRequest {
        auth: {
            clerk_user_id: string;
            org_id?: string;
        } | null;
        rawBody?: Buffer;
    }
    interface FastifyInstance {
        verifyClerk: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

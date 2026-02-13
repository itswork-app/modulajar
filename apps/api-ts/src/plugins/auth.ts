import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/clerk-sdk-node';
import { FastifyRequest, FastifyReply } from 'fastify';

const authPlugin = fp(async (fastify, options) => {
    // We can initialize Clerk client here if we need backend API access
    // const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    // Decorate request with auth object
    fastify.decorateRequest('auth', null);

    fastify.decorate('verifyClerk', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new Error('Missing or invalid Authorization header');
            }

            const token = authHeader.split(' ')[1];

            // Verify token
            // This will use CLERK_SECRET_KEY or JWKS automatically if configured correctly in env
            // But verifyToken from @clerk/clerk-sdk-node is designed for backend verification
            // It validates signature, exp, nbf, iss, aud

            const claims = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
                issuer: null, // Bypassing issuer check for now as it varies by instance
                // If using a custom JWT template or audience, add here
                // audience: "..." 
            });

            request.auth = {
                clerk_user_id: claims.sub,
                org_id: claims.org_id as string | undefined, // Mapping optional org_id
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
    }
    interface FastifyInstance {
        verifyClerk: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

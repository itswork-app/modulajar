import fp from 'fastify-plugin';
import { verifyToken } from '@clerk/backend';
import { FastifyRequest, FastifyReply } from 'fastify';

const authPlugin = fp(async (fastify, options) => {
    // Decorate request with auth object
    fastify.decorateRequest('auth', null);

    fastify.decorate('verifyClerk', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new Error('Missing or invalid Authorization header');
            }

            const token = authHeader.split(' ')[1];

            // Verify token using @clerk/backend verifyToken helper
            const claims = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });

            request.auth = {
                clerk_user_id: claims.sub!,
                userId: claims.sub!, // Compatibility with @clerk/fastify naming
                org_id: claims.org_id as string | undefined,
                email: (claims as any).email as string | undefined, // Populate email if present in claims
                sessionClaims: claims
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
            userId: string;
            org_id?: string;
            email?: string;
            sessionClaims?: any;
        } | null;
        rawBody?: Buffer;
    }
    interface FastifyInstance {
        verifyClerk: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

import fp from 'fastify-plugin';
import { Pool } from 'pg';

const dbPlugin = fp(async (fastify, options) => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({
        connectionString,
        // Optimal for Cloud Run + Neon (serverless)
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    // Test connection
    try {
        const client = await pool.connect();
        fastify.log.info('Connected to database');
        client.release();
    } catch (err) {
        fastify.log.error({ err }, 'Failed to connect to database');
        throw err;
    }

    fastify.decorate('db', pool);

    fastify.addHook('onClose', async (f) => {
        await pool.end();
    });
});

export default dbPlugin;

declare module 'fastify' {
    export interface FastifyInstance {
        db: Pool;
    }
}

import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
    logger: true
});

// Register Plugins
fastify.register(dbPlugin);
fastify.register(authPlugin);

// Register Routes
fastify.register(authRoutes);
fastify.register(workspaceRoutes);

fastify.get('/healthz', async (request, reply) => {
    return { status: 'ok' };
});

const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '8080');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

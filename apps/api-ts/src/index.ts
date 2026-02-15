import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import storagePlugin from './plugins/storage';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import generateRoutes from './routes/generate';
import billingRoutes from './routes/billing';
import documentsRoutes from './routes/documents';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
    logger: true
});

// Register Plugins
fastify.register(dbPlugin);
fastify.register(authPlugin);
fastify.register(storagePlugin);

// Register Routes
fastify.register(authRoutes);
fastify.register(workspaceRoutes);
fastify.register(generateRoutes);
fastify.register(billingRoutes);
fastify.register(documentsRoutes, { prefix: '/documents' });

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

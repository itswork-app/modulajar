import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import storagePlugin from './plugins/storage';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import generateRoutes from './routes/generate';
import billingRoutes from './routes/billing';
import documentsRoutes from './routes/documents';
import verifyRoutes from './routes/verify';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
    logger: true
});

const SERVICE_MODE = process.env.SERVICE_MODE || 'api';
console.log(`[STARTUP] Starting Modulajar API in ${SERVICE_MODE} mode...`);

// Health checks are always available
fastify.get('/healthz', async () => ({ status: 'ok' }));
fastify.get('/readyz', async () => ({ status: 'ok' }));

// Core Plugins (Common to both modes)
fastify.register(dbPlugin);

if (SERVICE_MODE === 'verify') {
    // ---------------------------------------------------------
    // VERIFY MODE: Public facing minimal endpoints
    // ---------------------------------------------------------
    console.log('[STARTUP] Registering VERIFY mode routes...');
    fastify.register(verifyRoutes, { prefix: '/verify' });

} else {
    // ---------------------------------------------------------
    // API MODE: Full authenticated backend
    // ---------------------------------------------------------
    console.log('[STARTUP] Registering API mode plugins and routes...');
    fastify.register(authPlugin);
    fastify.register(storagePlugin);

    fastify.register(authRoutes);
    fastify.register(workspaceRoutes);
    fastify.register(generateRoutes);
    fastify.register(billingRoutes);
    fastify.register(documentsRoutes, { prefix: '/documents' });
}

const start = async () => {
    try {
        console.log('[STARTUP] Checking critical environment variables...');
        if (!process.env.DATABASE_URL) console.warn('[STARTUP] WARNING: DATABASE_URL is not set');
        if (!process.env.GCS_BUCKET) console.warn('[STARTUP] WARNING: GCS_BUCKET is not set');

        const port = parseInt(process.env.PORT || '8080');
        console.log(`[STARTUP] Attempting to listen on port ${port}...`);

        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`[STARTUP] SUCCESS: Server listening on ${port}`);
    } catch (err) {
        console.error('[STARTUP] FATAL ERROR during start():', err);
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

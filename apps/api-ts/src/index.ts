import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import storagePlugin from './plugins/storage';
import workspaceGuardPlugin from './plugins/workspace-guard';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import profileRoutes from './routes/profile';
import schoolRoutes from './routes/school';
import generateRoutes from './routes/generate';
import billingRoutes from './routes/billing';
import documentsRoutes from './routes/documents';
import verifyRoutes from './routes/verify';
import dotenv from 'dotenv';

import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';
import { register, httpRequestsTotal, httpRequestDuration } from './utils/metrics';

dotenv.config();

import cors from '@fastify/cors';

const fastify = Fastify({
    logger: false, // Use our structured logger
    genReqId: (req) => (req.headers['x-trace-id'] as string) || uuidv4(), // Trace ID correlation
});

// PR-027: Strict CORS Hardening
fastify.register(cors, {
    origin: [
        'https://modulajar.app',
        'https://app.modulajar.app',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false, // Strict: No credentials unless required
    strictPreflight: true // Enforce strict preflight checks
});

// Helper to capture raw body for webhook verification
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body; // Attach raw body to request
    try {
        const json = JSON.parse(body.toString());
        done(null, json);
    } catch (err) {
        (err as any).statusCode = 400;
        done(err as Error, undefined);
    }
});

// Middleware: Metrics & Logging
fastify.addHook('onRequest', async (request, _reply) => {
    (request as any).startTime = process.hrtime();
});

fastify.addHook('onResponse', async (request, reply) => {
    const duration = process.hrtime((request as any).startTime);
    const durationMs = (duration[0] * 1000 + duration[1] / 1e6);

    // Normalize route (avoid high cardinality on 404s or params)
    const route = request.routeOptions.url || (request as any).routerPath || 'unknown';
    const method = request.method;
    const status = reply.statusCode;

    // 1. Metrics
    httpRequestsTotal.inc({ method, route, status });
    httpRequestDuration.observe({ method, route }, durationMs);

    // 2. Structured Log
    logger.info({
        trace_id: request.id,
        method,
        url: request.url,
        route,
        status,
        duration_ms: durationMs,
        user_agent: request.headers['user-agent'],
    }, 'http_request');
});

// Metrics Endpoint
fastify.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
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
    fastify.register(workspaceGuardPlugin);
    fastify.register(storagePlugin);

    fastify.register(authRoutes);
    fastify.register(workspaceRoutes);
    fastify.register(profileRoutes);
    fastify.register(schoolRoutes);
    fastify.register(generateRoutes);
    fastify.register(billingRoutes);
    fastify.register(documentsRoutes);
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

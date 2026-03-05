import { FastifyInstance } from 'fastify';
import { fetchRankedTemplates } from '../services/templateService';
import { RateLimiter } from '../utils/rate-limit';
import { logger } from '../utils/logger';
import {
    templateApiRequestsTotal,
    templateApiLatencyMs,
    templateApiErrorsTotal,
} from '../utils/metrics';

// 60 requests per minute per IP
const rateLimiter = new RateLimiter(60_000, 60);

export default async function templateRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        childServer.get('/:workspaceId/templates/recommended', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const startTime = process.hrtime();

            // Rate limit by IP
            const clientIp = request.ip || 'unknown';
            if (!rateLimiter.check(clientIp)) {
                templateApiErrorsTotal.inc({ reason: 'rate_limited' });
                return reply.code(429).send({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Max 60 requests per minute.',
                });
            }

            const query = request.query as { subject?: string; grade?: string; topic?: string };

            // --- Input Validation ---

            if (!query.subject || query.subject.trim() === '') {
                templateApiErrorsTotal.inc({ reason: 'validation' });
                return reply.code(400).send({
                    error: 'Missing required parameter: subject',
                });
            }

            if (!query.grade) {
                templateApiErrorsTotal.inc({ reason: 'validation' });
                return reply.code(400).send({
                    error: 'Missing required parameter: grade',
                });
            }

            const grade = parseInt(query.grade, 10);
            if (isNaN(grade) || grade < 1 || grade > 12) {
                templateApiErrorsTotal.inc({ reason: 'validation' });
                return reply.code(400).send({
                    error: 'Invalid grade. Must be between 1 and 12.',
                });
            }

            const subject = query.subject.trim();
            const topic = query.topic?.trim() || undefined;

            // --- Fetch & Rank ---

            try {
                logger.info({
                    event: 'template_api_request',
                    subject,
                    grade,
                    topic: topic || null,
                    workspace_id: request.workspaceId,
                    trace_id: request.id,
                }, 'template_api_request');

                const templates = await fetchRankedTemplates(fastify.db, subject, grade, topic);

                const duration = process.hrtime(startTime);
                const durationMs = duration[0] * 1000 + duration[1] / 1e6;

                templateApiRequestsTotal.inc({ result: 'success' });
                templateApiLatencyMs.observe(durationMs);

                return {
                    templates,
                };
            } catch (err) {
                const duration = process.hrtime(startTime);
                const durationMs = duration[0] * 1000 + duration[1] / 1e6;

                templateApiRequestsTotal.inc({ result: 'error' });
                templateApiLatencyMs.observe(durationMs);
                templateApiErrorsTotal.inc({ reason: 'internal' });

                logger.error({
                    event: 'template_api_error',
                    error: (err as Error).message,
                    trace_id: request.id,
                }, 'template_api_error');

                return reply.code(500).send({
                    error: 'Internal server error',
                });
            }
        });

    }, { prefix: '/w' });

    fastify.log.info('Registered template routes');
}

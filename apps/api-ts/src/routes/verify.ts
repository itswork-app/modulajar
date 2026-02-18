import { FastifyInstance } from 'fastify';
import { RateLimiter } from '../utils/rate-limit';
import { logger } from '../utils/logger';

const limiter = new RateLimiter(60000, 60); // 60 req/min

export default async function verifyRoutes(fastify: FastifyInstance) {
    fastify.get('/:publicId', async (request, reply) => {
        const { publicId } = request.params as { publicId: string };
        const ip = request.ip;

        // 1. Rate Limiting
        if (!limiter.check(ip)) {
            logger.warn({ public_id: publicId, ip, rate_limit_hit: true }, 'Rate limit exceeded');
            return reply.code(429).send({ error: 'Too many requests' });
        }

        // 2. Anti-Enumeration & Validation
        // Public ID format: DOC-XXXX... (at least 10 chars)
        if (!publicId || publicId.length < 10 || !/^[A-Za-z0-9-]+$/.test(publicId)) {
            // Generic 404, don't say "Invalid format"
            return reply.code(404).send({ error: 'Not found' });
        }

        // 3. Strict Query (Status = 'done' and type = 'document')
        // We only check documents table now.
        const start = Date.now();
        const result = await fastify.db.query(
            `SELECT public_id, generated_at, metadata
             FROM documents
             WHERE public_id = $1 AND status = 'done'`,
            [publicId]
        );

        if (result.rowCount === 0) {
            // Log as 'not_found' but don't leak details
            logger.info({ public_id: publicId, status: 'not_found' }, 'Verify lookup failed');
            return reply.code(404).send({ error: 'Not found' });
        }

        const doc = result.rows[0];
        const metadata = doc.metadata || {};
        const aiConfig = metadata.ai_config || {};
        const watermark = metadata.watermark_summary || {};

        // 4. Minimal Response
        // Extract fields safely
        const response = {
            public_id: doc.public_id,
            generated_at: metadata.generated_at || doc.generated_at, // timestamp
            pdf_sha256: metadata.pdf_sha256,
            html_sha256: metadata.html_sha256,
            model: metadata.model || aiConfig.model,
            watermark_summary: {
                teacher_masked: watermark.teacher_masked,
                school_name: watermark.school_name
            }
        };

        // 5. Logging Discipline
        logger.info({
            public_id: publicId,
            status: 'found',
            duration_ms: Date.now() - start
        }, 'Verify lookup success');

        reply.header('Cache-Control', 'public, max-age=60');
        return response;
    });
}

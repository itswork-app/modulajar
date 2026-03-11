import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
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

        // GET /w/:workspaceId/templates - List templates. Includes global and workspace-specific.
        childServer.get('/:workspaceId/templates', {
            schema: {
                tags: ['Templates'],
                description: 'List templates available to this workspace (global and workspace-specific).',
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' }
                    },
                    required: ['workspaceId']
                },
                querystring: {
                    type: 'object',
                    properties: {
                        document_type: { type: 'string', description: 'Filter by document type (e.g. atp, modul_ajar)' }
                    }
                }
            },
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            const { document_type } = request.query as { document_type?: string };

            try {
                let query = `
                    SELECT id, workspace_id, name, description, document_type, template_version, layout_definition, created_at, updated_at
                    FROM document_templates
                    WHERE (workspace_id = $1 OR workspace_id IS NULL)
                `;
                const params: any[] = [workspaceId];

                if (document_type) {
                    params.push(document_type);
                    query += ` AND document_type = $2`;
                }

                query += ` ORDER BY workspace_id NULLS FIRST, name ASC`;

                const res = await fastify.db.query(query, params);
                return reply.send({ templates: res.rows });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({ error: 'Failed to fetch templates' });
            }
        });

        // POST /w/:workspaceId/templates - Create a new workspace template
        childServer.post('/:workspaceId/templates', {
            schema: {
                tags: ['Templates'],
                description: 'Create a new template for the workspace.',
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' }
                    },
                    required: ['workspaceId']
                },
                body: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        document_type: { type: 'string' },
                        layout_definition: {
                            type: 'object',
                            additionalProperties: true,
                            properties: {
                                sections: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            enabled: { type: 'boolean' },
                                            order: { type: 'number' }
                                        },
                                        required: ['id', 'enabled']
                                    }
                                },
                                header: { type: 'string' },
                                footer: { type: 'string' }
                            },
                            required: ['sections']
                        }
                    },
                    required: ['name', 'document_type', 'layout_definition']
                }
            },
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            const body = request.body as any;

            const roleRes = await fastify.db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND clerk_user_id = $2`, [workspaceId, request.auth?.clerk_user_id]);
            const role = roleRes.rows[0]?.role;
            if (!role || !['owner', 'admin'].includes(role)) {
                return reply.status(403).send({ error: 'Requires admin role to create templates' });
            }

            const id = ulid();

            try {
                const res = await fastify.db.query(`
                    INSERT INTO document_templates (id, workspace_id, name, description, document_type, template_version, layout_definition)
                    VALUES ($1, $2, $3, $4, $5, 1, $6)
                    RETURNING *
                `, [id, workspaceId, body.name, body.description || null, body.document_type, body.layout_definition]);

                return reply.status(201).send(res.rows[0]);
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({ error: 'Failed to create template' });
            }
        });

        // PUT /w/:workspaceId/templates/:templateId - Update an existing template
        childServer.put('/:workspaceId/templates/:templateId', {
            schema: {
                tags: ['Templates'],
                description: 'Update an existing workspace template.',
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' },
                        templateId: { type: 'string' }
                    },
                    required: ['workspaceId', 'templateId']
                },
                body: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        layout_definition: { type: 'object', additionalProperties: true }
                    },
                    required: ['name', 'layout_definition']
                }
            },
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId, templateId } = request.params as { workspaceId: string, templateId: string };
            const body = request.body as any;

            const roleRes = await fastify.db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND clerk_user_id = $2`, [workspaceId, request.auth?.clerk_user_id]);
            const role = roleRes.rows[0]?.role;
            if (!role || !['owner', 'admin'].includes(role)) {
                return reply.status(403).send({ error: 'Requires admin role to update templates' });
            }

            try {
                const checkRes = await fastify.db.query(`SELECT id FROM document_templates WHERE id = $1 AND workspace_id = $2`, [templateId, workspaceId]);
                if (checkRes.rowCount === 0) {
                    return reply.status(404).send({ error: 'Template not found or does not belong to this workspace' });
                }

                const res = await fastify.db.query(`
                    UPDATE document_templates
                    SET name = $1, description = $2, layout_definition = $3, template_version = template_version + 1, updated_at = NOW()
                    WHERE id = $4 AND workspace_id = $5
                    RETURNING *
                `, [body.name, body.description || null, body.layout_definition, templateId, workspaceId]);

                return reply.send(res.rows[0]);
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({ error: 'Failed to update template' });
            }
        });

        // POST /w/:workspaceId/templates/default - Set workspace default template
        childServer.post('/:workspaceId/templates/default', {
            schema: {
                tags: ['Templates'],
                description: 'Set the default template for a specific document type.',
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' }
                    },
                    required: ['workspaceId']
                },
                body: {
                    type: 'object',
                    properties: {
                        document_type: { type: 'string' },
                        template_id: { type: 'string' }
                    },
                    required: ['document_type', 'template_id']
                }
            },
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            const { document_type, template_id } = request.body as { document_type: string, template_id: string };

            const roleRes = await fastify.db.query(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND clerk_user_id = $2`, [workspaceId, request.auth?.clerk_user_id]);
            const role = roleRes.rows[0]?.role;
            if (!role || !['owner', 'admin'].includes(role)) {
                return reply.status(403).send({ error: 'Requires admin role to set default templates' });
            }

            try {
                const tCheck = await fastify.db.query(`
                    SELECT id FROM document_templates 
                    WHERE id = $1 AND document_type = $2 AND (workspace_id = $3 OR workspace_id IS NULL)
                `, [template_id, document_type, workspaceId]);

                if (tCheck.rowCount === 0) {
                    return reply.status(400).send({ error: 'Invalid template_id for this document type or workspace' });
                }

                await fastify.db.query(`
                    INSERT INTO workspace_default_templates (workspace_id, document_type, template_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (workspace_id, document_type) 
                    DO UPDATE SET template_id = EXCLUDED.template_id
                `, [workspaceId, document_type, template_id]);

                return reply.send({ success: true, document_type, template_id });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({ error: 'Failed to set default template' });
            }
        });

        childServer.get('/:workspaceId/templates/default', {
            schema: {
                tags: ['Templates'],
                description: 'Get all default templates set for this workspace.',
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' }
                    },
                    required: ['workspaceId']
                }
            },
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            try {
                const res = await fastify.db.query(`
                    SELECT document_type, template_id 
                    FROM workspace_default_templates 
                    WHERE workspace_id = $1
                `, [workspaceId]);
                return reply.send({ defaults: res.rows });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({ error: 'Failed to fetch default templates' });
            }
        });

    }, { prefix: '/w' });

    fastify.log.info('Registered template routes');
}

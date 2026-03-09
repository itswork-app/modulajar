import { FastifyInstance } from 'fastify';
import {
    GenerateModuleRequest,
    GenerateModuleResponse,
    ModuleDetailResponse,
    GenerationMode,
    ModuleEditorResponse,
    ModulePatchRequest,
    ModulePatchResponse,
    ModuleVersion,
    AISuggestRequest,
    AISuggestResponse
} from 'shared-types';
import { createHash } from 'crypto';
import { issuePID } from '../lib/pid';
import { logger } from '../utils/logger';
import { generateRequestsTotal, moduleUpdateTotal, aiAssistTotal } from '../utils/metrics';
import { computeHtmlSha256, renderModuleHtml } from '../services/renderService';
import { ulid } from 'ulid';
import { debit } from '../lib/wallet';
import { validateDocumentModuleJson } from '../services/schemaValidator';

/**
 * Compute ID for deduplication/idempotency.
 */
function computePackageKey(
    workspaceId: string,
    mode: string,
    subject: string,
    grade: number,
    topic: string,
    templateId: string | null
): string {
    const payload = `${workspaceId}:${mode}:${subject}:${grade}:${topic}:${templateId || ''}`;
    return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

export default async function modulesRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // POST /w/:workspaceId/modules/generate
        childServer.post<{ Body: GenerateModuleRequest; Params: { workspaceId: string } }>('/:workspaceId/modules/generate', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' } }
                },
                body: {
                    type: 'object',
                    required: ['mode', 'subject', 'grade'],
                    properties: {
                        mode: { type: 'string', enum: ['wizard', 'quick', 'template', 'edit_template', 'from_scratch'] },
                        subject: { type: 'string' },
                        grade: { type: 'integer', minimum: 1, maximum: 12 },
                        topic: { type: 'string' },
                        template_id: { type: 'string' },
                        semester: { type: 'string' }
                    }
                },
                response: {
                    201: {
                        type: 'object',
                        required: ['job_id', 'module_id', 'status', 'pid'],
                        properties: {
                            job_id: { type: 'string' },
                            module_id: { type: 'string' },
                            status: { type: 'string' },
                            pid: { type: 'string' }
                        }
                    },
                    400: { $ref: 'Error#' },
                    429: { $ref: 'Error#' }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body;
            const { mode, subject, grade, topic, template_id, semester } = body;

            if (!mode || !subject || !grade || (mode !== 'wizard' && !topic)) {
                return reply.code(400).send({ error: 'Missing required fields: mode, subject, grade, topic' });
            }

            const effectiveTopic = topic || subject; // Fallback for wizard mode 


            if (grade < 1 || grade > 12) {
                return reply.code(400).send({ error: 'Invalid grade. Must be between 1 and 12.' });
            }
            if (mode === 'template' || mode === 'edit_template') {
                if (!template_id) {
                    return reply.code(400).send({ error: 'template_id is required for template and edit_template modes' });
                }
            }

            const { ulid } = await import('ulid');

            // 1. Resolve Teacher Context from onboarding (or default)
            const teacherCtx = await fastify.db.query(
                `SELECT full_name, school_name, province, city FROM teachers WHERE workspace_id = $1 LIMIT 1`,
                [workspaceId]
            );

            const teacherName = teacherCtx.rowCount && teacherCtx.rowCount > 0 ? teacherCtx.rows[0].full_name : 'Guru';
            const schoolName = teacherCtx.rowCount && teacherCtx.rowCount > 0 ? teacherCtx.rows[0].school_name : 'Sekolah Dasar';

            // 2. Compute canonical PID and Check idempotency
            const packageKey = computePackageKey(workspaceId, mode, subject, grade, effectiveTopic, template_id);

            // Active job limit
            const activeJobs = await fastify.db.query(
                `SELECT id FROM generation_jobs
                 WHERE workspace_id = $1 AND status IN ('queued', 'running')`,
                [workspaceId]
            );

            if (activeJobs.rowCount && activeJobs.rowCount > 0 && activeJobs.rowCount >= 4) {
                return reply.code(429).send({
                    error: 'Rate Limited',
                    message: 'Max 4 active generation jobs allowed per workspace.'
                });
            }

            const existingPkg = await fastify.db.query(
                `SELECT id, public_id FROM packages WHERE workspace_id = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
                [workspaceId]
            );

            let packageId: string;
            let pid: string;

            // In V2 Wizard, we issue a new Package for each Generation as they are granular topic-based modules.
            packageId = ulid();
            pid = issuePID(process.env.PID_SECRET || 'dev-secret', {
                workspaceId,
                packageUlid: packageId,
                kelas: grade.toString(),
                semester: semester || '1',
                tahunAjaran: new Date().getFullYear().toString() + '/' + (new Date().getFullYear() + 1).toString()
            });

            await fastify.db.query(
                `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [packageId, workspaceId, pid, grade.toString(), semester || '1', '2025/2026', teacherName, schoolName, 'draft']
            );

            const jobId = ulid();
            const traceId = request.id;

            // Worker payload translation for backward-compatible db triggers
            const metadata = {
                job_id: jobId,
                package_id: packageId,
                workspace_id: workspaceId,
                pack_path: 'packs/wizard/' + mode + '/pack.json', // virtual path
                mode: mode,
                template_id: template_id,
                topic: effectiveTopic,
                subject: subject,
                grade: grade,
                semester: semester || '1',
                kelas: grade.toString(),
                tahun_ajaran: '2025/2026',
                teacher_name: teacherName,
                school_name: schoolName,
                pid: pid,
                trace_id: traceId
            };

            const debitRef = `GENERATE:${jobId}`;
            try {
                await debit(fastify.db, workspaceId, 1, debitRef, {
                    event_type: 'GenerationUsageDebit',
                    transaction_type: 'generate_module',
                    note: `${subject} - ${effectiveTopic}`,
                    job_id: jobId
                });
            } catch (err: any) {
                if (err.message === 'Insufficient balance') {
                    return reply.code(402).send({
                        error: 'insufficient_credits',
                        message: 'Saldo kredit tidak cukup. Silakan top up untuk melanjutkan.'
                    });
                }
                generateRequestsTotal.inc({ result: 'failed_wizard_debit' });
                throw err;
            }

            try {
                await fastify.db.query(
                    `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, metadata, next_run_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                    [jobId, workspaceId, packageId, 'queued', packageKey + '-' + Date.now(), JSON.stringify(metadata)]
                );
            } catch (err) {
                generateRequestsTotal.inc({ result: 'failed_wizard' });
                throw err;
            }

            logger.info({ msg: 'Wizard Job enqueued', trace_id: traceId, job_id: jobId, workspace_id: workspaceId });
            generateRequestsTotal.inc({ result: 'success_wizard' });

            const resp: GenerateModuleResponse = {
                job_id: jobId,
                module_id: packageId,  // Pkg acts as module in the API
                status: 'queued',
                pid: pid
            };

            return reply.code(201).send(resp);
        });

        // GET /w/:workspaceId/modules/:moduleId
        childServer.get<{ Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' }, moduleId: { type: 'string' } }
                },
                response: {
                    200: {
                        type: 'object',
                        required: ['module_id', 'status', 'verify'],
                        properties: {
                            module_id: { type: 'string' },
                            subject: { type: 'string' },
                            grade: { type: 'integer' },
                            topic: { type: 'string' },
                            status: { type: 'string' },
                            pdf: {
                                type: ['object', 'null'],
                                required: ['download_url'],
                                properties: {
                                    download_url: { type: 'string' },
                                    sha256: { type: 'string' }
                                }
                            },
                            verify: {
                                type: 'object',
                                required: ['public_id', 'url'],
                                properties: {
                                    public_id: { type: 'string' },
                                    url: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.params.workspaceId;
            const moduleId = request.params.moduleId;

            const pkgResult = await fastify.db.query(
                `SELECT p.id, p.public_id, p.status, p.kelas, p.semester,
                        gj.metadata as job_metadata
                 FROM packages p
                 LEFT JOIN generation_jobs gj ON gj.package_id = p.id
                 WHERE p.id = $1 AND p.workspace_id = $2
                 ORDER BY gj.created_at DESC LIMIT 1`,
                [moduleId, workspaceId]
            );

            if (!pkgResult.rowCount || pkgResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Module not found' });
            }

            const pkg = pkgResult.rows[0];
            const meta = pkg.job_metadata || {};
            const topic = meta.topic || 'Untitled Topic';
            const subject = meta.subject || 'Sesuai Template';

            // Check if PDF receipt exists (Worker writes to job metadata.pdf_receipts or similar)
            let pdfDownloadUrl = null;
            let pdfSha256 = null;

            if (meta.pdf_receipts && Object.keys(meta.pdf_receipts).length > 0) {
                const firstReceipt = Object.values(meta.pdf_receipts)[0] as any;
                if (firstReceipt.pdf_path) {
                    // For safety, generate signed URL if needed, but for now we format it
                    pdfDownloadUrl = firstReceipt.pdf_path;
                    if (pdfDownloadUrl.startsWith('gcs://')) {
                        const path = pdfDownloadUrl.replace('gcs://' + (process.env.GCS_BUCKET || 'modulajar-assets-dev') + '/', '');
                        try {
                            pdfDownloadUrl = await fastify.storage.generateSignedUrl(
                                process.env.GCS_BUCKET || 'modulajar-assets-dev',
                                path
                            );
                        } catch (err) {
                            fastify.log.error(err, 'Failed to generate signed URL');
                            pdfDownloadUrl = null; // Fallback or handle error
                        }
                    }
                    pdfSha256 = firstReceipt.pdf_sha256 || '';
                }
            }

            const response: ModuleDetailResponse = {
                module_id: pkg.id,
                subject: subject,
                grade: parseInt(pkg.kelas) || 4,
                topic: topic,
                status: pkg.status as any,
                pdf: pdfDownloadUrl ? { download_url: pdfDownloadUrl, sha256: pdfSha256 } : null,
                verify: {
                    public_id: pkg.public_id,
                    url: `https://verify.modulajar.app/verify/${pkg.public_id}`
                }
            };

            return reply.send(response);
        });

        // GET /w/:workspaceId/modules/:moduleId/editor
        childServer.get<{ Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId/editor', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' }, moduleId: { type: 'string' } }
                },
                response: {
                    200: {
                        type: 'object',
                        required: ['module_id', 'version', 'module_json', 'html_preview'],
                        properties: {
                            module_id: { type: 'string' },
                            version: { type: 'integer' },
                            module_json: { type: 'object', additionalProperties: true },
                            html_preview: { type: 'string' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const moduleId = request.params.moduleId;

            // 1. Fetch latest version
            const versionResult = await fastify.db.query(
                `SELECT dv.version, dv.module_json, p.kelas, p.semester, p.tahun_ajaran, p.teacher_name, p.school_name, p.public_id,
                        meta.subject, meta.topic
                 FROM document_versions dv
                 JOIN documents d ON d.id = dv.document_id
                 JOIN packages p ON p.id = d.package_id
                 CROSS JOIN LATERAL (SELECT (dv.module_json->>'subject') as subject, (dv.module_json->>'topic') as topic) AS meta
                 WHERE d.id = $1 AND d.workspace_id = $2
                 ORDER BY dv.version DESC LIMIT 1`,
                [moduleId, workspaceId]
            );

            if (!versionResult.rowCount || versionResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Module or version not found' });
            }

            const row = versionResult.rows[0];
            const moduleJson = row.module_json;

            // 2. Render HTML preview
            const html = renderModuleHtml({
                subjectName: row.subject || 'Sesuai Template',
                kelas: row.kelas,
                semester: row.semester,
                tahunAjaran: row.tahun_ajaran,
                teacherName: row.teacher_name,
                schoolName: row.school_name,
                title: moduleJson.title || `Modul Ajar ${row.subject}`,
                pid: row.public_id,
                did: row.public_id, // For now, use PID as DID if they match
                verifyUrl: `https://verify.modulajar.app/verify/${row.public_id}`,
                moduleJson
            });

            const resp: ModuleEditorResponse = {
                module_id: moduleId,
                version: row.version,
                module_json: moduleJson,
                html_preview: html
            };

            return reply.send(resp);
        });

        // PATCH /w/:workspaceId/modules/:moduleId
        childServer.patch<{ Body: ModulePatchRequest, Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' }, moduleId: { type: 'string' } }
                },
                body: {
                    type: 'object',
                    required: ['patch'],
                    properties: {
                        patch: { type: 'object' }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        required: ['version', 'saved'],
                        properties: {
                            version: { type: 'integer' },
                            saved: { type: 'boolean' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const moduleId = request.params.moduleId;
            const { patch } = request.body;

            // Basic validation
            if (!patch || typeof patch !== 'object') {
                moduleUpdateTotal.inc({ result: 'error' });
                return reply.code(400).send({ error: 'Invalid patch format' });
            }

            // 1. Fetch current version
            const current = await fastify.db.query(
                `SELECT dv.version, dv.module_json, d.package_id
                 FROM document_versions dv
                 JOIN documents d ON d.id = dv.document_id
                 WHERE d.id = $1 AND d.workspace_id = $2
                 ORDER BY dv.version DESC LIMIT 1`,
                [moduleId, workspaceId]
            );

            if (!current.rowCount || current.rowCount === 0) {
                return reply.code(404).send({ error: 'Module not found' });
            }

            const currentModule = current.rows[0].module_json;
            const newVersion = current.rows[0].version + 1;

            // 2. Merge patch
            const updatedModule = { ...currentModule, ...patch };

            const validation = validateDocumentModuleJson(updatedModule);
            if (!validation.valid) {
                moduleUpdateTotal.inc({ result: 'error_validation' });
                return reply.code(400).send({
                    error: 'Invalid module_json schema after patch',
                    details: validation.errors
                });
            }

            // 3. Re-render and hash
            const pkgInfo = await fastify.db.query(
                `SELECT kelas, semester, tahun_ajaran, teacher_name, school_name, public_id FROM packages WHERE id = $1`,
                [current.rows[0].package_id]
            );
            const pkg = pkgInfo.rows[0];

            const html = renderModuleHtml({
                subjectName: updatedModule.subject || 'Sesuai Template',
                kelas: pkg.kelas,
                semester: pkg.semester,
                tahunAjaran: pkg.tahun_ajaran,
                teacherName: pkg.teacher_name,
                schoolName: pkg.school_name,
                title: updatedModule.title || `Modul Ajar ${updatedModule.subject}`,
                pid: pkg.public_id,
                did: pkg.public_id,
                verifyUrl: `https://verify.modulajar.app/verify/${pkg.public_id}`,
                moduleJson: updatedModule
            });
            const htmlSha = computeHtmlSha256(html);

            // 4. Save new version
            const newVersionId = ulid();
            await fastify.db.query(
                `INSERT INTO document_versions (id, document_id, version, module_json, html_sha256)
                 VALUES ($1, $2, $3, $4, $5)`,
                [newVersionId, moduleId, newVersion, JSON.stringify(updatedModule), htmlSha]
            );

            // 5. Update current version in documents table
            await fastify.db.query(
                `UPDATE documents SET version = $1 WHERE id = $2`,
                [newVersion, moduleId]
            );

            moduleUpdateTotal.inc({ result: 'success' });
            logger.info({ msg: 'Module version updated', module_id: moduleId, version: newVersion, workspace_id: workspaceId });

            const resp: ModulePatchResponse = {
                version: newVersion,
                saved: true
            };
            return reply.send(resp);
        });

        // GET /w/:workspaceId/modules/:moduleId/preview
        childServer.get<{ Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId/preview', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const moduleId = request.params.moduleId;

            const versionResult = await fastify.db.query(
                `SELECT dv.module_json, p.kelas, p.semester, p.tahun_ajaran, p.teacher_name, p.school_name, p.public_id
                 FROM document_versions dv
                 JOIN documents d ON d.id = dv.document_id
                 JOIN packages p ON p.id = d.package_id
                 WHERE d.id = $1 AND d.workspace_id = $2
                 ORDER BY dv.version DESC LIMIT 1`,
                [moduleId, workspaceId]
            );

            if (!versionResult.rowCount || versionResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Module not found' });
            }

            const row = versionResult.rows[0];
            const html = renderModuleHtml({
                subjectName: row.module_json.subject || 'Sesuai Template',
                kelas: row.kelas,
                semester: row.semester,
                tahunAjaran: row.tahun_ajaran,
                teacherName: row.teacher_name,
                schoolName: row.school_name,
                title: row.module_json.title || `Modul Ajar ${row.module_json.subject}`,
                pid: row.public_id,
                did: row.public_id,
                verifyUrl: `https://verify.modulajar.app/verify/${row.public_id}`,
                moduleJson: row.module_json
            });

            return reply.type('text/html').send(html);
        });

        // GET /w/:workspaceId/modules/:moduleId/versions
        childServer.get<{ Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId/versions', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const moduleId = request.params.moduleId;

            const versions = await fastify.db.query(
                `SELECT version, created_at, created_by 
                 FROM document_versions dv
                 JOIN documents d ON d.id = dv.document_id
                 WHERE d.id = $1 AND d.workspace_id = $2
                 ORDER BY version DESC`,
                [moduleId, workspaceId]
            );

            const resp: ModuleVersion[] = versions.rows.map(r => ({
                version: r.version,
                created_at: r.created_at.toISOString(),
                created_by: r.created_by
            }));

            return reply.send(resp);
        });

        // POST /w/:workspaceId/modules/:moduleId/ai-assist
        childServer.post<{ Body: AISuggestRequest, Params: { workspaceId: string, moduleId: string } }>('/:workspaceId/modules/:moduleId/ai-assist', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' }, moduleId: { type: 'string' } }
                },
                body: {
                    type: 'object',
                    required: ['section', 'action', 'content'],
                    properties: {
                        section: { type: 'string' },
                        action: { type: 'string' },
                        content: { type: 'string' }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        required: ['suggestion'],
                        properties: {
                            suggestion: { type: 'string' },
                            action: { type: 'string' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const moduleId = request.params.moduleId;
            const body = request.body;
            const { section, action, content } = body;

            // Proxy to worker-go (Internal call)
            // Implementation detail: we use the internal hostname for the worker service
            const workerUrl = process.env.WORKER_INTERNAL_URL || 'http://worker-go:8080/tasks/ai-assist';

            try {
                const workerResp = await fetch(workerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: workspaceId,
                        module_id: moduleId,
                        section,
                        action,
                        content
                    })
                });

                if (!workerResp.ok) {
                    aiAssistTotal.inc({ section: body.section, action: body.action, result: 'error' });
                    const errorText = await workerResp.text();
                    logger.error({ msg: 'AI Assist failed in worker', status: workerResp.status, error: errorText });
                    return reply.code(502).send({ error: 'AI Assistant currently unavailable' });
                }

                const data = await workerResp.json();
                aiAssistTotal.inc({ section: body.section, action: body.action, result: 'success' });
                return reply.send(data as AISuggestResponse);
            } catch (err) {
                aiAssistTotal.inc({ section: body.section || 'unknown', action: body.action || 'unknown', result: 'error' });
                logger.error({ msg: 'Failed to contact AI worker', err });
                return reply.code(503).send({ error: 'Service Unavailable' });
            }
        });

    }, { prefix: '/w' });
}

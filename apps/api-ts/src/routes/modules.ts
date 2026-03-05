import { FastifyInstance } from 'fastify';
import { GenerateModuleRequest, GenerateModuleResponse, ModuleDetailResponse, GenerationMode } from 'shared-types';
import { createHash } from 'crypto';
import { issuePID } from '../lib/pid';
import { logger } from '../utils/logger';
import { generateRequestsTotal } from '../utils/metrics';

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
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body;
            const { mode, subject, grade, topic, template_id, semester } = body;

            if (!mode || !subject || !grade || !topic) {
                return reply.code(400).send({ error: 'Missing required fields: mode, subject, grade, topic' });
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
            const packageKey = computePackageKey(workspaceId, mode, subject, grade, topic, template_id);

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
                topic: topic,
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
            preHandler: [fastify.workspaceGuard]
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
                        pdfDownloadUrl = pdfDownloadUrl.replace('gcs://modulajar-assets-dev', 'https://storage.googleapis.com/modulajar-assets-dev');
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

    }, { prefix: '/w' });
}

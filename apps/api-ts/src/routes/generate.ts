import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { issuePID } from '../lib/pid';
import { SD_FULL_SEMESTER_COST } from '../lib/pricing';
import { getBalance, debit } from '../lib/wallet';
import { logger } from '../utils/logger';
import { generateRequestsTotal } from '../utils/metrics';

const PID_SECRET = process.env.PID_SECRET || 'modulajar-pid-dev-secret';

/**
 * Compute idempotency key for a generate request.
 */
function computeIdempotencyKey(
    workspaceId: string,
    packId: string,
    semester: string,
    tahunAjaran: string
): string {
    const payload = `${workspaceId}:${packId}:${semester}:${tahunAjaran}`;
    return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * Compute a package identity key for upsert.
 * Teacher-bound: different teacher = different package.
 */
function computePackageKey(
    workspaceId: string,
    kelas: string,
    semester: string,
    tahunAjaran: string,
    teacherName: string,
    schoolName: string
): string {
    const payload = `${workspaceId}:${kelas}:${semester}:${tahunAjaran}:${teacherName}:${schoolName}`;
    return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

export default async function generateRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        childServer.post('/:workspaceId/internal/generate-semester', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string' }
                    }
                },
                body: {
                    type: 'object',
                    required: ['pack_id', 'semester', 'tahun_ajaran'],
                    properties: {
                        pack_id: { type: 'string' },
                        semester: { type: 'string' },
                        tahun_ajaran: { type: 'string' },
                        kelas: { type: 'string' },
                        teacher_name: { type: 'string' },
                        school_name: { type: 'string' },
                        template_id: { type: 'string' }
                    }
                },
                response: {
                    201: {
                        type: 'object',
                        required: ['job_id', 'package_id', 'pid', 'status'],
                        properties: {
                            job_id: { type: 'string' },
                            package_id: { type: 'string' },
                            pid: { type: 'string' },
                            status: { type: 'string' },
                            cost: { type: 'number' },
                            balance_after: { type: 'number' },
                            trace_id: { type: 'string' }
                        }
                    },
                    200: {
                        type: 'object',
                        required: ['job_id', 'package_id', 'pid', 'status', 'idempotent'],
                        properties: {
                            job_id: { type: 'string' },
                            package_id: { type: 'string' },
                            pid: { type: 'string' },
                            status: { type: 'string' },
                            idempotent: { type: 'boolean' }
                        }
                    },
                    400: { $ref: 'Error#' },
                    402: {
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            balance: { type: 'number' },
                            cost: { type: 'number' },
                            sisa_generate: { type: 'number' },
                            message: { type: 'string' }
                        }
                    },
                    409: { $ref: 'Error#' }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body as {
                pack_id: string;
                semester: string;
                tahun_ajaran: string;
                kelas?: string;
                teacher_name?: string;
                school_name?: string;
                template_id?: string;
            };

            if (!body.pack_id || !body.semester || !body.tahun_ajaran) {
                return reply.code(400).send({
                    error: 'Missing required fields: pack_id, semester, tahun_ajaran'
                });
            }

            const kelas = body.kelas || '4';
            const teacherName = body.teacher_name || '-';
            const schoolName = body.school_name || '-';

            const idempotencyKey = computeIdempotencyKey(
                workspaceId, body.pack_id, body.semester, body.tahun_ajaran
            );

            // 1. Check for existing job (idempotent)
            const existingJob = await fastify.db.query(
                `SELECT gj.id, gj.status, gj.package_id, p.public_id AS pid
                 FROM generation_jobs gj
                 JOIN packages p ON p.id = gj.package_id
                 WHERE gj.generation_id = $1`,
                [idempotencyKey]
            );

            if (existingJob.rowCount && existingJob.rowCount > 0) {
                return reply.code(200).send({
                    job_id: existingJob.rows[0].id,
                    package_id: existingJob.rows[0].package_id,
                    pid: existingJob.rows[0].pid,
                    status: existingJob.rows[0].status,
                    idempotent: true
                });
            }

            // 2. Concurrency guard: max 1 active job per workspace
            const activeJobs = await fastify.db.query(
                `SELECT id FROM generation_jobs
                 WHERE workspace_id = $1 AND status IN ('queued', 'running')`,
                [workspaceId]
            );

            if (activeJobs.rowCount && activeJobs.rowCount > 0) {
                return reply.code(409).send({
                    error: 'Conflict',
                    message: 'An active generation job already exists for this workspace'
                });
            }

            // 3. Check wallet balance (via wallet service)
            const balance = await getBalance(fastify.db, workspaceId);

            if (balance < SD_FULL_SEMESTER_COST) {
                return reply.code(402).send({
                    error: 'Insufficient balance',
                    balance,
                    cost: SD_FULL_SEMESTER_COST,
                    sisa_generate: Math.floor(balance / SD_FULL_SEMESTER_COST)
                });
            }

            const { ulid } = await import('ulid');

            // 4. Resolve or create package (identity-keyed)
            const teacherCtx = await fastify.db.query(
                `SELECT primary_jenjang FROM teachers WHERE workspace_id = $1 LIMIT 1`,
                [workspaceId]
            );
            const primaryJenjang = teacherCtx.rowCount && teacherCtx.rowCount > 0 ? teacherCtx.rows[0].primary_jenjang : null;

            const packageKey = computePackageKey(
                workspaceId, kelas, body.semester, body.tahun_ajaran, teacherName, schoolName
            );

            let packageId: string;
            let pid: string;

            // Look up existing package by identity key (stored in public_id prefix or via lookup)
            const existingPkg = await fastify.db.query(
                `SELECT id, public_id FROM packages
                 WHERE workspace_id = $1 AND kelas = $2 AND semester = $3
                   AND tahun_ajaran = $4 AND teacher_name = $5 AND school_name = $6
                 LIMIT 1`,
                [workspaceId, kelas, body.semester, body.tahun_ajaran, teacherName, schoolName]
            );

            if (existingPkg.rowCount && existingPkg.rowCount > 0) {
                // Reuse existing package + PID
                packageId = existingPkg.rows[0].id;
                pid = existingPkg.rows[0].public_id;
            } else {
                // Create new package with canonical PID
                packageId = ulid();
                pid = issuePID(PID_SECRET, {
                    workspaceId,
                    packageUlid: packageId,
                    kelas,
                    semester: body.semester,
                    tahunAjaran: body.tahun_ajaran
                });

                await fastify.db.query(
                    `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status, jenjang)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [packageId, workspaceId, pid, kelas, body.semester, body.tahun_ajaran, teacherName, schoolName, 'draft', primaryJenjang]
                );
            }

            // 5. Create job (idempotent via UNIQUE generation_id)
            const jobId = ulid();

            // Resolve pack path
            const parts = body.pack_id.split('-');
            const packPath = parts.length >= 3
                ? `packs/${parts[0]}/${parts[1]}/${parts[2]}/pack.json`
                : `packs/${body.pack_id}/pack.json`;

            const traceId = request.id; // From Fastify (UUID)

            const metadata = {
                job_id: jobId,
                package_id: packageId,
                workspace_id: workspaceId,
                pack_path: packPath,
                semester: body.semester,
                kelas: kelas,
                jenjang: primaryJenjang, // Explicit Jenjang!
                tahun_ajaran: body.tahun_ajaran,
                teacher_name: teacherName,
                school_name: schoolName,
                pid: pid,
                trace_id: traceId // Persist Trace ID
            };

            // 6. Debit wallet (idempotent via ON CONFLICT)
            const debitRef = `JOB:${jobId}`;
            try {
                await debit(fastify.db, workspaceId, SD_FULL_SEMESTER_COST, debitRef, {
                    event_type: 'GenerationUsageDebit',
                    transaction_type: 'generate_module',
                    job_id: jobId,
                    package_id: packageId
                });
            } catch (err: any) {
                if (err.message === 'Insufficient balance') {
                    return reply.code(402).send({
                        error: 'insufficient_credits',
                        message: 'Saldo kredit tidak cukup. Silakan top up untuk melanjutkan.'
                    });
                }
                logger.warn({ trace_id: traceId, job_id: jobId, error: err }, 'Debit failed');
                throw err;
            }

            // Resolve template_id
            let templateIdToUse = body.template_id || null;
            if (!templateIdToUse) {
                const defaultsRes = await fastify.db.query(
                    `SELECT template_id FROM workspace_default_templates WHERE workspace_id = $1 AND document_type = 'modul_ajar'`,
                    [workspaceId]
                );
                if (defaultsRes.rowCount && defaultsRes.rowCount > 0) {
                    templateIdToUse = defaultsRes.rows[0].template_id;
                }
            }

            try {
                await fastify.db.query(
                    `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, template_id, metadata, next_run_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    [jobId, workspaceId, packageId, 'queued', idempotencyKey, templateIdToUse, JSON.stringify(metadata)]
                );
            } catch (err) {
                generateRequestsTotal.inc({ result: 'failed_insert' });
                throw err;
            }

            // 7. Enqueue Cloud Task (placeholder)
            logger.info({
                msg: 'Job enqueued',
                trace_id: traceId,
                job_id: jobId,
                package_id: packageId,
                pid,
                workspace_id: workspaceId
            });

            generateRequestsTotal.inc({ result: 'success' });

            return reply.code(201).send({
                job_id: jobId,
                package_id: packageId,
                pid,
                status: 'pending',
                cost: SD_FULL_SEMESTER_COST,
                balance_after: balance - SD_FULL_SEMESTER_COST,
                trace_id: traceId
            });
        });

    }, { prefix: '/w' });
}

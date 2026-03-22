import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { getBalance, debit } from '../lib/wallet';
import { ATP_COST, PROTA_COST, PROMES_COST, BUNDLE_MODUL_COST } from '../lib/pricing';
import { logger } from '../utils/logger';
import { bundleGenerationTotal, bundleFailedTotal } from '../utils/metrics';

const DOC_TYPES = ['atp', 'prota', 'promes', 'modul_ajar'] as const;
type DocType = typeof DOC_TYPES[number];

function docCost(docType: DocType): number {
    switch (docType) {
        case 'atp': return ATP_COST;
        case 'prota': return PROTA_COST;
        case 'promes': return PROMES_COST;
        case 'modul_ajar': return BUNDLE_MODUL_COST;
    }
}

function estimateBundleCost(topicCount: number): number {
    return ATP_COST + PROTA_COST + PROMES_COST + topicCount * BUNDLE_MODUL_COST;
}

export default async function bundleRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        // ────────────────────────────────────────────────────────────
        // POST /w/:workspaceId/bundle
        // Create an administration bundle (ATP + Prota + Promes + N Moduls)
        // ────────────────────────────────────────────────────────────
        childServer.post<{
            Params: { workspaceId: string };
            Body: {
                subject: string;
                kelas: string;
                semester: string;
                tahun_ajaran: string;
                topics: string[];
                teacher_name?: string;
                school_name?: string;
                template_ids?: Record<string, string>;
            };
        }>('/:workspaceId/bundle', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    required: ['subject', 'kelas', 'semester', 'tahun_ajaran', 'topics'],
                    properties: {
                        subject: { type: 'string', minLength: 1 },
                        kelas: { type: 'string' },
                        semester: { type: 'string' },
                        tahun_ajaran: { type: 'string' },
                        topics: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 30 },
                        teacher_name: { type: 'string' },
                        school_name: { type: 'string' },
                        template_ids: {
                            type: 'object',
                            additionalProperties: { type: 'string' }
                        }
                    },
                },
            },
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body;
            const traceId = request.id;

            const teacherName = body.teacher_name?.trim() || '—';
            const schoolName = body.school_name?.trim() || '—';
            const topicCount = body.topics.length;
            const totalCost = estimateBundleCost(topicCount);

            // 1. Check balance
            const balance = await getBalance(fastify.db, workspaceId);
            if (balance < totalCost) {
                return reply.code(402).send({
                    error: 'insufficient_credits',
                    balance,
                    cost: totalCost,
                    message: `Kredit tidak cukup. Butuh ${totalCost} kredit, tersisa ${balance}.`,
                });
            }

            // 2. Debit wallet atomically
            const bundleId = ulid();
            const debitRef = `BUNDLE:${bundleId}`;
            try {
                await debit(fastify.db, workspaceId, totalCost, debitRef, {
                    event_type: 'GenerationUsageDebit',
                    transaction_type: 'administration_bundle',
                    bundle_id: bundleId,
                    subject: body.subject,
                    topic_count: topicCount,
                });
            } catch (err: unknown) {
                if ((err as Error).message === 'Insufficient balance') {
                    return reply.code(402).send({
                        error: 'insufficient_credits',
                        message: 'Saldo kredit tidak cukup.',
                    });
                }
                bundleFailedTotal.inc({ reason: 'debit_failed' });
                throw err;
            }

            // 3. Create bundle row
            await fastify.db.query(
                `INSERT INTO bundles (id, workspace_id, subject, kelas, semester, tahun_ajaran, teacher_name, school_name, topic_count, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
                [bundleId, workspaceId, body.subject, body.kelas, body.semester, body.tahun_ajaran, teacherName, schoolName, topicCount]
            );

            // 4. Resolve or create a shared package for this bundle context
            const packageId = ulid();
            await fastify.db.query(
                `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
                 ON CONFLICT DO NOTHING`,
                [packageId, workspaceId, bundleId, body.kelas, body.semester, body.tahun_ajaran, teacherName, schoolName]
            );

            // Fetch default templates to fallback
            const defaultsRes = await fastify.db.query(
                `SELECT document_type, template_id FROM workspace_default_templates WHERE workspace_id = $1`,
                [workspaceId]
            );
            const defaultTemplates: Record<string, string> = {};
            defaultsRes.rows.forEach(r => defaultTemplates[r.document_type] = r.template_id);

            const userTemplates = body.template_ids || {};

            // 5. Create generation jobs (ATP, Prota, Promes, + 1 per topic)
            const jobs: { id: string; doc_type: DocType; topic?: string; cost: number }[] = [];

            const adminDocs: DocType[] = ['atp', 'prota', 'promes'];
            for (const docType of adminDocs) {
                const jobId = ulid();
                const idempotencyKey = `${bundleId}:${docType}`;
                const metadata = {
                    job_id: jobId,
                    bundle_id: bundleId,
                    package_id: packageId,
                    workspace_id: workspaceId,
                    doc_type: docType,
                    subject: body.subject,
                    kelas: body.kelas,
                    semester: body.semester,
                    tahun_ajaran: body.tahun_ajaran,
                    teacher_name: teacherName,
                    school_name: schoolName,
                    trace_id: traceId,
                };

                const tmplId = userTemplates[docType] || defaultTemplates[docType] || null;

                await fastify.db.query(
                    `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, doc_type, bundle_id, template_id, metadata, next_run_at)
                     VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7, $8, NOW())`,
                    [jobId, workspaceId, packageId, idempotencyKey, docType, bundleId, tmplId, JSON.stringify(metadata)]
                );
                jobs.push({ id: jobId, doc_type: docType, cost: docCost(docType) });
            }

            // Module jobs — one per topic
            for (let i = 0; i < body.topics.length; i++) {
                const topic = body.topics[i];
                const jobId = ulid();
                const idempotencyKey = `${bundleId}:modul_ajar:${i}`;
                const metadata = {
                    job_id: jobId,
                    bundle_id: bundleId,
                    package_id: packageId,
                    workspace_id: workspaceId,
                    doc_type: 'modul_ajar',
                    subject: body.subject,
                    kelas: body.kelas,
                    semester: body.semester,
                    tahun_ajaran: body.tahun_ajaran,
                    teacher_name: teacherName,
                    school_name: schoolName,
                    topic_index: i,
                    topic_title: topic,
                    trace_id: traceId,
                };

                const tmplId = userTemplates['modul_ajar'] || defaultTemplates['modul_ajar'] || null;

                await fastify.db.query(
                    `INSERT INTO generation_jobs (id, workspace_id, package_id, status, generation_id, doc_type, bundle_id, template_id, metadata, next_run_at)
                     VALUES ($1, $2, $3, 'queued', $4, 'modul_ajar', $5, $6, $7, NOW())`,
                    [jobId, workspaceId, packageId, idempotencyKey, bundleId, tmplId, JSON.stringify(metadata)]
                );
                jobs.push({ id: jobId, doc_type: 'modul_ajar', topic, cost: BUNDLE_MODUL_COST });
            }

            bundleGenerationTotal.inc();
            logger.info({
                msg: 'Bundle created',
                bundle_id: bundleId,
                workspace_id: workspaceId,
                topic_count: topicCount,
                total_cost: totalCost,
                trace_id: traceId,
            });

            return reply.code(201).send({
                bundle_id: bundleId,
                estimated_cost: totalCost,
                balance_after: balance - totalCost,
                topic_count: topicCount,
                jobs: jobs.map(j => ({ id: j.id, doc_type: j.doc_type, topic: j.topic || null, cost: j.cost })),
            });
        });

        // ────────────────────────────────────────────────────────────
        // GET /w/:workspaceId/bundle/:bundleId
        // Poll bundle status
        // ────────────────────────────────────────────────────────────
        childServer.get<{
            Params: { workspaceId: string; bundleId: string };
        }>('/:workspaceId/bundle/:bundleId', {
            preHandler: [fastify.workspaceGuard],
        }, async (request, reply) => {
            const { workspaceId, bundleId } = request.params;

            const bundleResult = await fastify.db.query(
                `SELECT id, subject, kelas, semester, tahun_ajaran, teacher_name, school_name, topic_count, status, created_at
                 FROM bundles WHERE id = $1 AND workspace_id = $2`,
                [bundleId, workspaceId]
            );

            if (bundleResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Bundle not found' });
            }

            const bundle = bundleResult.rows[0];

            // Fetch all jobs for this bundle
            const jobsResult = await fastify.db.query(
                `SELECT id, status, doc_type, metadata, created_at
                 FROM generation_jobs
                 WHERE bundle_id = $1
                 ORDER BY created_at ASC`,
                [bundleId]
            );

            const jobs = jobsResult.rows.map(row => ({
                id: row.id,
                status: row.status,
                doc_type: row.doc_type,
                topic_title: (row.metadata as Record<string, unknown>)?.topic_title || null,
                topic_index: (row.metadata as Record<string, unknown>)?.topic_index ?? null,
                created_at: row.created_at,
            }));

            // Derive composite status from jobs
            const allDone = jobs.every(j => j.status === 'done');
            const anyFailed = jobs.some(j => j.status === 'failed');
            const anyRunning = jobs.some(j => j.status === 'running' || j.status === 'queued');

            const derivedStatus = allDone ? 'done' : anyFailed ? 'failed' : anyRunning ? 'running' : 'pending';

            // Update bundle status if changed
            if (derivedStatus !== bundle.status) {
                await fastify.db.query(
                    `UPDATE bundles SET status = $1 WHERE id = $2`,
                    [derivedStatus, bundleId]
                );
            }

            const modulJobs = jobs.filter(j => j.doc_type === 'modul_ajar');
            const modulDone = modulJobs.filter(j => j.status === 'done').length;

            return {
                bundle_id: bundle.id,
                subject: bundle.subject,
                kelas: bundle.kelas,
                semester: bundle.semester,
                tahun_ajaran: bundle.tahun_ajaran,
                teacher_name: bundle.teacher_name,
                school_name: bundle.school_name,
                status: derivedStatus,
                topic_count: bundle.topic_count,
                modul_progress: { done: modulDone, total: modulJobs.length },
                created_at: bundle.created_at,
                jobs,
            };
        });

    }, { prefix: '/w' });
}

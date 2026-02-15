import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';

const SD_FULL_SEMESTER_COST = 5;

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

export default async function generateRoutes(fastify: FastifyInstance) {

    // Reuse workspace guard from workspace.ts pattern
    const workspaceGuard = async (request: any, reply: any) => {
        await fastify.verifyClerk(request, reply);

        const { workspaceId } = request.params as { workspaceId: string };
        const { clerk_user_id } = request.auth || {};

        if (!workspaceId) {
            return reply.code(400).send({ error: 'Missing workspaceId' });
        }

        const result = await fastify.db.query(
            `SELECT 1 FROM workspace_members
             WHERE workspace_id = $1 AND clerk_user_id = $2`,
            [workspaceId, clerk_user_id]
        );

        if (result.rowCount === 0) {
            return reply.code(403).send({ error: 'Forbidden', message: 'Not a member of this workspace' });
        }
    };

    fastify.register(async (childServer) => {

        childServer.post('/:workspaceId/internal/generate-semester', {
            preHandler: [workspaceGuard]
        }, async (request, reply) => {
            const { workspaceId } = request.params as { workspaceId: string };
            const body = request.body as {
                pack_id: string;
                semester: string;
                tahun_ajaran: string;
            };

            if (!body.pack_id || !body.semester || !body.tahun_ajaran) {
                return reply.code(400).send({
                    error: 'Missing required fields: pack_id, semester, tahun_ajaran'
                });
            }

            const idempotencyKey = computeIdempotencyKey(
                workspaceId, body.pack_id, body.semester, body.tahun_ajaran
            );

            // 1. Check for existing job (idempotent)
            const existingJob = await fastify.db.query(
                `SELECT id, status FROM generation_jobs WHERE idempotency_key = $1`,
                [idempotencyKey]
            );

            if (existingJob.rowCount && existingJob.rowCount > 0) {
                return reply.code(200).send({
                    job_id: existingJob.rows[0].id,
                    status: existingJob.rows[0].status,
                    idempotent: true
                });
            }

            // 2. Concurrency guard: max 1 active job per workspace
            const activeJobs = await fastify.db.query(
                `SELECT id FROM generation_jobs
                 WHERE workspace_id = $1 AND status IN ('pending', 'running')`,
                [workspaceId]
            );

            if (activeJobs.rowCount && activeJobs.rowCount > 0) {
                return reply.code(409).send({
                    error: 'Conflict',
                    message: 'An active generation job already exists for this workspace'
                });
            }

            // 3. Check wallet balance
            const balanceResult = await fastify.db.query(
                `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance
                 FROM wallet_ledger WHERE workspace_id = $1`,
                [workspaceId]
            );

            const balance = parseInt(balanceResult.rows[0]?.balance || '0', 10);

            if (balance < SD_FULL_SEMESTER_COST) {
                return reply.code(402).send({
                    error: 'Insufficient balance',
                    balance,
                    cost: SD_FULL_SEMESTER_COST,
                    sisa_generate: Math.floor(balance / SD_FULL_SEMESTER_COST)
                });
            }

            // 4. Create package row first (needed as FK for generation_jobs)
            const { ulid } = await import('ulid');
            const packageId = ulid();
            const publicId = `PKG-${packageId.substring(0, 8)}`;

            await fastify.db.query(
                `INSERT INTO packages (id, workspace_id, public_id, kelas, semester, tahun_ajaran, teacher_name, school_name, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [packageId, workspaceId, publicId, '4', body.semester, body.tahun_ajaran, '-', '-', 'active']
            );

            // 5. Create job (idempotent via UNIQUE idempotency_key)
            const jobId = ulid();

            await fastify.db.query(
                `INSERT INTO generation_jobs (id, workspace_id, package_id, status, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5)`,
                [jobId, workspaceId, packageId, 'pending', idempotencyKey]
            );

            // 6. Debit wallet (idempotent — check reference doesn't exist)
            const debitRef = `JOB:${jobId}`;
            const existingDebit = await fastify.db.query(
                `SELECT id FROM wallet_ledger WHERE reference = $1`,
                [debitRef]
            );

            if (!existingDebit.rowCount || existingDebit.rowCount === 0) {
                const ledgerId = ulid();
                await fastify.db.query(
                    `INSERT INTO wallet_ledger (id, workspace_id, type, amount, reference)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [ledgerId, workspaceId, 'debit', SD_FULL_SEMESTER_COST, debitRef]
                );
            }

            // 7. Enqueue Cloud Task (placeholder — actual Cloud Tasks integration later)
            // In production: use @google-cloud/tasks to enqueue to worker
            // For now, log the task payload
            fastify.log.info({
                msg: 'Task enqueued (placeholder)',
                job_id: jobId,
                pack_id: body.pack_id,
                semester: body.semester
            });

            return reply.code(201).send({
                job_id: jobId,
                status: 'pending',
                cost: SD_FULL_SEMESTER_COST,
                balance_after: balance - SD_FULL_SEMESTER_COST
            });
        });

    }, { prefix: '/w' });
}

import { FastifyInstance } from 'fastify';
import { JobStatusResponse } from 'shared-types';

export default async function jobsRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // GET /w/:workspaceId/jobs/:jobId
        childServer.get<{ Params: { workspaceId: string, jobId: string } }>('/:workspaceId/jobs/:jobId', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const jobId = request.params.jobId;

            const jobResult = await fastify.db.query(
                `SELECT id, package_id, status, error_message, metadata 
                 FROM generation_jobs 
                 WHERE id = $1 AND workspace_id = $2`,
                [jobId, workspaceId]
            );

            if (!jobResult.rowCount || jobResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Job not found' });
            }

            const job = jobResult.rows[0];
            const meta = job.metadata || {};

            // Map Phase from Status
            let phase = 'unknown';
            let pct = 0;

            if (job.status === 'queued') {
                phase = 'queued';
                pct = 5;
            } else if (job.status === 'running') {
                phase = 'generating';
                pct = 50;
            } else if (job.status === 'completed') {
                phase = 'done';
                pct = 100;
            } else if (job.status === 'failed') {
                phase = 'failed';
                pct = 100;
            }

            // Also check documents table for precise rendering status if 'running'
            if (job.status === 'running' && job.package_id) {
                const docsResult = await fastify.db.query(
                    `SELECT status FROM documents WHERE package_id = $1`,
                    [job.package_id]
                );
                if (docsResult.rowCount && docsResult.rowCount > 0) {
                    const docStatus = docsResult.rows[0].status;
                    if (docStatus === 'generating') {
                        phase = 'ai';
                        pct = 40;
                    } else if (docStatus === 'ready' || docStatus === 'done') {
                        phase = 'pdf';
                        pct = 80;
                    }
                }
            }

            // Explicitly cast the statuses to match the JobStatusResponse interface
            const responseStatus: 'queued' | 'running' | 'done' | 'failed' =
                job.status === 'completed' ? 'done' :
                    job.status === 'queued' ? 'queued' :
                        job.status === 'failed' ? 'failed' : 'running';

            const response: JobStatusResponse = {
                job_id: job.id,
                module_id: job.package_id,
                pid: meta.pid || '',
                status: responseStatus,
                progress: { phase, pct },
                error: job.error_message || null
            };

            return reply.send(response);
        });

    }, { prefix: '/w' });
}

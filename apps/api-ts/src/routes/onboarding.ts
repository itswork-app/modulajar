import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';
import {
    onboardingStartedTotal,
    onboardingCompletedTotal,
} from '../utils/metrics';

export default async function onboardingRoutes(fastify: FastifyInstance) {

    fastify.register(async (childServer) => {

        // ═══════════════════════════════════════
        // POST /onboarding/profile
        // ═══════════════════════════════════════
        childServer.post('/:workspaceId/onboarding/profile', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body as {
                full_name?: string;
                nip?: string;
                school_name?: string;
                province?: string;
                city?: string;
            };

            if (!body.full_name || body.full_name.trim() === '') {
                return reply.code(400).send({ error: 'full_name is required' });
            }

            const fullName = body.full_name.trim();
            const nip = body.nip?.trim() || null;
            const schoolName = body.school_name?.trim() || null;
            const province = body.province?.trim() || null;
            const city = body.city?.trim() || null;

            // Upsert teacher profile (one teacher per workspace)
            const { ulid } = await import('ulid');

            await fastify.db.query(
                `INSERT INTO teachers (id, workspace_id, full_name, nip, school_name, province, city, primary_subject, primary_grade)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'Matematika', 4)
                 ON CONFLICT (workspace_id)
                 DO UPDATE SET full_name = $3, nip = $4, school_name = $5, province = $6, city = $7, updated_at = NOW()`,
                [ulid(), workspaceId, fullName, nip, schoolName, province, city]
            );

            onboardingStartedTotal.inc();

            logger.info({
                event: 'onboarding_profile_saved',
                workspace_id: workspaceId,
                trace_id: request.id,
            }, 'onboarding_profile_saved');

            return { success: true, step: 'profile' };
        });

        // ═══════════════════════════════════════
        // POST /onboarding/assignment
        // ═══════════════════════════════════════
        childServer.post('/:workspaceId/onboarding/assignment', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body as {
                subject?: string;
                grade?: number;
            };

            if (!body.subject || body.subject.trim() === '') {
                return reply.code(400).send({ error: 'subject is required' });
            }

            const grade = Number(body.grade);
            if (!body.grade || isNaN(grade) || grade < 1 || grade > 12) {
                return reply.code(400).send({ error: 'grade must be between 1 and 12' });
            }

            const subject = body.subject.trim();

            // Look up teacher for this workspace
            const teacherResult = await fastify.db.query(
                'SELECT id FROM teachers WHERE workspace_id = $1',
                [workspaceId]
            );

            if (teacherResult.rowCount === 0) {
                return reply.code(400).send({ error: 'Teacher profile must be created first' });
            }

            const teacherId = teacherResult.rows[0].id;
            const { ulid } = await import('ulid');

            // Upsert assignment
            await fastify.db.query(
                `INSERT INTO teaching_assignments (id, teacher_id, subject, grade)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [ulid(), teacherId, subject, grade]
            );

            // Update teacher primary fields + mark onboarding completed
            await fastify.db.query(
                `UPDATE teachers SET primary_subject = $1, primary_grade = $2, onboarding_completed = TRUE, updated_at = NOW()
                 WHERE id = $3 AND workspace_id = $4`,
                [subject, grade, teacherId, workspaceId]
            );

            onboardingCompletedTotal.inc();

            logger.info({
                event: 'onboarding_completed',
                teacher: teacherId,
                subject,
                grade,
                workspace_id: workspaceId,
                trace_id: request.id,
            }, 'onboarding_completed');

            return { success: true, step: 'assignment', completed: true };
        });

        // ═══════════════════════════════════════
        // GET /onboarding/status
        // ═══════════════════════════════════════
        childServer.get('/:workspaceId/onboarding/status', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, _reply) => {
            const workspaceId = request.workspaceId;

            const result = await fastify.db.query(
                'SELECT onboarding_completed FROM teachers WHERE workspace_id = $1',
                [workspaceId]
            );

            if (result.rowCount === 0) {
                return { completed: false, has_profile: false };
            }

            return {
                completed: result.rows[0].onboarding_completed === true,
                has_profile: true,
            };
        });

    }, { prefix: '/w' });

    fastify.log.info('Registered onboarding routes');
}

import { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { SD_FULL_SEMESTER_COST, idrToCredits, getDefaultTier } from '../lib/pricing';

/**
 * Generate a unique external reference for a receipt.
 * Format: RCPT-{random hex 16 chars}
 */
function generateExternalRef(): string {
    return `RCPT-${randomBytes(8).toString('hex').toUpperCase()}`;
}

export default async function billingRoutes(fastify: FastifyInstance) {

    // ═══════════════════════════════════════════
    // Workspace-scoped routes
    // ═══════════════════════════════════════════
    fastify.register(async (childServer) => {

        // ── POST /w/:workspaceId/internal/topup-intent ──
        childServer.post('/:workspaceId/internal/topup-intent', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const body = request.body as {
                amount_idr?: number;
                product?: string;
            };

            // Resolve pricing tier
            let credits: number;
            let amountIdr: number;

            if (body.amount_idr) {
                const tier = idrToCredits(body.amount_idr);
                if (!tier) {
                    return reply.code(400).send({
                        error: 'Invalid amount',
                        message: `No pricing tier for IDR ${body.amount_idr}`,
                        available_tiers: [{ product: 'sd_semester', amount_idr: 59000, credits: 20 }]
                    });
                }
                credits = tier.credits;
                amountIdr = tier.amountIdr;
            } else {
                // Default to SD semester
                const tier = getDefaultTier();
                credits = tier.credits;
                amountIdr = tier.amountIdr;
            }

            const { ulid } = await import('ulid');
            const receiptId = ulid();
            const externalRef = generateExternalRef();

            await fastify.db.query(
                `INSERT INTO receipts (id, workspace_id, external_ref, amount, status)
                 VALUES ($1, $2, $3, $4, $5)`,
                [receiptId, workspaceId, externalRef, credits, 'pending']
            );

            return reply.code(201).send({
                receipt_id: receiptId,
                external_ref: externalRef,
                amount_idr: amountIdr,
                credits,
                status: 'pending'
            });
        });

        // ── GET /w/:workspaceId/billing/summary ──
        childServer.get('/:workspaceId/billing/summary', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;

            // Derived balance
            const balanceResult = await fastify.db.query(
                `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance
                 FROM wallet_ledger WHERE workspace_id = $1`,
                [workspaceId]
            );
            const balance = parseInt(balanceResult.rows[0]?.balance || '0', 10);

            // Recent receipts
            const receiptsResult = await fastify.db.query(
                `SELECT id, external_ref, amount, status, created_at
                 FROM receipts WHERE workspace_id = $1
                 ORDER BY created_at DESC LIMIT 10`,
                [workspaceId]
            );

            return reply.code(200).send({
                balance_credits: balance,
                sisa_generate: Math.floor(balance / SD_FULL_SEMESTER_COST),
                cost_per_generate: SD_FULL_SEMESTER_COST,
                last_receipts: receiptsResult.rows
            });
        });

    }, { prefix: '/w' });

    // ═══════════════════════════════════════════
    // Webhook routes (not workspace-scoped)
    // ═══════════════════════════════════════════
    fastify.register(async (childServer) => {

        // ── POST /internal/webhooks/payment/confirm ──
        childServer.post('/webhooks/payment/confirm', async (request, reply) => {
            const body = request.body as {
                external_ref: string;
                paid_amount?: number;
                status: 'confirmed' | 'rejected';
            };

            if (!body.external_ref || !body.status) {
                return reply.code(400).send({ error: 'Missing external_ref or status' });
            }

            if (body.status !== 'confirmed' && body.status !== 'rejected') {
                return reply.code(400).send({ error: 'Invalid status. Must be confirmed or rejected.' });
            }

            // 1. Find receipt by external_ref
            const receiptResult = await fastify.db.query(
                `SELECT id, workspace_id, amount, status FROM receipts WHERE external_ref = $1`,
                [body.external_ref]
            );

            if (!receiptResult.rowCount || receiptResult.rowCount === 0) {
                return reply.code(404).send({ error: 'Receipt not found' });
            }

            const receipt = receiptResult.rows[0];

            // 2. Idempotency: already processed?
            if (receipt.status === body.status) {
                return reply.code(200).send({
                    receipt_id: receipt.id,
                    status: receipt.status,
                    idempotent: true
                });
            }

            // 3. Don't allow transition from confirmed/rejected back
            if (receipt.status !== 'pending') {
                return reply.code(409).send({
                    error: 'Conflict',
                    message: `Receipt already ${receipt.status}, cannot change to ${body.status}`
                });
            }

            // 4. Update receipt status
            await fastify.db.query(
                `UPDATE receipts SET status = $1 WHERE id = $2`,
                [body.status, receipt.id]
            );

            // 5. If confirmed, post wallet credit (idempotent via reference)
            if (body.status === 'confirmed') {
                const creditRef = `RCPT:${receipt.id}`;

                const existingCredit = await fastify.db.query(
                    `SELECT id FROM wallet_ledger WHERE reference = $1`,
                    [creditRef]
                );

                if (!existingCredit.rowCount || existingCredit.rowCount === 0) {
                    const { ulid } = await import('ulid');
                    const ledgerId = ulid();

                    await fastify.db.query(
                        `INSERT INTO wallet_ledger (id, workspace_id, type, amount, reference)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [ledgerId, receipt.workspace_id, 'credit', receipt.amount, creditRef]
                    );
                }

                return reply.code(200).send({
                    receipt_id: receipt.id,
                    status: 'confirmed',
                    credits_posted: receipt.amount
                });
            }

            // 6. Rejected — no credit posted
            return reply.code(200).send({
                receipt_id: receipt.id,
                status: 'rejected',
                credits_posted: 0
            });
        });

    }, { prefix: '/internal' });
}

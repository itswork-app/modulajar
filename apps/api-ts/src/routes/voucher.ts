import { FastifyInstance } from 'fastify';
import { voucherService } from '../lib/voucher';
import { credit } from '../lib/wallet';
import { logger } from '../utils/logger';

export default async function voucherRoutes(fastify: FastifyInstance) {

    // ── POST /w/:workspaceId/voucher/redeem ──
    fastify.post('/w/:workspaceId/voucher/redeem', {
        preHandler: [fastify.workspaceGuard],
        schema: {
            params: {
                type: 'object',
                properties: { workspaceId: { type: 'string' } },
                required: ['workspaceId']
            },
            body: {
                type: 'object',
                properties: {
                    code: { type: 'string' }
                },
                required: ['code']
            }
        }
    }, async (request, reply) => {
        const workspaceId = request.workspaceId;
        const { code } = request.body as { code: string };

        try {
            // 1. Redeem Voucher (Atomic)
            const credits = await voucherService.redeem(fastify.db, code, workspaceId);

            const { ulid } = await import('ulid');
            const receiptId = ulid();

            // 2. Create Receipt
            await fastify.db.query(
                `INSERT INTO receipts (id, workspace_id, external_ref, amount, status, payment_method)
                 VALUES ($1, $2, $3, $4, 'confirmed', 'voucher')`,
                [receiptId, workspaceId, `VOUCHER:${code}`, credits]
            );

            // 3. Ledger Credit
            const creditResult = await credit(fastify.db, workspaceId, credits, code, {
                event_type: 'VoucherRedeem',
                voucher_code: code,
                receipt_id: receiptId
            });

            // 4. Update Receipt with Ledger ID
            if (creditResult.ledgerId) {
                await fastify.db.query(
                    `UPDATE receipts SET ledger_id = $1 WHERE id = $2`,
                    [creditResult.ledgerId, receiptId]
                );
            }

            return {
                success: true,
                credits_redeemed: credits,
                receipt_id: receiptId
            };
        } catch (err: any) {
            logger.error({ err, code, workspaceId }, 'Voucher redemption failed');
            return reply.code(400).send({
                error: 'Redemption failed',
                message: err.message || 'Unknown error'
            });
        }
    });

    // ── POST /admin/vouchers/generate ──
    // Note: This is an internal/admin endpoint.
    fastify.post('/admin/vouchers/generate', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    count: { type: 'integer', minimum: 1, maximum: 100 },
                    credits: { type: 'integer', minimum: 1 },
                    expires_in_days: { type: 'integer', minimum: 1 }
                },
                required: ['count', 'credits']
            }
        }
    }, async (request, reply) => {
        const { count, credits, expires_in_days } = request.body as {
            count: number;
            credits: number;
            expires_in_days?: number;
        };

        const generated = [];
        const expiresAt = expires_in_days
            ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
            : null;

        for (let i = 0; i < count; i++) {
            const code = voucherService.generateCode();
            await fastify.db.query(
                `INSERT INTO voucher_codes (code, credits, status, expires_at)
                 VALUES ($1, $2, 'active', $3)`,
                [code, credits, expiresAt]
            );
            generated.push({ code, credits, expires_at: expiresAt });
        }

        return {
            success: true,
            count: generated.length,
            vouchers: generated
        };
    });
}

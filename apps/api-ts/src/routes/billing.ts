import { FastifyInstance } from 'fastify';
import { createHash, randomBytes, createHmac } from 'crypto';
import { SD_FULL_SEMESTER_COST, idrToCredits, getDefaultTier } from '../lib/pricing';
import { getBalance, credit } from '../lib/wallet';
import { xendit } from '../lib/xendit';
import { constantTimeCompare } from '../utils/crypto';
import { logger } from '../utils/logger';

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
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' } }
                },
                body: {
                    type: 'object',
                    properties: {
                        amount_idr: { type: 'integer' },
                        product: { type: 'string' }
                    }
                },
                response: {
                    201: {
                        type: 'object',
                        properties: {
                            receipt_id: { type: 'string' },
                            external_ref: { type: 'string' },
                            amount_idr: { type: 'number' },
                            credits: { type: 'number' },
                            status: { type: 'string' }
                        }
                    },
                    400: { $ref: 'Error#' }
                }
            }
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

        // PR-C16: Xendit Top-Up Intent
        childServer.post('/:workspaceId/billing/topup-intent', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        amount_idr: { type: 'integer', minimum: 10000 }
                    },
                    required: ['amount_idr']
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;
            const { amount_idr } = request.body as { amount_idr: number };

            const tier = idrToCredits(amount_idr);
            if (!tier) {
                return reply.code(400).send({
                    error: 'Invalid amount',
                    message: `No pricing tier for IDR ${amount_idr}`
                });
            }

            const { ulid } = await import('ulid');
            const receiptId = ulid();
            const externalRef = generateExternalRef();

            // 1. Create Invoice in Xendit
            // Use clerk user email if available, otherwise fallback
            const userEmail = (request.auth as any)?.email;

            let invoice;
            try {
                invoice = await xendit.createInvoice({
                    externalId: externalRef,
                    amount: amount_idr,
                    payerEmail: userEmail,
                    description: `Top-up ${tier.credits} Token - ModulAjar`
                });
            } catch (err) {
                logger.error(err, 'Failed to create Xendit invoice');
                return reply.code(502).send({ error: 'Payment gateway error' });
            }

            // 2. Create Receipt
            await fastify.db.query(
                `INSERT INTO receipts (id, workspace_id, external_ref, amount, status, payment_method)
                 VALUES ($1, $2, $3, $4, 'pending', 'xendit')`,
                [receiptId, workspaceId, externalRef, tier.credits]
            );

            return {
                payment_url: invoice.invoice_url,
                intent_id: invoice.id,
                amount: amount_idr,
                credits_estimated: tier.credits
            };
        });

        // ── GET /w/:workspaceId/billing/summary ──
        childServer.get('/:workspaceId/billing/summary', {
            preHandler: [fastify.workspaceGuard],
            schema: {
                params: {
                    type: 'object',
                    properties: { workspaceId: { type: 'string' } }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            balance_credits: { type: 'number' },
                            sisa_generate: { type: 'number' },
                            cost_per_generate: { type: 'number' },
                            last_receipts: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        external_ref: { type: 'string' },
                                        amount: { type: 'number' },
                                        status: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;

            // Derived balance (via wallet service)
            const balance = await getBalance(fastify.db, workspaceId);

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
            const paymentSecret = process.env.PAYMENT_WEBHOOK_SECRET;
            if (!paymentSecret) {
                logger.error('PAYMENT_WEBHOOK_SECRET not configured');
                return reply.code(500).send({ error: 'Server misconfiguration' });
            }

            // 1. Signature Verification
            const signature = request.headers['x-callback-signature'] as string;
            if (!signature) {
                logger.warn('Missing callback signature');
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const rawBody = (request as any).rawBody as Buffer;
            if (!rawBody) {
                logger.error('Raw body missing');
                return reply.code(500).send({ error: 'Internal server error' });
            }

            const hmac = createHmac('sha256', paymentSecret);
            hmac.update(rawBody);
            const computedSignature = hmac.digest('hex');

            if (!constantTimeCompare(signature, computedSignature)) {
                logger.warn({ signature, computedSignature }, 'Invalid callback signature');
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            // Parse body safely (already done by parser, but good to be explicit about type)
            const body = request.body as {
                id: string; // Provider Event ID
                event: string; // e.g. 'payment.succeeded'
                external_ref: string;
                paid_amount?: number;
                status: 'confirmed' | 'rejected';
            };

            // 2. Strict Event Validation
            // We only care about payment success events
            // Adjust based on actual provider event names. Assuming 'payment.succeeded' or similar.
            // For this implementation, we check the 'event' field or fallback to 'status' logic.
            // Requirement: "Valid event types: payment.succeeded ... If event type other -> return 200 but ignore"

            // If the provider uses a specific event type field:
            if (body.event && body.event !== 'payment.succeeded') {
                logger.info({ event: body.event }, 'Ignoring non-payment event');
                return reply.code(200).send({ status: 'ignored' });
            }

            // 3. Replay Protection
            // We use provider's event ID (body.id)
            if (!body.id) {
                logger.warn('Missing provider event ID');
                return reply.code(400).send({ error: 'Missing event ID' });
            }

            const { ulid } = await import('ulid');
            const eventId = ulid();
            const payloadHash = createHash('sha256').update(rawBody).digest('hex');

            try {
                await fastify.db.query(
                    `INSERT INTO payment_events (id, provider_event_id, payload_hash, status, received_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [eventId, body.id, payloadHash, 'processing']
                );
            } catch (err: any) {
                if (err.code === '23505') { // Unique violation on provider_event_id
                    logger.info({ provider_event_id: body.id }, 'Duplicate webhook event (replay)');
                    return reply.code(200).send({ status: 'idempotent_replay' });
                }
                throw err;
            }

            // 4. Business Logic
            if (!body.external_ref) {
                await fastify.db.query(`UPDATE payment_events SET status = 'failed' WHERE id = $1`, [eventId]);
                logger.warn({ event_id: body.id }, 'Webhook missing external_ref');
                return reply.code(200).send({ status: 'failed_malformed' });
            }

            const receiptResult = await fastify.db.query(
                `SELECT id, workspace_id, amount, status FROM receipts WHERE external_ref = $1`,
                [body.external_ref]
            );

            if (!receiptResult.rowCount || receiptResult.rowCount === 0) {
                await fastify.db.query(`UPDATE payment_events SET status = 'failed_no_receipt' WHERE id = $1`, [eventId]);
                logger.warn({ event_id: body.id, external_ref: body.external_ref }, 'Webhook receipt not found');
                return reply.code(200).send({ status: 'failed_unknown_ref' });
            }

            const receipt = receiptResult.rows[0];

            // 5. Idempotency Check (Receipt Level)
            if (receipt.status === body.status) {
                await fastify.db.query(`UPDATE payment_events SET status = 'processed' WHERE id = $1`, [eventId]);
                return reply.code(200).send({
                    receipt_id: receipt.id,
                    status: receipt.status,
                    idempotent: true
                });
            }

            // 6. Status Update
            await fastify.db.query(
                `UPDATE receipts SET status = $1 WHERE id = $2`,
                [body.status, receipt.id]
            );

            // 7. Ledger Credit
            if (body.status === 'confirmed') {
                const creditRef = `RCPT:${receipt.id}`; // idempotency key for ledger
                // We use provider_event_id as reference_id per requirement?
                // Requirement: "wallet.credit(workspace_id, reference_id=provider_event_id, type='payment')"
                // Wait, if we use provider_event_id, it matches the webhook event.
                // But the receipt logic used `RCPT:id`.
                // If the user wants `provider_event_id` as the reference, that's stricter.
                // Let's use `provider_event_id` as requested for the ledger reference.

                await credit(fastify.db, receipt.workspace_id as string, receipt.amount as number, body.id, {
                    event_type: 'TopupConfirmed',
                    receipt_id: receipt.id
                });

                await fastify.db.query(`UPDATE payment_events SET status = 'processed' WHERE id = $1`, [eventId]);

                logger.info({
                    event_id: body.id,
                    verified: true,
                    amount: receipt.amount
                }, 'Payment processed');

                return reply.code(200).send({
                    receipt_id: receipt.id,
                    status: 'confirmed',
                    credits_posted: receipt.amount
                });
            }

            await fastify.db.query(`UPDATE payment_events SET status = 'processed' WHERE id = $1`, [eventId]);

            return reply.code(200).send({
                receipt_id: receipt.id,
                status: 'rejected',
                credits_posted: 0
            });
        });

        // PR-C16: Xendit Webhook
        childServer.post('/webhooks/xendit', async (request, reply) => {
            const token = request.headers['x-callback-token'] as string;

            if (!xendit.verifyCallback(token)) {
                logger.warn('Invalid Xendit callback token');
                return reply.code(401).send({ error: 'Unauthorized' });
            }

            const body = request.body as any;
            const xenditId = body.id;
            const externalRef = body.external_id;
            const status = body.status; // 'PAID' or 'SETTLED' are success

            if (status !== 'PAID' && status !== 'SETTLED') {
                logger.info({ xenditId, status }, 'Ignoring non-paid Xendit event');
                return reply.code(200).send({ status: 'ignored' });
            }

            // Replay Protection
            const { ulid } = await import('ulid');
            const eventId = ulid();
            const payloadHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');

            try {
                await fastify.db.query(
                    `INSERT INTO payment_events (id, provider_event_id, payload_hash, status, received_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [eventId, xenditId, payloadHash, 'processing']
                );
            } catch (err: any) {
                if (err.code === '23505') {
                    return reply.code(200).send({ status: 'idempotent_replay' });
                }
                throw err;
            }

            // Business Logic
            const receiptResult = await fastify.db.query(
                `SELECT id, workspace_id, amount, status FROM receipts WHERE external_ref = $1`,
                [externalRef]
            );

            if (!receiptResult.rowCount) {
                await fastify.db.query(`UPDATE payment_events SET status = 'failed_no_receipt' WHERE id = $1`, [eventId]);
                return reply.code(200).send({ status: 'failed_unknown_ref' });
            }

            const receipt = receiptResult.rows[0];

            if (receipt.status === 'confirmed') {
                await fastify.db.query(`UPDATE payment_events SET status = 'processed' WHERE id = $1`, [eventId]);
                return { status: 'already_processed', receipt_id: receipt.id };
            }

            // Start processing confirmed payment
            const dbClient = await fastify.db.connect();
            try {
                await dbClient.query('BEGIN');

                // 1. Update Receipt
                await dbClient.query(
                    `UPDATE receipts SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
                    [receipt.id]
                );

                // 2. Ledger Credit
                const creditResult = await credit(dbClient, receipt.workspace_id as string, receipt.amount as number, xenditId, {
                    event_type: 'TopupConfirmed',
                    receipt_id: receipt.id,
                    provider: 'xendit'
                });

                // 3. Update Receipt with Ledger ID
                if (creditResult.ledgerId) {
                    await dbClient.query(
                        `UPDATE receipts SET ledger_id = $1 WHERE id = $2`,
                        [creditResult.ledgerId, receipt.id]
                    );
                }

                // 4. Update Event Status
                await dbClient.query(`UPDATE payment_events SET status = 'processed' WHERE id = $1`, [eventId]);

                await dbClient.query('COMMIT');

                logger.info({ xenditId, workspaceId: receipt.workspace_id }, 'Xendit payment confirmed and credited');
            } catch (err) {
                await dbClient.query('ROLLBACK');
                logger.error(err, 'Failed to process Xendit payment confirmation');
                throw err;
            } finally {
                dbClient.release();
            }

            return { status: 'success', receipt_id: receipt.id };
        });

    }, { prefix: '/internal' });
}

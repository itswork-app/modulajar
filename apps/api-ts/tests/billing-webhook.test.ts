import tap from 'tap';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import schemasPlugin from '../src/plugins/schemas';
import { xendit } from '../src/lib/xendit';

// Mock Xendit client directly
xendit.createInvoice = async () => ({ invoice_url: 'http://fake-xendit.com/123', id: 'fake_x' }) as any;
xendit.verifyCallback = (token: string) => token === process.env.XENDIT_CALLBACK_TOKEN;

import billingRoutes from '../src/routes/billing';
const test = tap.test;

test('Billing Webhook Hardening', async (t) => {
    const PAYMENT_SECRET = 'test-secret-123';
    process.env.PAYMENT_WEBHOOK_SECRET = PAYMENT_SECRET;

    function buildApp() {
        const receipts: Record<string, any> = {};
        const events: Record<string, any> = {};
        const ledger: Array<any> = [];

        const fastify = Fastify();
        fastify.register(schemasPlugin);

        // Replicate rawBody parser from index.ts
        fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
            (req as any).rawBody = body;
            try {
                const json = JSON.parse(body.toString());
                done(null, json);
            } catch (err) {
                (err as any).statusCode = 400;
                done(err as Error, undefined);
            }
        });

        // Mock workspaceGuard (required by billingRoutes preHandler)
        fastify.decorate('workspaceGuard', async (_req: FastifyRequest, _reply: FastifyReply) => { });
        fastify.decorateRequest('workspaceId', '');

        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                // Insert/Find Payment Event (Replay Check)
                if (sql.includes('INSERT INTO payment_events')) {
                    // VALUES ($1, $2, $3, $4, NOW())
                    // id, provider_event_id, payload_hash, status
                    const [id, providerId, hash, status] = values;
                    if (Object.values(events).find((e: any) => e.provider_event_id === providerId)) {
                        const err = new Error('Constraint violation');
                        (err as any).code = '23505'; // Postgres unique violation
                        throw err;
                    }
                    events[id] = { id, provider_event_id: providerId, payload_hash: hash, status };
                    return { rowCount: 1, rows: [] };
                }

                if (sql.includes('UPDATE payment_events')) {
                    const [status, id] = values; // or params
                    // The query uses WHERE id = $1
                    // Actually the params order depends on the query in billing.ts:
                    // UPDATE payment_events SET status = 'processed' WHERE id = eventId 
                    // -> status=$1, id=$2 (Wait: query in code is `UPDATE ... SET status = 'val' WHERE id = $1`)
                    // No, code says: `UPDATE payment_events SET status = 'processed' WHERE id = $1`
                    // So values is [eventId]? No, status is hardcoded in query string?
                    // Code: `await fastify.db.query(\`UPDATE payment_events SET status = 'processed' WHERE id = $1\`, [eventId]);`
                    // Ah, status is hardcoded in the SQL string in the route handler for success/fail.
                    // But for failed it is: `SET status = 'failed' WHERE id = $1`

                    // Let's strictly check SQL or just mock success
                    if (events[values[0]]) {
                        events[values[0]].status = 'updated'; // Mock update
                    }
                    return { rowCount: 1, rows: [] };
                }

                // Receipts (read-only for webhook mostly, except status update)
                if (sql.includes('SELECT id, workspace_id, amount, status') && sql.includes('FROM receipts')) {
                    const [extRef] = values;
                    const found = Object.values(receipts).find((r: any) => r.external_ref === extRef);
                    if (found) return { rowCount: 1, rows: [found] };
                    return { rowCount: 0, rows: [] };
                }

                if (sql.includes('UPDATE receipts SET status')) {
                    let status: string;
                    let id: string;

                    if (sql.includes("status = 'confirmed'") || sql.includes("status = 'rejected'")) {
                        status = sql.includes("status = 'confirmed'") ? 'confirmed' : 'rejected';
                        id = values[0];
                    } else {
                        status = values[0];
                        id = values[1];
                    }

                    if (receipts[id]) {
                        receipts[id].status = status;
                        return { rowCount: 1, rows: [receipts[id]] };
                    }
                    return { rowCount: 0, rows: [] };
                }

                if (sql.includes('UPDATE receipts SET ledger_id')) {
                    const [ledgerId, id] = values;
                    if (receipts[id]) receipts[id].ledger_id = ledgerId;
                    return { rowCount: 1, rows: [] };
                }

                if (sql.includes('SELECT id FROM pricing_plans')) {
                    return { rowCount: 1, rows: [{ id: 'plan_inst' }] };
                }

                // Ledger (Credit)
                // INSERT INTO wallet_ledger
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    let id, wid, type, amount, ref;
                    if (sql.includes("'credit'") || sql.includes("'debit'")) {
                        type = sql.includes("'credit'") ? 'credit' : 'debit';
                        [id, wid, amount, ref] = values;
                    } else {
                        [id, wid, type, amount, ref] = values;
                    }

                    // Mock conflict if exists
                    const exists = ledger.find(l => l.workspace_id === wid && l.reference_id === ref && l.type === type);
                    if (exists) return { rowCount: 0, rows: [] };

                    ledger.push({ id, workspace_id: wid, amount, reference_id: ref, type });
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => {
                return {
                    query: async (sql: string, values: any[]) => {
                        return (fastify as any).db.query(sql, values);
                    },
                    release: () => { }
                };
            }
        } as any);

        fastify.register(billingRoutes);

        return { fastify, receipts, events, ledger };
    }

    // Helper to sign payload
    function sign(payload: any): string {
        const hmac = createHmac('sha256', PAYMENT_SECRET);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

    // Test 1: Valid Signature + Success
    await t.test('Valid signature -> Success', async (t) => {
        const { fastify, receipts, ledger } = buildApp();

        // Seed receipt
        receipts['rcpt_1'] = {
            id: 'rcpt_1',
            workspace_id: 'ws_1',
            external_ref: 'RCPT-123',
            amount: 20,
            status: 'pending'
        };

        const payload = {
            id: 'evt_001',
            event: 'payment.succeeded',
            external_ref: 'RCPT-123',
            status: 'confirmed'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: {
                'x-callback-signature': sign(payload)
            },
            payload
        });

        t.equal(res.statusCode, 200, res.body);
        t.equal(JSON.parse(res.body).status, 'confirmed');

        // Check ledger
        t.equal(ledger.length, 1);
        t.equal(ledger[0].reference_id, 'evt_001'); // used event ID as ref

        await fastify.close();
    });

    // Test 2: Invalid Signature
    await t.test('Invalid signature -> 401', async (t) => {
        const { fastify } = buildApp();

        const payload = { foo: 'bar' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: {
                'x-callback-signature': 'wrong_signature'
            },
            payload
        });

        t.equal(res.statusCode, 401);
        t.match(JSON.parse(res.body).error, 'Unauthorized');

        await fastify.close();
    });

    // Test 3: Replay (Same Event ID)
    await t.test('Replay event -> 200 Idempotent', async (t) => {
        const { fastify, receipts, events, ledger } = buildApp();

        // Seed receipt
        receipts['rcpt_1'] = {
            id: 'rcpt_1',
            workspace_id: 'ws_1',
            external_ref: 'RCPT-123',
            amount: 20,
            status: 'pending'
        };

        const payload = {
            id: 'evt_reuse',
            event: 'payment.succeeded',
            external_ref: 'RCPT-123',
            status: 'confirmed'
        };
        const signature = sign(payload);

        // First call
        await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': signature },
            payload
        });

        t.equal(ledger.length, 1, 'First call credits');

        // Second call
        const res2 = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': signature },
            payload
        });

        t.equal(res2.statusCode, 200);
        t.equal(JSON.parse(res2.body).status, 'idempotent_replay');
        t.equal(ledger.length, 1, 'Second call does NOT credit');

        await fastify.close();
    });

    // Test 4: Invalid Event Type
    await t.test('Invalid event type -> 200 Ignored', async (t) => {
        const { fastify } = buildApp();

        const payload = {
            id: 'evt_ignore',
            event: 'invoice.created', // Wrong event
            external_ref: 'RCPT-123',
            status: 'confirmed'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(JSON.parse(res.body).status, 'ignored');

        await fastify.close();
    });

    // Test 5: Missing external_ref -> 200 failed_malformed
    await t.test('Missing external_ref -> 200 failed_malformed', async (t) => {
        const { fastify } = buildApp();

        const payload = {
            id: 'evt_no_ref',
            event: 'payment.succeeded',
            // external_ref missing
            status: 'confirmed'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(JSON.parse(res.body).status, 'failed_malformed');

        await fastify.close();
    });

    // Test 6: Unknown Receipt -> 200 failed_unknown_ref
    await t.test('Unknown Receipt -> 200 failed_unknown_ref', async (t) => {
        const { fastify } = buildApp();

        const payload = {
            id: 'evt_bad_ref',
            event: 'payment.succeeded',
            external_ref: 'RCPT-UNKNOWN-999',
            status: 'confirmed'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(JSON.parse(res.body).status, 'failed_unknown_ref');

        await fastify.close();
    });

    // ═══════════════════════════════════════════
    // Xendit Webhook (PR-C16)
    // ═══════════════════════════════════════════
    await t.test('Xendit Callback: Success (PAID)', async (t) => {
        const XENDIT_TOKEN = 'xendit-test-token';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify, receipts, ledger } = buildApp();
        await fastify.ready();

        receipts['rcpt_xendit_1'] = {
            id: 'rcpt_xendit_1',
            workspace_id: 'ws_x_1',
            external_ref: 'X-REF-123',
            amount: 50,
            status: 'pending'
        };

        const payload = {
            id: 'x_evt_001',
            external_id: 'X-REF-123',
            status: 'PAID'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'success');
        t.equal(receipts['rcpt_xendit_1'].status, 'confirmed');
        t.equal(ledger.length, 1);
        t.equal(ledger[0].reference_id, 'x_evt_001');

        await fastify.close();
    });

    await t.test('Xendit Callback: Replay Protection', async (t) => {
        const XENDIT_TOKEN = 'x_replay';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify, receipts, ledger } = buildApp();
        await fastify.ready();

        receipts['rcpt_1'] = { id: 'rcpt_1', external_ref: 'REF_REPLAY', amount: 10, status: 'pending' };
        const payload = { id: 'evt_replay', external_id: 'REF_REPLAY', status: 'PAID' };

        // 1. Success
        await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        // 2. Replay
        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'idempotent_replay');
        t.equal(ledger.length, 1);

        await fastify.close();
    });

    await t.test('Xendit Callback: Unknown Receipt', async (t) => {
        const XENDIT_TOKEN = 'x_unknown';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify } = buildApp();
        await fastify.ready();

        const payload = { id: 'x_evt_999', external_id: 'UNKNOWN_REF', status: 'PAID' };
        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'failed_unknown_ref');

        await fastify.close();
    });

    await t.test('Xendit Callback: Already Processed (Idempotent)', async (t) => {
        const XENDIT_TOKEN = 'x_already';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify, receipts, events } = buildApp();
        await fastify.ready();

        receipts['rcpt_already'] = { id: 'rcpt_already', external_ref: 'REF_DONE', amount: 10, status: 'confirmed' };

        // This time, the event is NEW but the receipt is already confirmed
        const payload = { id: 'evt_new_but_rcpt_done', external_id: 'REF_DONE', status: 'PAID' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'already_processed');

        await fastify.close();
    });

    await t.test('Xendit Callback: Invalid Token', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': 'wrong' },
            payload: {}
        });

        t.equal(res.statusCode, 401);
        await fastify.close();
    });

    await t.test('Xendit Callback: Ignore non-paid', async (t) => {
        const XENDIT_TOKEN = 'x_ignore';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload: { status: 'PENDING' }
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'ignored');
        await fastify.close();
    });

    await t.test('Standard Webhook: Database Error (Line 295)', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        // Force error on event insert
        const originalQuery = (fastify as any).db.query;
        (fastify as any).db.query = async (sql: string, params: any[]) => {
            if (sql.includes('INSERT INTO payment_events')) {
                throw new Error('Unexpected DB Error');
            }
            return originalQuery(sql, params);
        };

        const payload = { id: 'evt_err', event: 'payment.succeeded', external_ref: 'REF-1', status: 'confirmed' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(res.statusCode, 500);

        await fastify.close();
    });

    await t.test('Xendit Webhook: Database Error (Event Insert - Line 407)', async (t) => {
        const XENDIT_TOKEN = 'x_err_1';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify } = buildApp();
        await fastify.ready();

        const originalQuery = (fastify as any).db.query;
        (fastify as any).db.query = async (sql: string, params: any[]) => {
            if (sql.includes('INSERT INTO payment_events')) {
                throw new Error('Xendit Event Insert Error');
            }
            return originalQuery(sql, params);
        };

        const payload = { id: 'x_evt_err', external_id: 'REF_X', status: 'PAID' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 500);

        await fastify.close();
    });

    await t.test('Xendit Webhook: Transaction Rollback (Line 461)', async (t) => {
        const XENDIT_TOKEN = 'x_rollback';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify, receipts } = buildApp();
        await fastify.ready();

        receipts['rcpt_rb'] = { id: 'rcpt_rb', external_ref: 'REF_RB', amount: 10, status: 'pending' };

        const originalQuery = (fastify as any).db.query;
        (fastify as any).db.query = async (sql: string, params: any[]) => {
            if (sql.includes('UPDATE receipts SET status')) {
                throw new Error('Rollback Trigger');
            }
            return originalQuery(sql, params);
        };

        const payload = { id: 'x_evt_rb', external_id: 'REF_RB', status: 'PAID' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 500);

        // Verify it's still pending
        t.equal(receipts['rcpt_rb'].status, 'pending');

        await fastify.close();
    });

    await t.test('Standard Webhook: Missing Secret (Line 226)', async (t) => {
        const { fastify } = buildApp();
        const oldSecret = process.env.PAYMENT_WEBHOOK_SECRET;
        delete process.env.PAYMENT_WEBHOOK_SECRET;
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            payload: {}
        });
        t.equal(res.statusCode, 500);
        t.match(res.json().error, 'Server misconfiguration');

        process.env.PAYMENT_WEBHOOK_SECRET = oldSecret;
        await fastify.close();
    });

    await t.test('Standard Webhook: Missing ID (Line 276)', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        const payload = { event: 'payment.succeeded' }; // missing id
        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('Standard Webhook: Rejected Status (Line 364)', async (t) => {
        const { fastify, receipts } = buildApp();
        await fastify.ready();
        receipts['rcpt_rej'] = { id: 'rcpt_rej', external_ref: 'REF_REJ', amount: 10, status: 'pending' };

        const payload = { id: 'evt_rej', event: 'payment.succeeded', external_ref: 'REF_REJ', status: 'rejected' };
        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });
        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'rejected');
        t.equal(receipts['rcpt_rej'].status, 'rejected');
        await fastify.close();
    });

    await t.test('Callback: Receipt-level Idempotency', async (t) => {
        const { fastify, receipts } = buildApp();
        await fastify.ready();

        receipts['rcpt_1'] = { id: 'rcpt_1', external_ref: 'REF_1', amount: 10, status: 'confirmed' };

        const payload = {
            id: 'evt_new',
            event: 'payment.succeeded',
            external_ref: 'REF_1',
            status: 'confirmed'
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(JSON.parse(res.body).idempotent, true);

        await fastify.close();
    });

    await t.test('Xendit Callback: Receipt-level Idempotency', async (t) => {
        const XENDIT_TOKEN = 'x_idem';
        process.env.XENDIT_CALLBACK_TOKEN = XENDIT_TOKEN;
        const { fastify, receipts } = buildApp();
        await fastify.ready();

        receipts['rcpt_x'] = { id: 'rcpt_x', external_ref: 'REF_X', amount: 10, status: 'confirmed' };

        const payload = { id: 'x_evt_new', external_id: 'REF_X', status: 'PAID' };

        const res = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/xendit',
            headers: { 'x-callback-token': XENDIT_TOKEN },
            payload
        });

        t.equal(res.statusCode, 200);
        t.equal(res.json().status, 'already_processed');

        await fastify.close();
    });
});

test('Billing Workspace Routes', async (t) => {
    function buildApp() {
        // Mock Xendit directly inside buildApp to ensure it's picked up by the router
        xendit.createInvoice = async () => ({ invoice_url: 'http://fake-xendit.com/123', id: 'fake_x' }) as any;
        xendit.verifyCallback = (token: string) => token === process.env.XENDIT_CALLBACK_TOKEN;

        const receipts: Record<string, any> = {};
        const fastify = Fastify();
        fastify.register(schemasPlugin);
        fastify.decorate('workspaceGuard', async (req: any) => { req.workspaceId = 'ws_1'; });
        fastify.decorateRequest('workspaceId', '');
        fastify.decorate('db', {
            query: async (sql: string, params: any[]) => {
                if (sql.includes('INSERT INTO receipts')) {
                    const [id, wid, ref, amount] = params;
                    // status is hardcoded as 'pending' in the SQL
                    receipts[id] = { id, workspace_id: wid, external_ref: ref, amount, status: 'pending', created_at: new Date().toISOString() };
                    return { rowCount: 1, rows: [] };
                }
                if (sql.includes('SELECT id, external_ref')) {
                    return { rowCount: Object.values(receipts).length, rows: Object.values(receipts) };
                }
                if (sql.includes('SELECT COALESCE(SUM')) {
                    return { rowCount: 1, rows: [{ balance: '100' }] };
                }
                return { rows: [], rowCount: 0 };
            }
        } as any);
        fastify.register(billingRoutes);
        return { fastify, receipts };
    }

    await t.test('Topup Intent: Default Tier', async (t) => {
        const { fastify, receipts } = buildApp();
        const res = await fastify.inject({
            method: 'POST',
            url: '/w/ws_1/internal/topup-intent',
            payload: {} // Trigger default tier
        });
        t.equal(res.statusCode, 201);
        t.ok(Object.values(receipts).length > 0);
        await fastify.close();
    });

    await t.test('Topup Intent: Invalid Amount', async (t) => {
        const { fastify } = buildApp();
        const res = await fastify.inject({
            method: 'POST',
            url: '/w/ws_1/internal/topup-intent',
            payload: { amount_idr: 999 } // Invalid tier
        });
        t.equal(res.statusCode, 400);
        await fastify.close();
    });

    await t.test('Billing Summary', async (t) => {
        const { fastify } = buildApp();
        const res = await fastify.inject({
            method: 'GET',
            url: '/w/ws_1/billing/summary'
        });
        t.equal(res.statusCode, 200);
        t.equal(res.json().balance_credits, 100);
        await fastify.close();
    });

    await t.test('Xendit Topup Intent', async (t) => {
        const { fastify, receipts } = buildApp();
        const res = await fastify.inject({
            method: 'POST',
            url: '/w/ws_1/billing/topup-intent',
            payload: { amount_idr: 59000 }
        });
        t.equal(res.statusCode, 200);
        t.ok(res.json().payment_url);
        t.ok(Object.values(receipts).some((r: any) => r.amount === 20), 'should have created a pending receipt');
        await fastify.close();
    });
});

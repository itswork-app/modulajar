import tap from 'tap';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import billingRoutes from '../src/routes/billing';
import { createHmac } from 'crypto';

const test = tap.test;

test('Billing Webhook Hardening', async (t) => {
    const PAYMENT_SECRET = 'test-secret-123';
    process.env.PAYMENT_WEBHOOK_SECRET = PAYMENT_SECRET;

    function buildApp() {
        const receipts: Record<string, any> = {};
        const events: Record<string, any> = {};
        const ledger: Array<any> = [];

        const fastify = Fastify();

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
                if (sql.includes('SELECT id, workspace_id, amount, status FROM receipts')) {
                    const [extRef] = values;
                    const found = Object.values(receipts).find((r: any) => r.external_ref === extRef);
                    if (found) return { rowCount: 1, rows: [found] };
                    return { rowCount: 0, rows: [] };
                }

                if (sql.includes('UPDATE receipts SET status')) {
                    // $1=status, $2=id
                    const [status, id] = values;
                    if (receipts[id]) receipts[id].status = status;
                    return { rowCount: 1, rows: [] };
                }

                // Ledger (Credit)
                // INSERT INTO wallet_ledger
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    // id, wid, amount, ref
                    const [id, wid, amount, ref] = values;
                    // Mock conflict if exists
                    const exists = ledger.find(l => l.workspace_id === wid && l.reference_id === ref && l.type === 'credit');
                    if (exists) return { rowCount: 0, rows: [] };

                    ledger.push({ id, workspace_id: wid, amount, reference_id: ref, type: 'credit' });
                    return { rowCount: 1, rows: [] };
                }

                return { rows: [], rowCount: 0 };
            },
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
});

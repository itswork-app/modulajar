import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import billingRoutes from '../src/routes/billing';
import { SD_FULL_SEMESTER_COST, idrToCredits, getDefaultTier } from '../src/lib/pricing';
import { createHmac } from 'crypto';

const test = tap.test;

// ═══════════════════════════════════════════
// PRICING TABLE UNIT TESTS
// ═══════════════════════════════════════════

test('Pricing Table', async (t) => {
    await t.test('SD semester tier: 59000 IDR = 20 credits', async (t) => {
        const tier = idrToCredits(59000);
        t.ok(tier, 'tier should exist');
        t.equal(tier!.credits, 20);
        t.equal(tier!.product, 'sd_semester');
    });

    await t.test('Unknown amount returns null', async (t) => {
        const tier = idrToCredits(12345);
        t.equal(tier, null);
    });

    await t.test('Default tier is sd_semester', async (t) => {
        const tier = getDefaultTier();
        t.equal(tier.product, 'sd_semester');
        t.equal(tier.amountIdr, 59000);
        t.equal(tier.credits, 20);
    });

    await t.test('SD_FULL_SEMESTER_COST is 5', async (t) => {
        t.equal(SD_FULL_SEMESTER_COST, 5);
    });
});

// ═══════════════════════════════════════════
// BILLING API TESTS
// ═══════════════════════════════════════════

test('Billing API', async (t) => {
    const WORKSPACE_ID = 'ws_billing_001';
    const USER_ID = 'user_1';
    const PAYMENT_SECRET = 'test-secret-123';
    process.env.PAYMENT_WEBHOOK_SECRET = PAYMENT_SECRET;

    function sign(payload: any): string {
        const hmac = createHmac('sha256', PAYMENT_SECRET);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

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
        fastify.decorate('db', {
            query: async (sql: string, values: any[]) => {
                // Workspace membership
                if (sql.includes('SELECT 1 FROM workspace_members')) {
                    const [wid, uid] = values || [];
                    if (wid === WORKSPACE_ID && uid === USER_ID) return { rowCount: 1, rows: [] };
                    return { rowCount: 0, rows: [] };
                }

                // Insert receipt
                if (sql.includes('INSERT INTO receipts')) {
                    const [id, wid, extRef, amount, status] = values;
                    receipts[id] = { id, workspace_id: wid, external_ref: extRef, amount, status, created_at: new Date().toISOString() };
                    return { rowCount: 1, rows: [] };
                }

                // Find receipt by external_ref
                if (sql.includes('SELECT id, workspace_id, amount, status FROM receipts WHERE external_ref')) {
                    const [extRef] = values;
                    const found = Object.values(receipts).find((r: any) => r.external_ref === extRef);
                    if (found) return { rowCount: 1, rows: [found] };
                    return { rowCount: 0, rows: [] };
                }

                // Update receipt status
                if (sql.includes('UPDATE receipts SET status')) {
                    const [status, id] = values;
                    if (receipts[id]) receipts[id].status = status;
                    return { rowCount: 1, rows: [] };
                }

                // Insert payment event (replay protection)
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

                // Update payment event
                if (sql.includes('UPDATE payment_events')) {
                    const [status, id] = values;
                    // Mock update
                    return { rowCount: 1, rows: [] };
                }

                // Check existing credit in ledger (wallet service idempotency check)
                if (sql.includes('SELECT id FROM wallet_ledger') && sql.includes('reference_id')) {
                    const [wid, ref] = values;
                    const found = ledger.find(l => l.reference_id === ref && l.workspace_id === wid);
                    return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
                }

                // Insert ledger (wallet service — ON CONFLICT DO NOTHING)
                if (sql.includes('INSERT INTO wallet_ledger') && sql.includes('ON CONFLICT')) {
                    const [id, wid, amount, ref] = values;
                    const type = sql.includes("'credit'") ? 'credit' : 'debit';
                    const dup = ledger.find(l => l.workspace_id === wid && l.reference_id === ref && l.type === type);
                    if (dup) return { rowCount: 0, rows: [] };
                    ledger.push({ id, workspace_id: wid, type, amount, reference_id: ref });
                    return { rowCount: 1, rows: [] };
                }

                // Balance
                if (sql.includes('SELECT COALESCE(SUM')) {
                    const [wid] = values;
                    const balance = ledger
                        .filter(l => l.workspace_id === wid)
                        .reduce((s, l) => s + (l.type === 'credit' ? l.amount : -l.amount), 0);
                    return { rowCount: 1, rows: [{ balance: String(balance) }] };
                }

                // Recent receipts
                if (sql.includes('SELECT id, external_ref, amount, status, created_at') && sql.includes('FROM receipts')) {
                    const [wid] = values;
                    const wsReceipts = Object.values(receipts).filter((r: any) => r.workspace_id === wid);
                    return { rowCount: wsReceipts.length, rows: wsReceipts };
                }

                return { rows: [], rowCount: 0 };
            },
            connect: async () => ({ query: async () => ({ rowCount: 1, rows: [] }), release: () => { } } as any),
            totalCount: 0, idleCount: 0, waitingCount: 0, end: async () => { },
        } as any);

        fastify.register(mockAuthPlugin);
        fastify.register(workspaceGuardPlugin);
        fastify.register(billingRoutes);
        return { fastify, receipts, ledger };
    }

    // Test 1: Create topup intent
    await t.test('Create topup intent → pending receipt', async (t) => {
        const { fastify } = buildApp();
        await fastify.ready();

        const res = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/topup-intent`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { amount_idr: 59000 }
        });

        t.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
        const body = res.json();
        t.ok(body.receipt_id, 'has receipt_id');
        t.ok(body.external_ref, 'has external_ref');
        t.equal(body.status, 'pending');
        t.equal(body.credits, 20);
        t.equal(body.amount_idr, 59000);

        await fastify.close();
    });

    // Test 2: Confirm once → receipt confirmed + wallet credited
    await t.test('Confirm → receipt confirmed, wallet credited once', async (t) => {
        const { fastify, ledger } = buildApp();
        await fastify.ready();

        // Create intent
        const intentRes = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/topup-intent`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { amount_idr: 59000 }
        });
        const intent = intentRes.json();

        // Confirm
        const payload = {
            id: 'evt_confirm_1',
            event: 'payment.succeeded',
            external_ref: intent.external_ref,
            status: 'confirmed'
        };
        const confirmRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(confirmRes.statusCode, 200, `Expected 200, got ${confirmRes.statusCode}: ${confirmRes.body}`);
        const confirmBody = confirmRes.json();
        t.equal(confirmBody.status, 'confirmed');
        t.equal(confirmBody.credits_posted, 20);

        // Verify ledger has exactly 1 credit entry
        // NOTE: The new logic uses provider_event_id ('evt_confirm_1') as reference_id, NOT 'RCPT:...'
        const creditEntries = ledger.filter(l => l.reference_id === 'evt_confirm_1');
        t.equal(creditEntries.length, 1, 'Should have exactly 1 credit entry');

        await fastify.close();
    });

    // Test 3: Confirm retry → no double credit (idempotent)
    await t.test('Confirm retry → no double credit (idempotent)', async (t) => {
        const { fastify, ledger } = buildApp();
        await fastify.ready();

        // Create intent
        const intentRes = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/topup-intent`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { amount_idr: 59000 }
        });
        const intent = intentRes.json();

        const payload = {
            id: 'evt_retry_1',
            event: 'payment.succeeded',
            external_ref: intent.external_ref,
            status: 'confirmed'
        };
        const signature = sign(payload);

        // Confirm first time
        await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': signature },
            payload
        });

        const creditsBefore = ledger.filter(l => l.reference_id === 'evt_retry_1').length;

        // Confirm retry
        const retryRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': signature },
            payload
        });

        t.equal(retryRes.statusCode, 200);
        // This returns "idempotent_replay" because of payment_events table
        t.equal(retryRes.json().status, 'idempotent_replay');

        const creditsAfter = ledger.filter(l => l.reference_id === 'evt_retry_1').length;
        t.equal(creditsBefore, creditsAfter, 'No double credit on retry');

        await fastify.close();
    });

    // Test 4: Reject → no credit posted
    await t.test('Reject → no credit posted', async (t) => {
        const { fastify, ledger } = buildApp();
        await fastify.ready();

        // Create intent
        const intentRes = await fastify.inject({
            method: 'POST',
            url: `/w/${WORKSPACE_ID}/internal/topup-intent`,
            headers: { Authorization: `Bearer ${USER_ID}` },
            payload: { amount_idr: 59000 }
        });
        const intent = intentRes.json();

        // Reject
        const payload = {
            id: 'evt_reject_1',
            event: 'payment.succeeded',
            external_ref: intent.external_ref,
            status: 'rejected'
        };

        const rejectRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            headers: { 'x-callback-signature': sign(payload) },
            payload
        });

        t.equal(rejectRes.statusCode, 200);
        t.equal(rejectRes.json().status, 'rejected');
        t.equal(rejectRes.json().credits_posted, 0);

        // Verify no credit entry
        const creditEntries = ledger.filter(l => l.reference_id === 'evt_reject_1');
        t.equal(creditEntries.length, 0, 'No credit for rejected receipt');

        await fastify.close();
    });

    // Test 5: Billing summary computes correct balance
    await t.test('Summary returns correct balance & sisa_generate', async (t) => {
        const { fastify, ledger } = buildApp();
        await fastify.ready();

        // Seed some credit
        ledger.push({ id: 'seed1', workspace_id: WORKSPACE_ID, type: 'credit', amount: 20, reference: 'SEED' });

        const res = await fastify.inject({
            method: 'GET',
            url: `/w/${WORKSPACE_ID}/billing/summary`,
            headers: { Authorization: `Bearer ${USER_ID}` }
        });

        t.equal(res.statusCode, 200);
        const body = res.json();
        t.equal(body.balance_credits, 20);
        t.equal(body.sisa_generate, 4); // 20 / 5 = 4
        t.equal(body.cost_per_generate, SD_FULL_SEMESTER_COST);

        await fastify.close();
    });

    t.teardown(() => { });
});

import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import billingRoutes from '../src/routes/billing';
import { SD_FULL_SEMESTER_COST, idrToCredits, getDefaultTier } from '../src/lib/pricing';

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

    function buildApp() {
        const receipts: Record<string, any> = {};
        const ledger: Array<any> = [];

        const fastify = Fastify();

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

                // Check existing credit in ledger
                if (sql.includes('SELECT id FROM wallet_ledger WHERE reference')) {
                    const [ref] = values;
                    const found = ledger.find(l => l.reference === ref);
                    return { rowCount: found ? 1 : 0, rows: found ? [found] : [] };
                }

                // Insert ledger
                if (sql.includes('INSERT INTO wallet_ledger')) {
                    const [id, wid, type, amount, ref] = values;
                    ledger.push({ id, workspace_id: wid, type, amount, reference: ref });
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
        const confirmRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            payload: { external_ref: intent.external_ref, status: 'confirmed' }
        });

        t.equal(confirmRes.statusCode, 200, `Expected 200, got ${confirmRes.statusCode}: ${confirmRes.body}`);
        const confirmBody = confirmRes.json();
        t.equal(confirmBody.status, 'confirmed');
        t.equal(confirmBody.credits_posted, 20);

        // Verify ledger has exactly 1 credit entry
        const creditEntries = ledger.filter(l => l.reference === `RCPT:${intent.receipt_id}`);
        t.equal(creditEntries.length, 1, 'Should have exactly 1 credit entry');

        await fastify.close();
    });

    // Test 3: Confirm retry → no double credit
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

        // Confirm first time
        await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            payload: { external_ref: intent.external_ref, status: 'confirmed' }
        });

        const creditsBefore = ledger.filter(l => l.reference === `RCPT:${intent.receipt_id}`).length;

        // Confirm retry
        const retryRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            payload: { external_ref: intent.external_ref, status: 'confirmed' }
        });

        t.equal(retryRes.statusCode, 200);
        t.equal(retryRes.json().idempotent, true);

        const creditsAfter = ledger.filter(l => l.reference === `RCPT:${intent.receipt_id}`).length;
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
        const rejectRes = await fastify.inject({
            method: 'POST',
            url: '/internal/webhooks/payment/confirm',
            payload: { external_ref: intent.external_ref, status: 'rejected' }
        });

        t.equal(rejectRes.statusCode, 200);
        t.equal(rejectRes.json().status, 'rejected');
        t.equal(rejectRes.json().credits_posted, 0);

        // Verify no credit entry
        const creditEntries = ledger.filter(l => l.reference === `RCPT:${intent.receipt_id}`);
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

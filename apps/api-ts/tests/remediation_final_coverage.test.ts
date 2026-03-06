import tap from 'tap';
import Fastify from 'fastify';
import mockAuthPlugin from '../src/plugins/mock_auth';
import workspaceGuardPlugin from '../src/plugins/workspace-guard';
import letterheadRoutes from '../src/routes/letterhead';
import billingRoutes from '../src/routes/billing';
import multipart from '@fastify/multipart';
import { credit, debit, getBalance } from '../src/lib/wallet';

const test = tap.test;
const WS_ID = 'ws_final';
const U_ID = 'user_final';

// Helper for multipart
function buildMultipart(boundary: string, fields: Record<string, string>, file?: { name: string, filename: string, content: Buffer, type: string }) {
    let chunks: Buffer[] = [];
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }
    if (file) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`));
        chunks.push(file.content);
        chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return Buffer.concat(chunks);
}

function buildApp(dbMock: any) {
    const fastify = Fastify();
    (fastify as any).decorate('db', dbMock);
    (fastify as any).decorate('storage', {
        generateSignedUrl: async () => 'https://signed'
    });
    (fastify as any).decorate('workspaceGuard', (request: any, reply: any, done: any) => {
        request.workspaceId = request.params.workspaceId;
        done();
    });
    fastify.register(mockAuthPlugin);
    fastify.register(multipart);
    fastify.register(letterheadRoutes);
    fastify.register(billingRoutes);
    return fastify;
}

test('Final Coverage Remediation — Branch Focus', async (t) => {

    await t.test('Letterhead Edge Cases', async (t) => {
        // Mock DB for 404
        const db404 = {
            query: async (sql: string) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                return { rowCount: 0, rows: [] };
            }
        };
        const app = buildApp(db404);
        await app.ready();

        const resGet = await app.inject({
            method: 'GET',
            url: `/w/${WS_ID}/letterhead`,
            headers: { Authorization: `Bearer ${U_ID}` }
        });
        t.equal(resGet.statusCode, 404, 'GET 404');

        const resClear = await app.inject({
            method: 'POST',
            url: `/w/${WS_ID}/letterhead/clear-logo`,
            headers: { Authorization: `Bearer ${U_ID}` }
        });
        t.equal(resClear.statusCode, 404, 'Clear 404');

        // Multipart Validation Errors
        const boundary = '---B1';

        // 1. Invalid Mimetype
        const body1 = buildMultipart(boundary, {}, { name: 'logo', filename: 't.txt', content: Buffer.from('x'), type: 'text/plain' });
        const res1 = await app.inject({
            method: 'POST',
            url: `/w/${WS_ID}/letterhead`,
            headers: { Authorization: `Bearer ${U_ID}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body1
        });
        t.equal(res1.statusCode, 400, 'Invalid type');

        // 2. Size Limit (> 512KB)
        const bigBuffer = Buffer.alloc(600 * 1024);
        const body2 = buildMultipart(boundary, {}, { name: 'logo', filename: 't.png', content: bigBuffer, type: 'image/png' });
        const res2 = await app.inject({
            method: 'POST',
            url: `/w/${WS_ID}/letterhead`,
            headers: { Authorization: `Bearer ${U_ID}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body2
        });
        t.equal(res2.statusCode, 400, 'Size limit');

        // 3. Field length (> 120 chars)
        const longVal = 'A'.repeat(121);
        const body3 = buildMultipart(boundary, { letterhead_line1: longVal });
        const res3 = await app.inject({
            method: 'POST',
            url: `/w/${WS_ID}/letterhead`,
            headers: { Authorization: `Bearer ${U_ID}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body3
        });
        t.equal(res3.statusCode, 400, 'Length limit');

        await app.close();
    });

    await t.test('Wallet & Billing Edge Cases', async (t) => {
        const db = {
            query: async (sql: string, params: any[]) => {
                if (sql.includes('SELECT 1 FROM workspace_members')) return { rowCount: 1, rows: [] };
                if (sql.includes('INSERT INTO wallet_ledger')) return { rowCount: 0, rows: [] }; // No-op insert for debit test
                if (sql.includes('SELECT id FROM wallet_ledger')) return { rowCount: 0, rows: [] }; // No existing for debit
                return { rowCount: 1, rows: [{ balance: '0' }] };
            }
        } as any;

        // getBalance
        const bal = await getBalance(db, WS_ID);
        t.equal(bal, 0);

        // credit 0 error
        try {
            await credit(db, WS_ID, 0, 'ref');
            t.fail('Should throw');
        } catch (e: any) {
            t.equal(e.message, 'Credit amount must be positive');
        }

        // debit 0 error
        try {
            await debit(db, WS_ID, 0, 'ref');
            t.fail('Should throw');
        } catch (e: any) {
            t.equal(e.message, 'Debit amount must be positive');
        }

        // debit insufficient funds
        try {
            await debit(db, WS_ID, 10, 'ref');
            t.fail('Should throw');
        } catch (e: any) {
            t.equal(e.message, 'Insufficient balance');
        }

        // Billing topup-intent invalid amount
        const app = buildApp(db);
        await app.ready();
        const resTopup = await app.inject({
            method: 'POST',
            url: `/w/${WS_ID}/internal/topup-intent`,
            headers: { Authorization: `Bearer ${U_ID}` },
            body: { amount_idr: 999 } // no tier
        });
        t.equal(resTopup.statusCode, 400, 'Invalid tier');
        await app.close();
    });
});

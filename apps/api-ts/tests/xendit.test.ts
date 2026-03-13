import tap from 'tap';
import { xendit } from '../src/lib/xendit';
import { logger } from '../src/utils/logger';

const test = tap.test;

test('Xendit Client utility', async (t) => {
    const SECRET = 'x_secret';
    const TOKEN = 'x_token';

    await t.test('verifyCallback', async (t) => {
        process.env.XENDIT_CALLBACK_TOKEN = TOKEN;

        t.ok(xendit.verifyCallback(TOKEN), 'valid token');
        t.notOk(xendit.verifyCallback('wrong'), 'invalid token');
        t.notOk(xendit.verifyCallback(undefined), 'missing token');

        delete process.env.XENDIT_CALLBACK_TOKEN;
        t.notOk(xendit.verifyCallback(TOKEN), 'no token configured');
    });

    await t.test('createInvoice - Success', async (t) => {
        process.env.XENDIT_SECRET_KEY = SECRET;

        const mockResponse = {
            id: 'inv_123',
            external_id: 'ext_123',
            invoice_url: 'http://xendit.co/inv',
            status: 'PENDING',
            amount: 1000
        };

        // Mock global fetch
        const originalFetch = global.fetch;
        (global as any).fetch = async (url: string, init: any) => {
            t.equal(url, 'https://api.xendit.co/v2/invoices');
            const auth = Buffer.from(`${SECRET}:`).toString('base64');
            t.equal(init.headers['Authorization'], `Basic ${auth}`);

            return {
                ok: true,
                json: async () => mockResponse
            } as any;
        };

        const result = await xendit.createInvoice({
            externalId: 'ext_123',
            amount: 1000
        });

        t.equal(result.id, 'inv_123');
        t.equal(result.amount, 1000);

        global.fetch = originalFetch;
    });

    await t.test('createInvoice - Failure', async (t) => {
        process.env.XENDIT_SECRET_KEY = SECRET;

        const originalFetch = global.fetch;
        (global as any).fetch = async () => {
            return {
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => '{"error_code":"VALIDATION_ERROR"}'
            } as any;
        };

        await t.rejects(xendit.createInvoice({
            externalId: 'ext_err',
            amount: 0
        }), /Xendit API Error/);

        global.fetch = originalFetch;
    });

    await t.test('createInvoice - Missing Secret', async (t) => {
        delete process.env.XENDIT_SECRET_KEY;
        await t.rejects(xendit.createInvoice({ externalId: 'foo', amount: 1 }), /not configured/);
    });
});

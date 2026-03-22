import { constantTimeCompare } from '../utils/crypto';
import { logger } from '../utils/logger';

const getSecretKey = () => process.env.XENDIT_SECRET_KEY;
const getCallbackToken = () => process.env.XENDIT_CALLBACK_TOKEN;

export interface XenditInvoiceResponse {
    id: string;
    external_id: string;
    invoice_url: string;
    status: string;
    amount: number;
    expiry_date: string;
}

/**
 * Minimal Xendit Client Utility
 */
export const xendit = {
    /**
     * Create a Xendit Invoice.
     * Doc: https://developers.xendit.co/api-reference/#create-invoice
     */
    async createInvoice(params: {
        externalId: string;
        amount: number;
        payerEmail?: string;
        description?: string;
    }): Promise<XenditInvoiceResponse> {
        const secretKey = getSecretKey();
        if (!secretKey) {
            throw new Error('XENDIT_SECRET_KEY is not configured');
        }

        const auth = Buffer.from(`${secretKey}:`).toString('base64');

        const response = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify({
                external_id: params.externalId,
                amount: params.amount,
                payer_email: params.payerEmail,
                description: params.description,
                should_send_email: !!params.payerEmail
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            logger.error({ status: response.status, body: errBody }, 'Xendit Invoice creation failed');
            throw new Error(`Xendit API Error: ${response.statusText}`);
        }

        return await response.json() as XenditInvoiceResponse;
    },

    /**
     * Verify Callback Token from Xendit Webhook.
     * Doc: https://developers.xendit.co/api-reference/#callbacks
     */
    verifyCallback(token: string | undefined): boolean {
        const callbackToken = getCallbackToken();
        if (!callbackToken) {
            logger.error('XENDIT_CALLBACK_TOKEN is not configured');
            return false;
        }

        if (!token) return false;

        return constantTimeCompare(token, callbackToken);
    }
};

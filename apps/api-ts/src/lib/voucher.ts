import { Pool } from 'pg';
import { randomBytes } from 'crypto';

/**
 * Voucher Service — Management and Redemption.
 */
export const voucherService = {
    /**
     * Generate a code like VA-XXXX-XXXX
     * Random enough for 32k combinations per second, collision-safe for our scale.
     */
    generateCode(): string {
        const parts = [];
        for (let i = 0; i < 2; i++) {
            parts.push(randomBytes(2).toString('hex').toUpperCase());
        }
        return `VA-${parts.join('-')}`;
    },

    /**
     * Redeem a voucher.
     * Marks it as redeemed and returns the credit amount.
     * Uses SELECT ... FOR UPDATE for atomicity.
     */
    async redeem(db: Pool, code: string, workspaceId: string): Promise<number> {
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `SELECT credits, status, expires_at 
                 FROM voucher_codes 
                 WHERE code = $1 FOR UPDATE`,
                [code]
            );

            if (result.rowCount === 0) {
                throw new Error('Voucher code not found');
            }

            const v = result.rows[0];

            if (v.status === 'redeemed') {
                throw new Error('Voucher already redeemed');
            }

            if (v.status === 'expired' || (v.expires_at && new Date(v.expires_at) < new Date())) {
                throw new Error('Voucher expired');
            }

            // Update status
            await client.query(
                `UPDATE voucher_codes 
                 SET status = 'redeemed', workspace_id = $1, redeemed_at = NOW() 
                 WHERE code = $2`,
                [workspaceId, code]
            );

            await client.query('COMMIT');
            return v.credits;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
};

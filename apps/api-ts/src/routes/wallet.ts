import { FastifyInstance } from 'fastify';
import { getBalance } from '../lib/wallet';

export default async function walletRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {

        // 1. Wallet Summary Endpoint
        childServer.get('/:workspaceId/wallet/summary', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;

            // Compute balance using the core wallet utility
            const creditsRemaining = await getBalance(fastify.db, workspaceId);

            // Compute documents generated purely from ledger metadata matching 'generate_module'
            const docsResult = await fastify.db.query(
                `SELECT COUNT(*) AS count
                 FROM wallet_ledger
                 WHERE workspace_id = $1 
                 AND metadata->>'transaction_type' = 'generate_module'`,
                [workspaceId]
            );
            const documentsGenerated = parseInt(docsResult.rows[0]?.count as string || '0', 10);

            // Compute month_usage (sum of debit amounts for current month)
            const monthUsageResult = await fastify.db.query(
                `SELECT COALESCE(SUM(amount), 0) AS usage
                 FROM wallet_ledger
                 WHERE workspace_id = $1 
                 AND type = 'debit'
                 AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`,
                [workspaceId]
            );
            const monthUsage = parseInt(monthUsageResult.rows[0]?.usage as string || '0', 10);

            return {
                credits_remaining: creditsRemaining,
                documents_generated: documentsGenerated,
                month_usage: monthUsage
            };
        });

        // 2. Transaction History Endpoint
        childServer.get('/:workspaceId/wallet/transactions', {
            preHandler: [fastify.workspaceGuard]
        }, async (request, reply) => {
            const workspaceId = request.workspaceId;

            const result = await fastify.db.query(
                `SELECT 
                    created_at AS date,
                    type,
                    amount,
                    metadata
                 FROM wallet_ledger
                 WHERE workspace_id = $1
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [workspaceId]
            );

            // Map DB representation (always positive amount, strict type credit/debit)
            // To API Response Representation (negative amount for debit, map to transaction_type)
            const transactions = result.rows.map(row => {
                const isDebit = row.type === 'debit';
                const meta = (row.metadata as Record<string, unknown>) || {};

                return {
                    date: (row.date as Date).toISOString().split('T')[0], // YYYY-MM-DD
                    type: meta.transaction_type || (isDebit ? 'generate_module' : 'topup'), // Fallback if no meta
                    amount: isDebit ? -(row.amount as number) : (row.amount as number),
                    status: 'success', // Append-only ledger implies successful execution history
                    note: meta.note || ''
                };
            });

            return transactions;
        });

    }, { prefix: '/w' });
}

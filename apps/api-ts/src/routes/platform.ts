import { FastifyInstance } from 'fastify';

export default async function platformRoutes(fastify: FastifyInstance) {
    fastify.register(async (childServer) => {
        childServer.addHook('preHandler', fastify.platformGuard);

        // GET /platform/stats/revenue
        // Investor-grade revenue analytics
        childServer.get('/stats/revenue', async (request, reply) => {
            const [
                totalRevenueResult,
                mrrResult,
                growthResult,
                topWorkspacesResult
            ] = await Promise.all([
                // 1. Total Lifetime Revenue
                fastify.db.query(`SELECT SUM(amount) AS total FROM receipts WHERE status = 'paid'`),
                
                // 2. MRR (Monthly Recurring Revenue)
                // Based on active Institutional/Enterprise plans
                fastify.db.query(`
                    SELECT SUM(p.base_price_idr) AS mrr
                    FROM workspaces w
                    JOIN pricing_plans p ON p.id = w.plan_id
                    WHERE w.subscription_status = 'active' AND p.slug != 'personal'
                `),

                // 3. Monthly Growth (Revenue last 6 months)
                fastify.db.query(`
                    WITH monthly_rev AS (
                        SELECT 
                            date_trunc('month', created_at) AS month,
                            SUM(amount) AS rev
                        FROM receipts
                        WHERE status = 'confirmed'
                        GROUP BY month
                    )
                    SELECT 
                        month,
                        rev,
                        LAG(rev) OVER (ORDER BY month) AS prev_rev
                    FROM monthly_rev
                    ORDER BY month DESC
                    LIMIT 6
                `),

                // 4. Top 10 Revenue Workspaces
                fastify.db.query(`
                    SELECT w.name, SUM(r.amount) AS revenue
                    FROM receipts r
                    JOIN workspaces w ON w.id = r.workspace_id
                    WHERE r.status = 'confirmed' OR r.status = 'paid'
                    GROUP BY w.id, w.name
                    ORDER BY revenue DESC
                    LIMIT 10
                `)
            ]);

            return {
                total_revenue: parseInt(totalRevenueResult.rows[0]?.total || '0', 10),
                mrr: parseInt(mrrResult.rows[0]?.mrr || '0', 10),
                growth: growthResult.rows,
                top_workspaces: topWorkspacesResult.rows
            };
        });

        // GET /platform/stats/technical
        // Technical & Support Analytics
        childServer.get('/stats/technical', async (request, reply) => {
            const [
                jobStatsResult,
                errorRatesResult,
                avgDurationResult,
                jobTrendsResult,
                activeUsersResult
            ] = await Promise.all([
                // 1. Global job status
                fastify.db.query(`SELECT status, COUNT(*) AS count FROM generation_jobs GROUP BY status`),
                
                // 2. Recent Errors (last 24h)
                fastify.db.query(`
                    SELECT COUNT(*) AS error_count 
                    FROM generation_jobs 
                    WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
                `),

                // 3. Avg Generation Duration (done jobs)
                fastify.db.query(`
                    SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_duration_s
                    FROM generation_jobs
                    WHERE status = 'done' AND updated_at IS NOT NULL
                `),

                // 4. Job Trends (last 7 days)
                fastify.db.query(`
                    SELECT 
                        date_trunc('day', created_at) AS day,
                        status,
                        COUNT(*) as count
                    FROM generation_jobs
                    WHERE created_at >= NOW() - INTERVAL '7 days'
                    GROUP BY day, status
                    ORDER BY day DESC
                `),

                // 5. Active Users (last 24h)
                fastify.db.query(`
                    SELECT COUNT(DISTINCT clerk_user_id) as active_count
                    FROM generation_jobs
                    WHERE created_at >= NOW() - INTERVAL '24 hours'
                `)
            ]);

            return {
                job_distribution: jobStatsResult.rows,
                errors_24h: parseInt(errorRatesResult.rows[0]?.error_count || '0', 10),
                avg_duration_s: Math.round(parseFloat(avgDurationResult.rows[0]?.avg_duration_s || '0')),
                job_trends: jobTrendsResult.rows,
                active_users_24h: parseInt(activeUsersResult.rows[0]?.active_count || '0', 10)
            };
        });

        // GET /platform/workspaces
        // Global workspace lookup for support
        childServer.get('/workspaces', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        search: { type: 'string' },
                        limit: { type: 'integer', default: 50 }
                    }
                }
            }
        }, async (request, reply) => {
            const { search, limit } = request.query as any;
            let query = `
                SELECT w.id, w.name, w.workspace_type, w.created_at, p.name AS plan_name, w.subscription_status
                FROM workspaces w
                LEFT JOIN pricing_plans p ON p.id = w.plan_id
            `;
            const params = [];
            if (search) {
                query += ` WHERE w.name ILIKE $1 OR w.id ILIKE $1`;
                params.push(`%${search}%`);
            }
            query += ` ORDER BY w.created_at DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            const result = await fastify.db.query(query, params);

            // PR-105: Persistent Audit Trail
            await fastify.db.query(
                `INSERT INTO platform_audit_logs (id, event_type, actor_id, actor_email, severity, action_details) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    `audit_${Math.random().toString(36).slice(2, 11)}`, 
                    'WORKSPACE_LOOKUP', 
                    request.auth?.userId || 'system',
                    request.auth?.email || 'admin@modulajar.app',
                    'info',
                    JSON.stringify({ search, results_count: result.rows.length })
                ]
            );

            return { workspaces: result.rows };
        });

        // GET /platform/audit-logs
        // Industrial-grade security log retrieval
        childServer.get('/audit-logs', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        search: { type: 'string' },
                        event_type: { type: 'string' },
                        severity: { type: 'string' },
                        limit: { type: 'integer', default: 50 },
                        offset: { type: 'integer', default: 0 }
                    }
                }
            }
        }, async (request, reply) => {
            const { search, event_type, severity, limit, offset } = request.query as any;
            
            let query = `SELECT * FROM platform_audit_logs WHERE 1=1`;
            const params = [];
            let pIdx = 1;

            if (search) {
                query += ` AND (actor_email ILIKE $${pIdx} OR event_type ILIKE $${pIdx} OR actor_id ILIKE $${pIdx})`;
                params.push(`%${search}%`);
                pIdx++;
            }

            if (event_type) {
                query += ` AND event_type = $${pIdx}`;
                params.push(event_type);
                pIdx++;
            }

            if (severity) {
                query += ` AND severity = $${pIdx}`;
                params.push(severity);
                pIdx++;
            }

            query += ` ORDER BY created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
            params.push(limit, offset);

            const [result, countResult] = await Promise.all([
                fastify.db.query(query, params),
                fastify.db.query(`SELECT COUNT(*) FROM platform_audit_logs`)
            ]);

            return { 
                logs: result.rows,
                total: parseInt(countResult.rows[0].count, 10)
            };
        });

    }, { prefix: '/platform' });
}

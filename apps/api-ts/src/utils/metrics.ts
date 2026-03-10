import client from 'prom-client';

export const register = new client.Registry();

// Add default metrics (CPU, RAM, etc.)
client.collectDefaultMetrics({ register, prefix: 'modulajar_api_' });

export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
});

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route'],
    registers: [register],
    buckets: [50, 100, 300, 500, 1000, 2000, 5000, 10000],
});

export const walletBalanceChecksTotal = new client.Counter({
    name: 'wallet_balance_checks_total',
    help: 'Total number of wallet balance checks',
    registers: [register],
});

export const walletDebitTotal = new client.Counter({
    name: 'wallet_debit_total',
    help: 'Total number of successful wallet debits',
    registers: [register],
});

export const walletDebitFailedTotal = new client.Counter({
    name: 'wallet_debit_failed_total',
    help: 'Total number of failed wallet debits',
    labelNames: ['reason'],
    registers: [register],
});

export const walletTransactionsTotal = new client.Counter({
    name: 'wallet_transactions_total',
    help: 'Total number of wallet transactions (credits and debits)',
    labelNames: ['type'],
    registers: [register],
});

export const generateRequestsTotal = new client.Counter({
    name: 'generate_requests_total',
    help: 'Total number of generation requests',
    labelNames: ['result'], // success, failed
    registers: [register],
});

// PR-064: Template Library API Metrics
export const templateApiRequestsTotal = new client.Counter({
    name: 'template_api_requests_total',
    help: 'Total number of template API requests',
    labelNames: ['result'], // success, error
    registers: [register],
});

export const templateApiLatencyMs = new client.Histogram({
    name: 'template_api_latency_ms',
    help: 'Latency of template API requests in ms',
    registers: [register],
    buckets: [5, 10, 25, 50, 100, 250, 500],
});

export const templateApiErrorsTotal = new client.Counter({
    name: 'template_api_errors_total',
    help: 'Total number of template API errors',
    labelNames: ['reason'], // validation, rate_limited, internal
    registers: [register],
});

// PR-065: Onboarding Metrics
export const onboardingStartedTotal = new client.Counter({
    name: 'onboarding_started_total',
    help: 'Total onboarding flows started',
    registers: [register],
});

export const onboardingCompletedTotal = new client.Counter({
    name: 'onboarding_completed_total',
    help: 'Total onboarding flows completed',
    registers: [register],
});

// PR-067: Module Editor Metrics
export const moduleUpdateTotal = new client.Counter({
    name: 'module_update_total',
    help: 'Total number of module updates (autosave/manual)',
    labelNames: ['result'], // success, error
    registers: [register],
});

export const aiAssistTotal = new client.Counter({
    name: 'ai_assist_total',
    help: 'Total number of AI assist requests from editor',
    labelNames: ['section', 'action', 'result'],
    registers: [register],
});

// PR-C14: Administration Bundle Metrics
export const bundleGenerationTotal = new client.Counter({
    name: 'bundle_generation_total',
    help: 'Total number of administration bundle generation requests',
    registers: [register],
});

export const bundleSuccessTotal = new client.Counter({
    name: 'bundle_success_total',
    help: 'Total number of successfully completed bundles',
    registers: [register],
});

export const bundleFailedTotal = new client.Counter({
    name: 'bundle_failed_total',
    help: 'Total number of failed bundle generations',
    labelNames: ['reason'],
    registers: [register],
});

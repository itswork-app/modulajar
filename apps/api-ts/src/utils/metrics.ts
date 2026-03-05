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

export const walletDebitTotal = new client.Counter({
    name: 'wallet_debit_total',
    help: 'Total number of wallet debit attempts',
    labelNames: ['result'], // success, failed
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

# Observability

This document outlines the observability stack for `modulajar`, including metrics, logging, and trace correlation.

## 1. Metrics (Prometheus)

Both `api-ts` and `core-go` (worker) expose Prometheus-compatible metrics at `/metrics`.

### Key Metrics

#### API (`apps/api-ts`)
- `http_requests_total{method, route, status}`: Counter of requests (route is pattern-based for low cardinality).
- `http_request_duration_ms{method, route}`: Histogram of request latency.
- `generate_requests_total{result}`: Counter of generation requests (`success` or `failed`).
- `wallet_debit_total{result}`: Counter of wallet debit attempts.

#### Worker (`apps/core-go`)
- `jobs_acquired_total{result}`: Counter of jobs picked up from the queue.
- `job_duration_ms{result}`: Histogram of job execution time.
- `job_retries_total`: Counter of job retries triggered by errors.
- `job_failures_total`: Counter of jobs that failed after max retries.
- `gcs_upload_total{result}`: Counter of GCS upload attempts.
- `jobs_queued_gauge`: Current number of jobs in `queued` status (computed on scrape).
- `jobs_running_gauge`: Current number of jobs in `running` status (computed on scrape).
- `jobs_failed_gauge`: Current number of jobs in `failed` status (computed on scrape).

### Scraping
- **Local**:
  - API: `GET http://localhost:$PORT/metrics` (default 8080)
  - Worker: `GET http://localhost:$PORT/metrics` (default 8080)

## 2. Structured Logging (JSON)

All services emit logs in JSON format for easy ingestion by Cloud Logging / Fluentd.

### Standard Fields
- `timestamp`: ISO-8601 time.
- `level`: `info`, `warn`, `error`, etc.
- `service`: `api-ts` or `worker`.
- `trace_id`: Correlation ID linking API request -> DB Job -> Worker Log.
- `msg`: Human-readable message.

### Trace Correlation
1. **API**: Generates `trace_id` (UUID) for every `/w/:id/internal/generate-semester` request.
2. **DB**: Persists `trace_id` in `generation_jobs.metadata`.
3. **Worker**: Reads `trace_id` from metadata and attaches it to all logs during job execution.

**Example Flow**:
```json
// API Log
{ "level": "info", "trace_id": "abc-123", "msg": "Job enqueued", "job_id": "xyz" }

// Worker Log
{ "level": "info", "trace_id": "abc-123", "msg": "Job acquired", "job_id": "xyz" }
```

## 3. Health Checks

- `/healthz`: Liveness probe. Returns 200 OK if service is alive.
- `/readyz`: Readiness probe. Returns 200 OK if dependencies (DB) are ready.

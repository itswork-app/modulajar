# Observability Canon — 05

Standar pola observability di platform Modulajar. Untuk daftar metrik implementasi terkini, dokumen ini menjadi **sumber kebenaran nama metrik**; ringkasan operasional ada di [docs/OBSERVABILITY.md](../OBSERVABILITY.md).

## Logging

### Structured triplet
Log pada siklus hidup job generasi harus menyertakan konteks berikut bila relevan:

| Key | Description | Requirement |
| :--- | :--- | :--- |
| `trace_id` | UUID request edge (Fastify `request.id`) atau dari `generation_jobs.metadata` | Mandatory untuk alur job |
| `workspace_id` | ULID tenant | Mandatory untuk alur job |
| `job_id` | ULID job | Mandatory untuk alur job |

### Example (JSON)
```json
{
  "level": "info",
  "msg": "Job acquired",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "01H2X...",
  "job_id": "01H3Y...",
  "attempt": 1
}
```

## Trace propagation

1. **API (Fastify):** `request.id` dimasukkan ke `generation_jobs.metadata` sebagai `trace_id`.
2. **Worker (Go):** membaca `trace_id` dari metadata dan menempelkannya pada log terstruktur.

## Metrics — implementasi aktual (Prometheus)

### API TypeScript (`apps/api-ts`)

| Metric | Type | Labels / notes |
| :--- | :--- | :--- |
| `modulajar_api_*` | default Node | Prefix dari `prom-client` default metrics |
| `http_requests_total` | Counter | `method`, `route`, `status` |
| `http_request_duration_ms` | Histogram | `method`, `route` |
| `wallet_balance_checks_total` | Counter | — |
| `wallet_debit_total` | Counter | — |
| `wallet_debit_failed_total` | Counter | `reason` |
| `wallet_transactions_total` | Counter | `type` |
| `generate_requests_total` | Counter | `result` |
| `template_api_requests_total` | Counter | `result` |
| `template_api_latency_ms` | Histogram | — |
| `template_api_errors_total` | Counter | `reason` |
| `onboarding_started_total` | Counter | — |
| `onboarding_completed_total` | Counter | — |
| `module_update_total` | Counter | `result` |
| `ai_assist_total` | Counter | `section`, `action`, `result` |
| `bundle_generation_total` | Counter | — |
| `bundle_success_total` | Counter | — |
| `bundle_failed_total` | Counter | `reason` |

Definisi: [`apps/api-ts/src/utils/metrics.ts`](../../apps/api-ts/src/utils/metrics.ts).

### Worker Go (`apps/core-go`)

| Metric | Type | Labels / notes |
| :--- | :--- | :--- |
| `jobs_acquired_total` | Counter | `result` |
| `job_started_total` | Counter | — |
| `job_completed_total` | Counter | — |
| `job_failed_total` | Counter | — |
| `job_duration_ms` | Histogram | `result` (`done` / `failed`) |
| `job_retries_total` | Counter | — |
| `job_failures_total` | Counter | — |
| `gcs_upload_total` | Counter | `result` |
| `worker_heartbeat_timestamp` | Gauge | — |
| `jobs_stuck_gauge` | Gauge | — |
| `quality_pass_total` | Counter | — |
| `quality_retry_total` | Counter | — |
| `quality_fail_total` | Counter | — |
| `quality_score_histogram` | Histogram | — |
| `dataset_*` | Counter | kandidat, insert, duplikat, ditolak kualitas |
| `template_rank_*` | Counter / Histogram | permintaan, latency, template terpilih |
| `generation_duration_seconds` | Histogram | `result` — durasi end-to-end job |
| `pdf_render_duration_seconds` | Histogram | — |
| `ai_request_duration_seconds` | Histogram | — |
| `jobs_queued_gauge` | Gauge | dari `QueueCollector` |
| `jobs_running_gauge` | Gauge | — |
| `jobs_failed_gauge` | Gauge | — |

Definisi: [`apps/core-go/metrics/metrics.go`](../../apps/core-go/metrics/metrics.go).

### Histogram durasi (canon PR-A5)

Histogram berikut memakai **detik** untuk keselarasan dengan canon domain (`generation_duration_seconds`, `pdf_render_duration_seconds`, `ai_request_duration_seconds`). Histogram `job_duration_ms` tetap dalam **milidetik** untuk kompatibilitas historis; gunakan label dan dokumentasi dashboard untuk menghindari salah interpretasi.

### Recommended buckets (canon domain, detik)

`[0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]` — selaras dengan bucket yang dipakai di kode untuk `generation_duration_seconds` (lihat `metrics.go`).

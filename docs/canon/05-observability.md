# Observability Canon — 05

Standardizes observability patterns across the Modulajar platform to ensure production readiness, deterministic tracing, and operational visibility.

## Logging

### Structured triplet
All logs emitted by any service (Fastify API or Go worker) must include the following context triplet when within the lifecycle of a generation job:

| Key | Description | Requirement |
| :--- | :--- | :--- |
| `trace_id` | Edge-generated UUID (Fastify request ID) | Mandatory |
| `workspace_id` | ULID of the tenant workspace | Mandatory |
| `job_id` | ULID of the specific generation job | Mandatory |

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

## Trace Propagation

1. **Edge (API)**: Fastify generates a unique `request.id` and attaches it as `trace_id` in the `generation_jobs.metadata`.
2. **Queue (DB)**: The Go worker acquires the job and extracts `trace_id` from the JSON metadata.
3. **Execution (Worker)**: The worker creates a sub-logger with `trace_id`, `workspace_id`, and `job_id` bound to it. All routines (AI, Render, Storage) must use this logger.

## Metrics (Prometheus)

All duration metrics are recorded as **Histograms** in seconds with the following canonical names:

| Metric Name | Description | Labels |
| :--- | :--- | :--- |
| `generation_duration_seconds` | Total time for a job to complete (start to finish) | `result` (done\|failed) |
| `pdf_render_duration_seconds` | Time spent in Typst/Playwright PDF rendering | - |
| `ai_request_duration_seconds` | Time spent waiting for LLM completion API | - |

### Recommended Buckets
`[0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]`

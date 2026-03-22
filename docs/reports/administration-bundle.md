# PR-C14 — Administration Bundle Generator

## Objective

Enable teachers to generate a complete set of teaching administration documents (ATP, Prota, Promes, and Modul Ajar per topic) in a single workflow.

## Bundle Workflow

```
Teacher selects subject + kelas + semester
↓
AI generates topic plan (or manual entry)
↓
Credit estimation shown (ATP + Prota + Promes + N × Modul)
↓
POST /w/:id/bundle — debit, create jobs
↓
Redirect to /workspace/bundles/:id (polling page)
↓
Documents ready — download individually
```

## Document Relationships

| Doc Type | Source | Basis |
|---|---|---|
| ATP | Bundle context | Subject, kelas, semester |
| Prota | Bundle context | Annual distribution of topics |
| Promes | Topic plan | Week-by-week schedule |
| Modul Ajar | Per topic | 1 job per topic in the list |

## Billing Rules

| Document | Credits |
|---|---|
| ATP | 1 credit |
| Prota | 1 credit |
| Promes | 1 credit |
| Modul Ajar (per topic) | 5 credits |
| **Example: 8 topics** | **19 credits** |

- Credits are debited **atomically** before any jobs are created.
- Estimation is shown to the teacher **before** generation starts.
- If credit is insufficient, the API returns HTTP 402 with remaining balance.

## Generation Pipeline

Reuses the existing generation system:

1. `POST /w/:workspaceId/bundle` — creates a `bundles` row + N `generation_jobs` rows (doc_type: atp, prota, promes, modul_ajar).
2. Each job is picked up by the existing Go worker via the standard queue.
3. `GET /w/:workspaceId/bundle/:bundleId` — fetches all jobs, derives aggregate status.
4. Frontend polls every 3 seconds while status is `pending` / `running`.

## Bundle Metadata

Each `bundles` row stores:

| Field | Notes |
|---|---|
| `workspace_id` | Tenant isolation |
| `subject` | Mata pelajaran |
| `kelas` | Grade level |
| `semester` | 1 or 2 |
| `tahun_ajaran` | e.g. 2024/2025 |
| `teacher_name` | Prefilled from profile |
| `school_name` | Prefilled from workspace settings |
| `topic_count` | Number of modul ajar jobs |
| `status` | pending \| running \| done \| failed |

## Route Summary

| Method | Path | Description |
|---|---|---|
| POST | `/w/:workspaceId/bundle` | Create bundle, debit, enqueue jobs |
| GET | `/w/:workspaceId/bundle/:bundleId` | Poll bundle + job status |

## Observability

Three metrics registered in Prometheus:

- `bundle_generation_total` — total bundle creation requests
- `bundle_success_total` — completed bundles
- `bundle_failed_total{reason}` — failed bundles with error type

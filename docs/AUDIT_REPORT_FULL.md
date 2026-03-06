# Modulajar — Full Institutional Audit Report

**Date**: 2026-03-06
**Branch**: `pr-071-wallet-system-final` (commit `76626ca` — Wallet System Integration)
**Auditor**: Antigravity

---

## 1. System Inventory

### 1.1 Repository Structure

```
modulajar/
├── apps/
│   ├── api-ts/         # Fastify API (Node.js/TypeScript)
│   ├── core-go/        # Worker engine (Go) — AI + PDF + queue
│   ├── worker-go/      # Worker entrypoint (Go, depends on core-go)
│   ├── console-web/    # Next.js console (Clerk auth)
│   └── web/            # Marketing landing page
├── migrations/         # 7 SQL migrations (001–007)
├── .github/workflows/  # CI (ci.yaml) + Deploy (deploy-worker-go.yaml)
├── cloudbuild.yaml     # Cloud Build (api-ts + worker-go)
├── env-api.yaml        # ⚠️ PLAINTEXT SECRETS
├── env-worker.yaml     # ⚠️ PLAINTEXT SECRETS
└── docs/
```

### 1.2 Runtime Versions

| Component | Version |
|-----------|---------|
| Node.js (local) | v24.11.1 |
| Node.js (CI/Docker) | v20.x |
| Go (local) | 1.22.2 |
| Go (CI/Docker) | 1.24 |
| TypeScript | 5.9.3 |
| PostgreSQL (CI) | 16 |
| Chromium (Docker) | Debian Bookworm package |

### 1.3 Migrations (7 total)

| Migration | Purpose |
|-----------|---------|
| 001_initial_schema.sql | Core tables (workspaces, packages, jobs, documents, wallet) |
| 002_tenant_isolation.sql | RLS and workspace scoping |
| 003_wallet_ledger_hardening.sql | UNIQUE constraint, append-only ledger |
| 004_queue_hardening.sql | FOR UPDATE SKIP LOCKED, backoff columns |
| 005_verify_hardening.sql | Verify endpoint support |
| 006_payment_events.sql | Payment webhook idempotency table |
| 007_workspace_identity.sql | Workspace type, NPSN, school info |

- **[NEW] `apps/api-ts/src/routes/wallet.ts`**: Summary and transaction history endpoints.
- **[MODIFY] `apps/api-ts/src/routes/generate.ts`**: Atomic debit-before-insert logic.
- **[MODIFY] `apps/api-ts/src/lib/wallet.ts`**: Instrumented metrics and CTE debit logic.

### 1.4 Service Map

| Service | Platform | URL |
|---------|----------|-----|
| modulajar-api | Cloud Run (asia-southeast1) | api.modulajar.app |
| modulajar-worker | Cloud Run (asia-southeast2 via GH Actions) | Internal, IAM-only |
| console-web | Vercel | app.modulajar.app |
| web (landing) | Vercel | modulajar.app |

---

## 2. Deploy Pipeline Readiness

### 2.1 GitHub Actions CI (`ci.yaml`)

| Check | Status | Evidence |
|-------|--------|----------|
| Triggers on push/PR to main | ✅ | [ci.yaml:3-7](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L3-L7) |
| api-ts: lint + test + build | ✅ | [ci.yaml:27-81](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L27-L81) |
| api-ts: coverage gate (lines≥90%, branches≥80%) | ✅ | [ci.yaml:65-79](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L65-L79) |
| core-go: test+coverage gate (total≥80%, worker≥80%) | ✅ | [ci.yaml:83-173](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L83-L173) |
| Migration up/down/idempotency test | ✅ | [ci.yaml:190-217](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L190-L217) |

### 2.2 Deploy Pipeline (`deploy-worker-go.yaml` + `cloudbuild.yaml`)

| Check | Status | Evidence |
|-------|--------|----------|
| Deploy only from main | ✅ | [deploy-worker-go.yaml:5-6](file:///home/kangza/workspace/modulajar/.github/workflows/deploy-worker-go.yaml#L5-L6) |
| Image tagged by SHA ($COMMIT_SHA) | ✅ | [deploy-worker-go.yaml:45](file:///home/kangza/workspace/modulajar/.github/workflows/deploy-worker-go.yaml#L45) |
| Worker: `--no-allow-unauthenticated` | ✅ | [cloudbuild.yaml:63](file:///home/kangza/workspace/modulajar/cloudbuild.yaml#L63) |
| API: `--allow-unauthenticated` | ✅ | [cloudbuild.yaml:40](file:///home/kangza/workspace/modulajar/cloudbuild.yaml#L40) |
| Worker: 2Gi memory, concurrency=1 | ✅ | [cloudbuild.yaml:58-62](file:///home/kangza/workspace/modulajar/cloudbuild.yaml#L58-L62) |

### 2.3 Deploy Gaps

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| D1 | **Region mismatch**: cloudbuild uses `asia-southeast1`, deploy-worker-go.yaml uses `asia-southeast2` | **High** | [cloudbuild.yaml:8](file:///home/kangza/workspace/modulajar/cloudbuild.yaml#L8) vs [deploy-worker-go.yaml:14](file:///home/kangza/workspace/modulajar/.github/workflows/deploy-worker-go.yaml#L14) |
| D2 | **No deploy pipeline for api-ts in GitHub Actions** — only via Cloud Build (manual trigger?) | Medium | Only `deploy-worker-go.yaml` exists |
| D3 | Worker deploy passes secrets as `env_vars` (visible in Cloud Run console) instead of `--set-secrets` | Medium | [deploy-worker-go.yaml:59-66](file:///home/kangza/workspace/modulajar/.github/workflows/deploy-worker-go.yaml#L59-L66) |
| D4 | No `--set-env-vars VERIFY_BASE_URL` in deploy-worker-go — worker falls back to hardcoded default | Low | [worker.go:357-358](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L357-L358) |

---

## 3. Security Audit — Risk Matrix

### 3.1 CRITICAL

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| S1 | **Plaintext production secrets committed to repo** (`env-api.yaml`, `env-worker.yaml`) — DB password, Clerk keys, Gemini API key, PID/DID secrets | [env-api.yaml](file:///home/kangza/workspace/modulajar/env-api.yaml), [env-worker.yaml](file:///home/kangza/workspace/modulajar/env-worker.yaml) | Rotate ALL secrets immediately, delete files, add to `.gitignore`, use `git filter-branch` or BFG to purge from history |
| S2 | **CORS methods limited to `GET, POST`** — `PATCH /w/:wid/workspace` (PR-033) will be blocked by CORS preflight | [index.ts:34](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts#L34) | Add `PATCH` to CORS methods |

### 3.2 HIGH

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| S3 | **No security headers** — missing HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy | [index.ts](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts) (no `helmet` or equivalent) | Add `@fastify/helmet` or manual `onSend` hook |
| S4 | **`constantTimeCompare` leaks length info** — returns `false` immediately if lengths differ (allows oracle to determine signature length) | [crypto.ts:11](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/crypto.ts#L11) | Pad shorter buffer to same length before comparison |
| S5 | **API `readyz` is trivial** — returns `{status:'ok'}` without checking DB, unlike worker which checks DB+Chrome | [index.ts:93](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts#L93) | Add DB ping check to readyz |

### 3.3 MEDIUM

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| S6 | **Internal webhook route has no auth beyond HMAC** — `/internal/webhooks/payment/confirm` relies solely on HMAC; no IAM or token gate | [billing.ts:107](file:///home/kangza/workspace/modulajar/apps/api-ts/src/routes/billing.ts#L107) | Acceptable if API is `--allow-unauthenticated`; consider IP allowlist for payment provider |
| S7 | **PID_SECRET fallback to dev secret in production** if env var missing | [generate.ts:9](file:///home/kangza/workspace/modulajar/apps/api-ts/src/routes/generate.ts#L9) | Fail hard if `PID_SECRET` is not set in production |

### 3.4 Payments/Webhook Audit

| Check | Status | Evidence |
|-------|--------|----------|
| HMAC verify (SHA256) | ✅ | [billing.ts:127-129](file:///home/kangza/workspace/modulajar/apps/api-ts/src/routes/billing.ts#L127-L129) |
| Constant-time compare | ⚠️ | [crypto.ts:7-16](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/crypto.ts#L7-L16) — length leak |
| Replay protection (unique provider_event_id) | ✅ | [billing.ts:169-180](file:///home/kangza/workspace/modulajar/apps/api-ts/src/routes/billing.ts#L169-L180) |
| Idempotent credit ledger | ✅ | [wallet.ts:66-74](file:///home/kangza/workspace/modulajar/apps/api-ts/src/lib/wallet.ts#L66-L74) |

---

## 4. Reliability & Determinism Audit

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **Append-only ledger** — no UPDATE/DELETE on wallet_ledger | ✅ PASS | [wallet.ts:1-10](file:///home/kangza/workspace/modulajar/apps/api-ts/src/lib/wallet.ts#L1-L10) (docstring), INSERT+ON CONFLICT only |
| **Derived balance** — SUM(credits)-SUM(debits), no mutable column | ✅ PASS | [wallet.ts:34-47](file:///home/kangza/workspace/modulajar/apps/api-ts/src/lib/wallet.ts#L34-L47) |
| **Debit atomic** — CTE balance check + INSERT in one statement | ✅ PASS | [wallet.ts:98-114](file:///home/kangza/workspace/modulajar/apps/api-ts/src/lib/wallet.ts#L98-L114) |
| **Credit idempotent** — ON CONFLICT DO NOTHING | ✅ PASS | [wallet.ts:66-74](file:///home/kangza/workspace/modulajar/apps/api-ts/src/lib/wallet.ts#L66-L74) |
| **Queue atomic lock** — FOR UPDATE SKIP LOCKED | ✅ PASS | [db.go:100-118](file:///home/kangza/workspace/modulajar/apps/core-go/db/db.go#L100-L118) |
| **Queue backoff** — exponential (5×2^n), max 5 attempts | ✅ PASS | [db.go:173-192](file:///home/kangza/workspace/modulajar/apps/core-go/db/db.go#L173-L192) |
| **PDF integrity** — sha256 computed/stored, fail if no Chrome | ✅ PASS | [worker.go:432-434](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L432-L434), [worker.go:436-437](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L436-L437) |
| **Worker readiness** — checks DB ping + Chrome availability | ✅ PASS | [worker.go:569-589](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L569-L589) |
| **Workspace isolation** — queries scoped by workspace_id | ✅ PASS | All queries in workspace.ts, generate.ts, billing.ts |
| **Receipts persisted** — pdf_sha256, html_sha256, watermark_summary, ai_receipt | ✅ PASS | [worker.go:380-413](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L380-L413), [worker.go:466-478](file:///home/kangza/workspace/modulajar/apps/core-go/worker/worker.go#L466-L478) |

### Reliability Gaps

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| R1 | **Debit-after-job race** — Job is created before debit; if debit fails, job exists without charge | **RESOLVED** | Fixed in PR-071: Wallet debit moved *before* job insertion in `generate.ts` and `modules.ts`. |
| R2 | **API readyz trivial** — Always returns ok, doesn't verify DB connectivity | High | [index.ts:93](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts#L93) |

---

## 5. Observability Coverage

### 5.1 api-ts

| Check | Status | Evidence |
|-------|--------|----------|
| `/metrics` endpoint (Prometheus) | ✅ | [index.ts:83-86](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts#L83-L86) |
| `http_requests_total` counter | ✅ | [metrics.ts:8-13](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L8-L13) |
| `http_request_duration_ms` histogram | ✅ | [metrics.ts:15-21](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L15-L21) |
| `wallet_debit_total`, `wallet_debit_failed_total` | ✅ | [metrics.ts:29-40](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L29-L40) |
| `wallet_balance_checks_total`, `wallet_transactions_total` | ✅ | [metrics.ts:23-27, 42-47](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L23-L27,L42-L47) |
| `generate_requests_total` | ✅ | [metrics.ts:49-54](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L49-L54) |
| Trace/correlation ID (`x-trace-id` → reqId) | ✅ | [index.ts:24](file:///home/kangza/workspace/modulajar/apps/api-ts/src/index.ts#L24) |
| Structured JSON logging (pino) | ✅ | [logger.ts](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/logger.ts) |
| Default process metrics (CPU/RAM) | ✅ | [metrics.ts:6](file:///home/kangza/workspace/modulajar/apps/api-ts/src/utils/metrics.ts#L6) |

### 5.2 core-go / worker

| Check | Status | Evidence |
|-------|--------|----------|
| `/metrics` endpoint (Prometheus) | ✅ | [main.go:60](file:///home/kangza/workspace/modulajar/apps/core-go/cmd/worker/main.go#L60) |
| `jobs_acquired_total`, `job_duration_ms`, `job_retries_total`, `job_failures_total` | ✅ | [metrics.go:13-38](file:///home/kangza/workspace/modulajar/apps/core-go/metrics/metrics.go) |
| `gcs_upload_total` | ✅ | [metrics.go:34-38](file:///home/kangza/workspace/modulajar/apps/core-go/metrics/metrics.go) |
| Queue gauge collector (queued/running/failed) | ✅ | [metrics.go:40-70](file:///home/kangza/workspace/modulajar/apps/core-go/metrics/metrics.go) |
| Trace ID propagated from request → job metadata | ✅ | [generate.ts:166-179](file:///home/kangza/workspace/modulajar/apps/api-ts/src/routes/generate.ts#L166-L179) |

### 5.3 Observability Gaps

| # | Gap | Severity |
|---|-----|----------|
| O1 | No dashboard documentation (metric names, Grafana JSON, or alerting rules) | Low |
| O2 | Worker logs use `log/slog` but no explicit `trace_id` correlation from job metadata to log fields | Medium |
| O3 | **UX Drift**: Several pages (Editor, Detail) were previously orphans; linked in PR-071 via Riwayat. | **FIXED** | [UI_CONSOLE_AUDIT.md](file:///home/kangza/workspace/modulajar/docs/UI_CONSOLE_AUDIT.md) |

---

## 6. Summary of All Findings by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| **Critical** | 2 | S1, S2 |
| **High** | 3 | S3, S4, S5 |
| **Medium** | 4 | S6, S7, D1, O2 (R1 resolved) |
| **Low** | 3 | D2, D4, O1 |

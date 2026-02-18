# Full Institutional Audit Report
**Date:** 2026-02-18
**Auditor:** Antigravity (Google Deepmind)
**Branch:** `pr-audit-full-system-report`
**Commit:** `3b737fd8050e14f8b8f312a9290ff9c50c172ec5`

---

## 1. Executive Summary

**Institutional Readiness Score: 60% (Not Yet Ready)**

The repository exhibits a solid foundation with clear separation of concerns (`api-ts` vs `core-go`), strong data integrity via PostgreSQL constraints/migrations, and a recently hardened Verify service. However, **critical security and operational gaps** prevent it from being "Institutional Ready". The absence of CORS configuration renders the API unusable for browser-based clients, and the lack of webhook signature verification opens the door to financial fraud risks. Additionally, the Worker service lacks a proper readiness probe to ensure Chrome availability, posing a reliability risk.

---

## 2. Risk Matrix

| Severity | Issue | Impact |
| :--- | :--- | :--- |
| **CRITICAL** | **Missing CORS Configuration** | Public API endpoints (`/verify`) will effectively fail for browser clients. |
| **CRITICAL** | **Missing Webhook Signature Verification** | `POST /internal/webhooks/payment/confirm` accepts any payload with a valid ID, enabling potential balance spoofing. |
| **HIGH** | **Missing Readiness Probe (Worker)** | Worker service reports healthy even if Chrome is crashed or missing, leading to silent PDF generation failures. |
| **MEDIUM** | **Soft Failure on PDF Generation** | If PDF generation fails, the job can still be marked "completed", potentially leaving the document in a mixed state (HTML ok, PDF missing). |
| **LOW** | **No Rate Limiting on Internal Routes** | Internal routes (`/internal`) rely solely on network isolation, lacking application-layer rate limiting. |

---

## 3. Phase-by-Phase Audit Details

### Phase 1: Repo Structure (PASS)
- **Architecture**: Clean monorepo with `apps` (api-ts, worker-go) and `packages` (core-go).
- **Environment**: Sensitive configuration managed via `.env` (simulated via `env-*.yaml`), secrets not committed.
- **Build**: Dockerfiles utilize multi-stage builds. `worker-go` correctly installs `chromium`.

### Phase 2: Data & Ledger Integrity (PASS)
- **Wallet**: `wallet_ledger` enforced with `UNIQUE(workspace_id, reference_id, type)` and `CHECK(amount > 0)`.
- **Jobs**: `generation_jobs` uses composite `UNIQUE(workspace_id, generation_id)` and status constraints.
- **Documents**: Schema supports hardening via `metadata` JSONB column.

### Phase 3: Verify Service Hardening (PASS)
- **Strictness**: `verify.ts` strictly queries `status='done'`.
- **Privacy**: Response payload is minimized to non-sensitive fields.
- **Anti-Abuse**: In-memory rate limiting (60 req/min) and entropy checks are implemented.

### Phase 4: PDF & Artifact Integrity (PARTIAL PASS)
- **Integration**: `chromedp` correctly integrated with `render` package.
- **Storage**: SHA256 hashes capture for both PDF and HTML. GCS paths are workspace-scoped.
- **Defect**: Worker logic logs a warning and *continues* if PDF generation fails, rather than failing the job.

### Phase 5: Security Surface (FAIL)
- **CORS**: No `fastify-cors` plugin registered in `api-ts/src/index.ts`.
- **Webhooks**: `billing.ts` endpoint `/internal/webhooks/payment/confirm` validates `external_ref` existence but performs **NO cryptographic signature verification**.
- **Input Validation**: `verify` endpoint input is sanitized.

### Phase 6: Observability (MIXED)
- **Metrics**: `/metrics` endpoint available in `api-ts`.
- **Liveness**: `/healthz` present in both services.
- **Readiness**: `worker-go` **lacks** a `/readyz` endpoint that checks for Chrome availability.

### Phase 7: Performance (PASS)
- **Concurrency**: Cloud Run configured for concurrency: 1.
- **Memory**: PDF bytes held in memory before write, but low concurrency mitigates risk.

---

## 4. Required Fixes (To Achieve Readiness)

1.  **Implement CORS**: Register `fastify-cors` in `apps/api-ts/src/index.ts` with strict origin whitelist.
2.  **Secure Webhooks**: Add signature verification middleware for `/internal/webhooks/payment/*` (checking X-Signature header).
3.  **Add Worker Readiness**: Implement `/readyz` in `apps/worker-go/main.go` that executes a trivial `chromedp` action (e.g., `Browser.Version`) to confirm capability.
4.  **Harden PDF Failure**: Modify `worker.go` to mark the job as `failed` (or retryable) if PDF generation errors out, preventing "partial success" states.

---

## 5. Final Verdict

**NOT YET INSTITUTIONAL READY**

The system requires immediate remediation of the **Security** and **Reliability** findings listed above before it can be considered production-grade for institutional use.

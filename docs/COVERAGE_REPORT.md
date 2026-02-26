# Modulajar — Coverage Report (Institutional Grade)

**Date**: 2026-02-26
**Branch**: `main` (commit `b8e1a20`)

---

## Coverage Gates (CI-Enforced)

| Target | Metric | Gate | Last Known | Status |
|--------|--------|------|-----------|--------|
| **api-ts** | Lines | ≥ 90% | ~94% | ✅ |
| **api-ts** | Branches | ≥ 80% | ~81% | ✅ |
| **core-go** | Total | ≥ 80% | ~83% | ✅ |
| **core-go** | Worker pkg | ≥ 80% | ~80% | ✅ |

> Gate enforcement: [ci.yaml:65-79](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L65-L79) (api-ts), [ci.yaml:145-151](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L145-L151) (core-go total), [ci.yaml:153-173](file:///home/kangza/workspace/modulajar/.github/workflows/ci.yaml#L153-L173) (worker pkg)

---

## api-ts — Test File Inventory

| Test File | Route/Module Covered | Key Scenarios |
|-----------|---------------------|---------------|
| `auth.test.ts` | `routes/auth.ts` | Auth flow, Clerk integration |
| `workspace.test.ts` | `routes/workspace.ts` | Ping, documents, workspace identity (GET/PATCH), jenjang mapping, NPSN validation |
| `generate.test.ts` | `routes/generate.ts` | Idempotency, concurrency guard, balance check, package lifecycle, branch coverage |
| `billing.test.ts` | `routes/billing.ts` | Topup intent, summary, webhook HMAC verify, replay protection, credit idempotency |
| `billing-webhook.test.ts` | Webhook edge cases | Invalid signature, malformed payload, duplicate events |
| `verify.test.ts` | `routes/verify.ts` | Rate limiting, anti-enumeration, document lookup |
| `download.test.ts` | `routes/documents.ts` | Signed URL generation, error handling |
| `cors.test.ts` | CORS policy | Strict origin whitelist, preflight |
| `tenant-isolation.test.ts` | Cross-tenant prevention | Workspace guard enforcement |
| `integration.test.ts` | E2E flow | Generate → job lifecycle |
| `utils.test.ts` | `utils/rate-limit.ts`, `utils/crypto.ts` | RateLimiter, constant-time compare |

### api-ts Remaining Gaps

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| No test for `PATCH /w/:wid/workspace` being blocked by CORS (methods: GET/POST only) | Branch miss on CORS OPTIONS | Low — add CORS preflight test with PATCH |
| No test for `readyz` endpoint (currently trivial) | Function miss | Low — trivial test |
| No negative test for `PID_SECRET` missing in production | Branch miss | Low |

---

## core-go — Package Coverage Breakdown

| Package | Role | Gate | Notes |
|---------|------|------|-------|
| `worker/` | Job execution pipeline | ≥ 80% | Core business logic; covers planner, validator, HTML, PDF, GCS |
| `db/` | Database operations | No gate | AcquireJob, MarkJobDone, MarkJobFailed covered by integration tests |
| `render/` | HTML composition + PDF | No gate | Covered via worker tests |
| `curriculum/` | Curriculum data loading | No gate | Utility; tested indirectly |
| `docgraph/` | Document graph builder | No gate | Tested via worker integration |
| `metrics/` | Prometheus collectors | No gate | Has dedicated `metrics_test.go` |
| `planner/` | Lesson planning | No gate | Tested via worker integration |
| `validator/` | Content validation | No gate | Tested via worker integration |
| `cmd/worker/` | Main entrypoint | No gate | `Bootstrap` test exists |

### core-go Remaining Gaps

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| No per-package coverage gates for `db/`, `render/` | Could regress without notice | Medium — add per-package CI gates |
| `db/` package has no standalone unit tests (relies on integration) | Hard to pinpoint DB layer bugs | Medium — mock-based tests |
| `cmd/worker/main_test.go` tests only the init sequence, not HTTP handlers | Low coverage of handler paths | Medium |

---

## Recommendations

1. **Add `PATCH` to CI CORS gate test** to catch the current GET/POST-only misconfiguration
2. **Add per-package core-go gates** for `db/` (≥ 80%) and `render/` (≥ 70%)
3. **Add negative-path tests** for missing env vars (`PID_SECRET`, `PAYMENT_WEBHOOK_SECRET`)

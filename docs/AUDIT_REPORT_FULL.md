# Audit Report: Modulajar

**Branch:** `main` (incorporating PRs 029–031)
**Date:** 2026-02-25
**Auditor:** Antigravity

---

## 1. Executive Summary

The `modulajar` repository has reached **INDUSTRIAL READINESS+** — security, integrity, and observability baselines are all met, and critical test coverage gaps from the previous audit have been closed.

**Readiness Score: A**
*(Previous: A−. Upgraded after closing docgraph 0% coverage, auth route tests, CI Chromium, and worker-go go.mod drift.)*

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Security** | 🟢 PASS | Webhook HMAC, CORS, Rate Limits verified |
| **Integrity** | 🟢 PASS | PDF + GCS both enforced as hard-fails |
| **Reliability** | 🟢 PASS | 73.4% core-go total; ExecuteJob 90.4%; DB concurrency verified |
| **Maintainability** | 🟢 PASS | DI wired throughout worker; all CI checks green |
| **Coverage** | 🟡 GOOD | `real_deps.go` & `console-web` still 0% (by design / low-risk) |

---

## 2. Coverage Summary (core-go — as of PR-030)

| Package | Coverage | Trend |
| :--- | :--- | :--- |
| `worker.ExecuteJob` | **90.4%** | ↑ from 74.6% |
| `worker.NewHandler` | 79.2% | stable |
| `render` | 88.4% | stable |
| `validator` | ~88% | stable |
| `planner` | 86.2% | stable |
| `metrics` | 90.0% | stable |
| `curriculum` | 87.3% | stable |
| `adapters/ai` | 81.8% | stable |
| `packloader` | ~84% | stable |
| `docgraph` | **~95%** | ↑ from **0%** |
| `db` | ~72% | DB-dep |
| `worker/real_deps.go` | 0% | by design — thin wrappers |
| **Total (core-go)** | **73.4%** | ↑ from 70% |

### api-ts
| Route | Coverage | Notes |
| :--- | :--- | :--- |
| `auth.ts` | **90.5%** | ↑ from **0%** — PR-030 |
| `generate.ts` | ~88% | stable |
| `billing.ts` | ~85% | stable |
| `billing-webhook.ts` | ~90% | stable |
| `verify.ts` | ~82% | stable |
| `workspace.ts` | ~70% | medium gap |

---

## 3. Industrial Readiness Checks

### 3.1 PDF + GCS Hard-Fail (PR-029)
- **Criterion:** Job cannot be marked done without PDF generation AND GCS upload both succeeding.
- **Status:** ✅ PASS
- **Evidence:**
  - `worker.go`: PDF failure → immediate `return nil, fmt.Errorf("PDF render failed: …")` (hard error, no soft skip)
  - `worker.go`: GCS upload failure → `return nil, fmt.Errorf("GCS upload failed: …")`
  - Test coverage: `TestExecuteJob_PDFFail`, `TestExecuteJob_GCSFail` — both assert hard error return

### 3.2 Webhook Security
- **Criterion:** HMAC verification, constant-time compare, replay protection.
- **Status:** ✅ PASS
- **Evidence:**
  - `billing.ts:127` — `createHmac('sha256', secret)` signed payload
  - `billing.ts:5` — `constantTimeCompare` (timing-safe)
  - `billing.ts:175` — UNIQUE constraint on `provider_event_id` blocks replay

### 3.3 Verify Endpoint
- **Criterion:** Minimal payload, `status='done'` only, rate limiter.
- **Status:** ✅ PASS
- **Evidence:**
  - `verify.ts:6` — Rate limiter (60 req/min)
  - `verify.ts:31` — `WHERE status = 'done'` enforced
  - `verify.ts:48` — Returns only SHA256, dates, masked metadata

### 3.4 CORS
- **Criterion:** Strict whitelist, no wildcard.
- **Status:** ✅ PASS
- **Evidence:**
  - `index.ts` — allowedOrigins: `['https://modulajar.app', 'https://app.modulajar.app', 'http://localhost:3000']`

### 3.5 Readiness Probes
- **Criterion:** `/readyz` checks both DB + Chrome.
- **Status:** ✅ PASS
- **Evidence:**
  - `worker-go/main.go` — `worker.ReadinessHandler(db.Ping, render.CheckChromeReadiness)`
  - `TestReadinessHandler` in `worker_test.go`

### 3.6 Tenant Isolation (PR — tenant isolation)
- **Criterion:** Workspace separation enforced at DB level.
- **Status:** ✅ PASS  
- **Evidence:**
  - `migrations/002_tenant_isolation.sql` — RLS policies on all shared tables
  - `tenant-isolation.test.ts` — 7 cross-tenant access tests pass

### 3.7 DB Concurrency Safety (PR-031)
- **Criterion:** Queue operations are serializable under concurrent load.
- **Status:** ✅ PASS
- **Evidence:**
  - `db_test.go` — `TestAcquireJob_SkipLocked` verifies `SELECT FOR UPDATE SKIP LOCKED`
  - `TestConcurrentAcquire` confirms no double-acquisition under 10 concurrent goroutines

### 3.8 CI Chromium Coverage (PR-030)
- **Criterion:** Chrome-dependent tests run in CI, not skipped silently.
- **Status:** ✅ FIXED (was 🔴)
- **Evidence:**
  - `ci.yaml` — Added `Install Chromium` step + `CHROME_BIN` env var for `core-go` job
  - Previously: all `TestExecuteJobSuccess`, `TestHandler_Success` etc. were silently skipped in CI

### 3.9 Auth Route Coverage (PR-030)
- **Criterion:** `POST /bootstrap` transaction + idempotency tested.
- **Status:** ✅ FIXED (was 🔴)
- **Evidence:**
  - `tests/auth.test.ts` — 5 tests: 401 guard, GET /me, bootstrap new user, bootstrap idempotent, custom org_id
  - 13/13 assertions pass; 90.47% line coverage on `auth.ts`

### 3.10 Document Identity Coverage (PR-030)
- **Criterion:** `BuildDocGraph`, `IssueDID`, `PackageShortCode` are tested.
- **Status:** ✅ FIXED (was 🔴 — 0% coverage)
- **Evidence:**
  - `docgraph/docgraph_test.go` — 16 tests covering format, determinism, normalization, nil safety, sorting

---

## 4. Risk Matrix (Updated)

| Risk | Severity | Status | Notes |
| :--- | :--- | :--- | :--- |
| `docgraph` 0% coverage | 🔴 Critical | **Fixed (PR-030)** | 16 tests added, ~95% coverage |
| `auth.ts` 0% coverage | 🔴 Critical | **Fixed (PR-030)** | 5 tests, 90.47% |
| CI silently skips Chromium tests | 🔴 Critical | **Fixed (PR-030)** | Chromium installed in CI |
| `worker-go` go.mod drift | 🔴 CI Red | **Fixed (PR-031)** | `go mod tidy` committed |
| `worker.ExecuteJob` coverage low | 🔴 Critical | **Fixed (PR-029)** | 90.4% |
| PDF/GCS soft-fail risk | 🔴 Critical | **Fixed (PR-029)** | Both are hard-fails now |
| `workspace.ts` coverage ~70% | 🟡 Medium | Open | `GET/POST /workspaces` not tested |
| `real_deps.go` 0% | 🟡 Medium | Accepted | Thin wrappers — low regression risk |
| `console-web` 0 test files | 🟡 Medium | Open | No test framework configured |
| CI no coverage threshold | 🟡 Medium | Open | Could regress silently |

---

## 5. Open Items (Remaining Gaps)

| # | Item | Priority | Effort |
| :--- | :--- | :--- | :--- |
| 1 | Add `workspace.ts` tests (GET/POST /workspaces) | Medium | ~2h |
| 2 | Add CI coverage threshold enforcement (`go tool cover` fail-if-below) | Medium | 30min |
| 3 | Add basic smoke tests for `console-web` (Playwright or basic render test) | Low | ~4h |
| 4 | Cover `NewRealWorker` bootstrap path (integration tag) | Low | ~1h |

---

## 6. PR Change Log

| PR | Title | Status | Key Impact |
| :--- | :--- | :--- | :--- |
| PR-021 | Observability Hygiene | ✅ Merged | Structured logging everywhere |
| PR-022 | Gemini Adapter | ✅ Merged | AI abstraction layer |
| PR-023 | Curriculum Schema | ✅ Merged | ATP pack format |
| PR-024 | PDF Generation | ✅ Merged | chromedp render pipeline |
| PR-025 | Wallet + Payment Ledger | ✅ Merged | Credit system |
| PR-026 | Payment Events + Webhook | ✅ Merged | Stripe webhook security |
| PR-027 | CORS Hardening | ✅ Merged | Strict whitelist CORS |
| PR-028 | Worker Readiness | ✅ Merged | `/readyz` with real DB + Chrome probes |
| PR-029 | Hard-Fail PDF+GCS | ✅ Merged | 90.4% ExecuteJob coverage |
| PR-030 | Coverage Hardening | ✅ CI Green | docgraph+auth tests, CI Chromium |
| PR-031 | DB Concurrency + go.mod fix | ✅ CI Green | Concurrency lock test, worker-go mod sync |

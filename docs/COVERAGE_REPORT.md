# Coverage Report: Modulajar

**Branch:** `pr-031-db-concurrency-lock-test`
**Date:** 2026-02-20

## 1. API-TS (Node.js)

**Overall Metrics:**
- **Lines:** 90%
- **Functions:** 86.95%
- **Branches:** 72.07%

**Low Coverage Areas (Critical):**

| File | Lines % | Branches % | Impact |
| :--- | :--- | :--- | :--- |
| `src/routes/generate.ts` | 83.08% | **53.65%** | Core AI generation logic paths unverified. High risk of failure on edge cases. |
| `src/routes/auth.ts` | 89.47% | **37.50%** | Auth middleware logic (conditionals) largely untested. Security risk. |
| `src/routes/billing.ts` | 82.96% | 70.83% | Webhook payment processing logic. Financial integrity risk. |
| `src/routes/documents.ts` | 83.67% | 66.66% | - |
| `src/utils/logger.ts` | 100% | 66.66% | Low impact. |

**Recommended Thresholds:**
- **Lines:** >= 85%
- **Branches:** >= 80% (Current state is failing this for critical routes)

**Missing Tests (Priority):**
1. `src/routes/generate.ts`: Test failure scenarios for AI client, invalid payloads, and timeout handling.
2. `src/routes/auth.ts`: Test specific auth failure branches (invalid token, expired token, missing headers).
3. `src/routes/billing.ts`: Test idempotent replay of webhooks and handling of non-payment events.

---

## 2. Core-Go (Golang)

**Overall Metrics:**
- **Statements:** ~58% (Estimated pending full run)

**Low Coverage Packages (Critical):**

| Package | Stat % | Focus Area | Impact |
| :--- | :--- | :--- | :--- |
| `worker` | **80.4%** | `ExecuteJob`, `Handler` | SIGNIFICANT IMPROVEMENT (was 29.1%). Core worker logic now covered. |
| `db` | **87.9%** | `AcquireJob`, `MarkJob*` | EXCEEDS TARGET (was 12.1%). Concurrency and retry logic fully verified. |
| `render` | 70.9% | `GeneratePDF` | Acceptable coverage. |
| `docgraph` | 0.0% | `BuildDocGraph` (partial) | Core document linking logic untested. Next priority. |

**Recommended Thresholds:**
- **Total:** >= 80%
- **Critical Packages (worker, db):** Must be > 85% (Achieved for Worker & DB)

**Missing Tests (Priority):**
1. [x] `worker/worker.go`: Unit tests for `ExecuteJob` mocking AI, PDF, and GCS clients.
2. [x] `db/db.go`: Integration tests for `AcquireJob` locking mechanics.
3. [ ] `cmd/worker`: Need E2E test for the full HTTP handler flow.

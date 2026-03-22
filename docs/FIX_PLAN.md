# Modulajar — Fix Plan (PR-034+)

**Date**: 2026-03-02
**Priority**: Security Critical → Money Integrity → Reliability → Deploy Drift → UX

---

## PR-034: Secret Rotation & Env File Purge

> **Severity**: 🔴 CRITICAL | **Blast Radius**: All services

### Scope
Rotate all leaked secrets from `env-api.yaml` and `env-worker.yaml`, remove files from repo and git history.

### Files to change
- **DELETE** `env-api.yaml`
- **DELETE** `env-worker.yaml`
- **MODIFY** `.gitignore` — add `env-*.yaml`, `*.env.yaml`

### Actions (outside codebase)
1. Rotate: Neon DB password, Clerk keys, Gemini API key, PID_SECRET, DID_SECRET
2. Update Cloud Run / GitHub Secrets with new values
3. Run `git filter-branch` or BFG to purge from history

### Tests to add/update
- None (operational task)

### Verification
```bash
git log --all --diff-filter=A -- 'env-*.yaml'  # Should show purge
grep -r "npg_qwuLhBi2gZV4" .                   # Should find nothing
```

### Rollback
Keep old secrets valid for 24h overlap window, then revoke.

---

## PR-035: CORS + Security Headers Hardening

> **Severity**: 🔴 CRITICAL (CORS) + 🟠 HIGH (headers)

### Scope
Fix CORS methods (add PATCH) and add security response headers.

### Files to change
- **MODIFY** `apps/api-ts/src/index.ts` — Add `PATCH` to CORS methods, add `@fastify/helmet` or `onSend` hook for security headers
- **MODIFY** `apps/api-ts/package.json` — Add `@fastify/helmet` dependency (if used)

### Tests to add/update
- **MODIFY** `apps/api-ts/tests/cors.test.ts` — Add PATCH preflight test
- **NEW** `apps/api-ts/tests/headers.test.ts` — Verify HSTS, X-Content-Type-Options, Referrer-Policy

### Verification
```bash
cd apps/api-ts && npm test && npm run build
```

### Rollback
Revert `index.ts` CORS config.

---

## PR-036: Constant-Time Compare Fix

> **Severity**: 🟠 HIGH

### Scope
Fix `constantTimeCompare` to not leak length information.

### Files to change
- **MODIFY** `apps/api-ts/src/utils/crypto.ts` — Pad shorter buffer before comparison

### Tests to add/update
- **MODIFY** `apps/api-ts/tests/utils.test.ts` — Add test for different-length strings

### Verification
```bash
cd apps/api-ts && npm test
```

### Rollback
Trivial revert of one function.

---

## PR-037: API Readiness Probe Hardening

> **Severity**: 🟠 HIGH

### Scope
Make `/readyz` actually check DB connectivity so Cloud Run doesn't route traffic to unhealthy instances.

### Files to change
- **MODIFY** `apps/api-ts/src/index.ts` — `readyz` handler to ping DB

### Tests to add/update
- **NEW** `apps/api-ts/tests/health.test.ts` — readyz with mock DB (pass/fail)

### Verification
```bash
cd apps/api-ts && npm test && npm run build
```

### Rollback
Revert to trivial handler.

---

## PR-038: Deploy Region Alignment

> **Severity**: 🟡 MEDIUM

### Scope
Align worker deployment region between `cloudbuild.yaml` and `deploy-worker-go.yaml`.

### Files to change
- **MODIFY** `.github/workflows/deploy-worker-go.yaml` — Change region to `asia-southeast1` (or update `cloudbuild.yaml` to `asia-southeast2` — confirm which is correct)

### Tests to add/update
- None (infra config)

### Verification
```bash
# After deploy:
gcloud run services describe modulajar-worker --region asia-southeast1
```

### Rollback
Change region back in workflow file.

---

## PR-039: Env Var Fail-Hard Guards

> **Severity**: 🟡 MEDIUM

### Scope
Fail startup if critical env vars are missing in production (no silent fallbacks).

### Files to change
- **MODIFY** `apps/api-ts/src/routes/generate.ts` — Remove `PID_SECRET` fallback, fail hard
- **MODIFY** `apps/api-ts/src/index.ts` — Fail startup if `DATABASE_URL` not set

### Tests to add/update
- **MODIFY** `apps/api-ts/tests/generate.test.ts` — Test missing PID_SECRET scenario

### Verification
```bash
cd apps/api-ts && npm test && npm run build
```

### Rollback
Restore fallback defaults.

---

## PR-040: Debit-Before-Job Atomicity Fix

> **Severity**: 🟡 MEDIUM

### Scope
Reorder generate route to debit wallet before creating the job (prevent uncharged jobs on debit failure).

### Files to change
- **MODIFY** `apps/api-ts/src/routes/generate.ts` — Move debit step before job INSERT

### Tests to add/update
- **MODIFY** `apps/api-ts/tests/generate.test.ts` — Test debit failure → no job created

### Verification
```bash
cd apps/api-ts && npm test
```

### Rollback
Revert to current order (debit-after-job with warning log).

---

## PR-041: Worker Trace ID Correlation

> **Severity**: 🟢 LOW

### Scope
Propagate `trace_id` from job metadata into structured worker log fields for end-to-end traceability.

### Files to change
- **MODIFY** `apps/core-go/worker/worker.go` — Extract `trace_id` from payload and attach to slog logger

### Tests to add/update
- **MODIFY** existing worker tests — Verify trace_id appears in log output

### Verification
```bash
cd apps/core-go && go test ./worker/...
```

### Rollback
Remove additional log field.

---

## PR-042: Observability Dashboard Documentation

> **Severity**: 🟢 LOW

### Scope
Document all metric names, recommended Grafana panels, and alerting thresholds.

### Files to change
- **NEW** `docs/OBSERVABILITY.md` — Metric names, dashboard JSON template, alert rules

### Tests to add/update
- None (docs only)

### Verification
Manual review.

### Rollback
Delete file.

---

## Summary

| PR | Title | Severity | Estimated Size |
|----|-------|----------|---------------|
| 034 | Secret Rotation & Env File Purge | 🔴 Critical | Small (ops) |
| 035 | CORS + Security Headers | 🔴 Critical | Small |
| 036 | Constant-Time Compare Fix | 🟠 High | Tiny |
| 037 | API Readiness Probe | 🟠 High | Small |
| 038 | Deploy Region Alignment | 🟡 Medium | Tiny |
| 039 | Env Var Fail-Hard | 🟡 Medium | Small |
| 040 | Debit-Before-Job Atomicity | 🟡 Medium | Small |
| 041 | Worker Trace ID | 🟢 Low | Tiny |
| 042 | Dashboard Docs | 🟢 Low | Small |

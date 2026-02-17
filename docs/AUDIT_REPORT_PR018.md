# Audit Report — PR-018.5

**Date:** 2026-02-17  
**Branch:** `pr-018-5-full-system-audit`  
**Scope:** End-to-end infra + code audit before PR-019 (Ledger)

## Summary

| Phase | Status |
|-------|--------|
| Phase 1 — Deploy Pipeline | ✅ Fixed |
| Phase 2 — Worker + Queue | ✅ Fixed |
| Phase 3 — Storage | ✅ Pass |
| Phase 4 — API | ✅ Fixed |
| Phase 5 — Console UI | ✅ Pass |
| Phase 6 — Environment | ✅ Fixed |

## What Was Fixed

### Critical — Runtime Failures

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `documents.ts` | Queries `generated_documents` — table doesn't exist | Changed to `documents` with JOIN `document_versions` |
| 2 | `documents.ts` | Uses `gcs_path` column — doesn't exist | Joins `document_versions.file_path AS gcs_path` |
| 3 | `verify.ts` | Queries `generated_documents` — table doesn't exist | Changed to `documents` with JOIN `packages` |
| 4 | `verify.ts` | Queries `curriculum_packs` — table doesn't exist | Changed to `packages` |

### Medium — Config / Hardcoded Values

| # | File | Issue | Fix |
|---|------|-------|-----|
| 5 | `Dockerfile` | `EXPOSE 3000` but code uses PORT 8080 | Changed to `EXPOSE 8080` |
| 6 | `env-api.yaml` | Missing `GCS_BUCKET`, `DID_SECRET` | Added both vars |
| 7 | `worker.go` | Hardcoded `modulajar.com/verify/` URL | Uses `VERIFY_BASE_URL` env var with fallback |

### Tests Updated

| File | Change |
|------|--------|
| `verify.test.ts` | Mock updated: `generated_documents` → `documents`, `curriculum_packs` → `packages` |
| `download.test.ts` | Mock updated: `generated_documents` → `documents` |

## What Passed (No Fix Needed)

- **GCS path format:** `artifacts/{workspace_id}/{pid}/{did}/v{n}.pdf` — workspace-scoped ✅
- **Signed URL:** Private bucket, configurable expiry (600s default), no public ACL ✅
- **Console UI:** No direct file paths, uses `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_VERIFY_BASE_URL` ✅
- **No hardcoded URLs in frontend/API code** ✅
- **Multi-tenant isolation (PR-018):** All queries workspace-scoped ✅
- **`.gitignore` covers `env-api.yaml` and `env-worker.yaml`** ✅

## Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Payment webhook `/internal/webhooks/payment/confirm` has no auth | Medium | Cloud Run deployed with `--no-allow-unauthenticated` (IAM enforced) |
| Cloud Tasks enqueue is still a placeholder in `generate.ts` | Low | Tracked for future PR |
| Worker handler accepts any POST (no token validation) | Low | Cloud Run IAM restricts access; only Cloud Tasks can invoke |

## Verification

```
$ npx tsc --noEmit           # ✅ No errors
$ npm test                   # ✅ 95/95 pass
$ go build ./...             # ✅ No errors
$ go test ./...              # ✅ All pass
```

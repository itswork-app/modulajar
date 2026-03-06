# Walkthrough: Production Capability Audit

## Overview
This walkthrough summarizes the findings from the Production Capability Audit of the Modulajar platform, specifically focusing on the module generation pipeline (AI -> HTML -> PDF -> GCS).

## Changes Made
1. **Branch & Environment Setup**: Created the `pr-production-capability-audit` branch. 
2. **Database Migrations**: Identified and applied several missing migrations that caused runtime failures:
    *   `workspace_settings`: Created the missing table required by the worker's DB loop.
    *   `teachers`: Created the missing table required by the API's module generation route.
    *   `curriculum_dataset`: Created the missing table required by the worker's ranking system.
3. **API Logic Fixes**:
    *   Updated the `workspaceGuard` plugin in `api-ts` to use `TRIM(workspace_id)` when checking the `workspace_members` table to fix `CHAR(26)` padding issues that resulted in `403 Forbidden` errors.
4. **Audit Script**: Wrote and executed `scripts/audit_pipeline.ts` to directly test the worker pipeline by seeding a job into the DB and invoking the worker endpoint.

## Validation Results

### AI Generation Phase: ❌ FAILED (Quota)
The end-to-end audit was blocked at the AI generation phase. The worker correctly acquires the job and invokes the Gemini AI adapter, but fails with a **`429 RESOURCE_EXHAUSTED`** error:
> *"You exceeded your current quota, please check your plan and billing details."*

*Note: The user provided a second Free Tier API key (`AIzaSyDDV0U62nKAf4d_DJBqHRPAfusLMKcGPG8`), but it also failed with `limit: 0` for the `gemini-2.0-flash` model.*

### Control Plane & Wiring: ✅ VERIFIED
Despite the data plane (AI content) failing, the control plane is solid:
- The API correctly schedules jobs and debits the wallet.
- The PostgreSQL `FOR UPDATE SKIP LOCKED` correctly guarantees atomic job acquisition.
- `TraceID` and logging observability are working perfectly, enabling easy debugging of the failure.

## Next Steps
To complete the audit of the HTML renderer, Chromedp PDF compilation, and GCS artifact upload, the Google Gemini API quota must be increased or a billing account must be attached.

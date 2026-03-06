# Production Capability Audit Report

## Audit Scope
This audit was conducted to verify the end-to-end module generation pipeline:
`AI Generation` → `HTML Rendering` → `PDF Compilation` → `GCS Upload` → `Database Persistence` → `Verify Service`.

## Executive Summary
The backend wiring and pipeline logic are sound, but the end-to-end test **FAILED** during the AI generation phase due to exhausted Gemini API quotas. The worker successfully acquires jobs, triggers the AI adapter, but fails when Google's rate limits are applied. 

Furthermore, several critical database migrations were missing from the environment, which have now been resolved.

## Detailed Findings

### 1. Pre-requisite Findings (Resolved)
During the audit setup, several missing dependencies and schema issues were discovered and fixed:
*   **Missing Workspace Membership**: The API layer `workspaceGuard` expected strict `CHAR(26)` membership matching which failed due to padding. Fixed using `TRIM()`.
*   **Missing Database Tables**: The `teachers` and `workspace_settings` tables were entirely missing, causing 500 errors during API invocation and worker acquisition respectively. These were manually created based on their migrations.
*   **Type Confusion in Wallet**: The `debit` function in `wallet.ts` had type mismatch errors between the amount parameters and the PostgreSQL INT column.
*   **Renamed Columns**: A migration renamed `idempotency_key` to `generation_id` in `generation_jobs`.

### 2. AI Generation (FAILED - Quota Exhausted)
*   **Status**: ❌ FAILED
*   **Details**: The worker successfully initializes the Gemini AI client and attempts to send the context payload. However, the Google Gemini API returns a `429 RESOURCE_EXHAUSTED` error: *"You exceeded your current quota, please check your plan and billing details."* A second API key was provided, but it also returned `limit: 0` for the `gemini-2.0-flash` Free Tier.
*   **Impact**: Because the pipeline is linear and dependent on the `planner_result` from the AI to construct the `docgraph` and subsequent HTML, the entire pipeline halts here. No HTML or PDF can be realistically generated without a valid JSON representation of the curriculum.

### 3. HTML Renderer (UNTESTED)
*   **Status**: ⚠️ UNTESTED
*   **Details**: Blocked by AI Generation failure.

### 4. PDF Generation & GCS Storage (UNTESTED)
*   **Status**: ⚠️ UNTESTED
*   **Details**: Blocked by AI Generation failure. The `chromedp` and GCS dependencies are correctly initialized, but no artifacts reach them.

## Conclusion & Next Steps
The system's control plane (API scheduling, Job Acquisiton via DB FOR UPDATE) is robust. The data plane (Module Generation) is completely blocked by the AI provider's limits.

**Required Action**: Upgrade the Google Cloud / Gemini API billing account to a production tier to allow the AI Generation phase to complete, re-enabling the rest of the pipeline audit.

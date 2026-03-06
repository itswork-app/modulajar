# UI Console Audit Report

## 1. Route Audit Findings
- **Billing Page**: **MISSING**. There is no implementation in `apps/console-web` or anywhere else in the repository. The only references to billing are backend routes and webhook handlers.
- **Module Editor Page**: **EXISTS**. Located at `w/[workspaceId]/modules/[moduleId]/edit/page.tsx` but is completely orphaned (not linked).
- **Jobs Page**: **EXISTS**. Located at `/jobs` and `/jobs/[generation_id]`.
- **Referral Page**: **EXISTS**. Located at `/referral`.
- **Onboarding Page**: **EXISTS**. Located at `/onboarding`.
- **Dashboard Page**: **EXISTS**. Located at `/` (root dashboard).
- **Letterhead / School Setup**: **EXISTS**. Located at `/workspace/letterhead` and `/workspace/school-setup`.

## 2. Navigation Audit Findings
- The UI Sidebar (`components/ui/sidebar.tsx`) only included links to:
  - Dashboard
  - Buat Baru
  - Identitas Sekolah
  - Kop Surat
- **Missing Sidebar Links**:
  - `Riwayat Pekerjaan` (Jobs)
  - `Referral`
- **Missing In-App Navigation**:
  - The `Jobs Detail` page (`/jobs/[generation_id]`) had a button to download PDFs but completely omitted a button to open the **Module Editor**.

## 3. App Target & Middleware Audit
- All existing UI pages are correctly placed inside `apps/console-web`.
- Middleware (`middleware.ts`) protects all routes properly, requiring authentication. No misconfigured redirects were found that would unintentionally block routes.
- The route guards in components manually check prerequisites (like school setup profiles) and redirect accordingly, which functions as expected.

## 4. Deploy & Feature Flag Audit
- Assuming Vercel is set to deploy `apps/console-web` from `main`, the issue was purely route un-reachability (orphaned pages) rather than deployment caching or feature flags.
- No feature flags were found hiding the billing or editor components.

## 5. Fixes Applied
1. **Sidebar Wiring**: Added `Riwayat Pekerjaan` (`/jobs`) and `Referral Program` (`/referral`) to `components/ui/sidebar.tsx`.
2. **Editor Wiring**: Added an "Edit Modul" button inside `jobs/[generation_id]/page.tsx` to link to the corresponding `w/[workspaceId]/modules/[moduleId]/edit` route. 
*(Note: Billing cannot be linked yet because the page physically does not exist).*

## 6. Remaining Gaps
- **Billing**: The entire frontend UI for Billing needs to be designed and implemented. It currently does not exist.

# Console Audit Report - ModulAjar

**Date:** March 10, 2026
**Project:** `apps/console-web`
**Status:** Audit Complete

## Executive Summary
The ModulAjar Console frontend (`apps/console-web`) is a Next.js 15+ application using the App Router. The audit reveals a high-quality, modern UI surface with some divergent implementation paths. While the primary user journey (Wizard-based generation) is well-implemented and aesthetically premium, there are parallel "legacy" or "alternative" flows and several placeholder pages (`Dataset AI`, `Templates`, `Settings`) that need attention before a full launch.

## Console Architecture
The project follows a standard Next.js App Router structure with a grouping layout for dashboard routes.

### Project Structure
```
apps/console-web
├── app
│   ├── (dashboard)         # Authenticated layout with Sidebar
│   │   ├── billing        # Credits and transaction history
│   │   ├── dataset        # Placeholder for AI training data
│   │   ├── modules        # Generation history and details
│   │   ├── referral       # Referral program
│   │   ├── settings       # Placeholder for user settings
│   │   ├── templates      # Placeholder for template library
│   │   ├── wizard         # Primary Generation Wizard (Newer)
│   │   └── w/[workspaceId] # Dynamic workspace routes
│   ├── profile-setup       # Teacher profile onboarding
│   ├── test-wizard        # UI Audit/Dev testing route
│   ├── workspace          # Workspace/School setup
│   └── layout.tsx         # Root layout with ClerkProvider
├── components
│   ├── billing            # Billing specific UI
│   ├── wizard             # Multi-step wizard components (Alternative flow)
│   ├── ui                 # Shared UI library (Sidebar, buttons, etc.)
│   └── generate-form.tsx  # Older generation form component
├── hooks                  # Custom hooks (e.g., use-workspace.ts)
└── lib                    # Shared utilities
```

## Route Inventory
| Route | Purpose | Component Entry Point | API Calls Used | Status |
|---|---|---|---|---|
| `/` | Dashboard Overview | `app/(dashboard)/page.tsx` | `/usage-summary` | Working |
| `/wizard` | Primary Module Gen | `app/(dashboard)/wizard/page.tsx` | `/profile`, `/school`, `/modules/generate` | Working |
| `/modules` | Generation History | `app/(dashboard)/modules/page.tsx` | `/documents` | Working |
| `/modules/[id]` | Job Status & Result | `app/(dashboard)/modules/[id]/page.tsx`| `/jobs/[id]`, `/modules/[id]` | Working |
| `/billing` | Wallet & Transactions | `app/(dashboard)/billing/page.tsx` | `/wallet/summary`, `/wallet/transactions` | Working |
| `/dataset` | Training Context | `app/(dashboard)/dataset/page.tsx` | None | Placeholder |
| `/templates` | Blueprint Library | `app/(dashboard)/templates/page.tsx` | None | Placeholder |
| `/settings` | User Preferences | `app/(dashboard)/settings/page.tsx` | None | Placeholder |
| `/profile-setup`| User Profile Entry | `app/profile-setup/page.tsx` | `/profile` (GET/POST) | Working |
| `/workspace/school-setup` | School Identity Entry | `app/workspace/school-setup/page.tsx` | `/school` (GET/POST) | Working |
| `/referral` | Referral link | `app/(dashboard)/referral/page.tsx` | `/referral` (GET) | Working |

## Navigation Map
*   **Sidebar (Primary):**
    *   Dashboard (`/`)
    *   Buat Modul (`/wizard`)
    *   Riwayat Modul (`/modules`)
    *   Template Library (`/templates`) — *Placeholder*
    *   Dataset AI (`/dataset`) — *Placeholder*
    *   Billing (`/billing`)
    *   Referral Program (`/referral`)
    *   Workspace (`/workspace`)
    *   Pengaturan (`/settings`) — *Placeholder*
*   **Hidden/Flow-dependent:**
    *   `/profile-setup` (Auto-redirect if profile missing)
    *   `/workspace/school-setup` (Auto-redirect if school info missing)
    *   `/modules/[id]` (Redirect after generation start)

## User Journey Analysis
1.  **Onboarding/Bootstrap Flow:**
    *   User signs in via Clerk.
    *   `useWorkspace` hook checks `/me`. If null, calls `/bootstrap`.
    *   If Teacher Profile is missing, redirect to `/profile-setup`.
    *   If School Identity is missing, redirect to `/workspace/school-setup`.
2.  **Module Generation Flow:**
    *   Dashboard -> `/wizard`.
    *   Step 1: Choose Path (Template vs From Scratch).
    *   Step 2: Define Target Ajar (Subject, Grade, etc.).
    *   Step 3: Review.
    *   Submission -> Redirect to `/modules/[job_id]`.
    *   Polling: `/modules/[job_id]` polls `/jobs/[id]` for status (Exponential backoff).
3.  **Billing Flow:**
    *   View Credits -> `/billing`.
    *   Top Up -> Modal (Stripe/Payment gateway integration not fully visible).
    *   Redeem Voucher -> Modal.

## Workspace Profile Handling
The UI explicitly captures and stores:
*   **School Identity:** `school_display_name`, `kab_kota`, `provinsi`, `alamat`, `school_npsn`.
*   **Teacher Profile:** `full_name`, `primary_subject`, `primary_grade`, `nip`.
*   **Data Usage:** Propagated to `/modules/generate` to prepopulate document headers.

## Generation Flow Analysis
*   **Trigger:** `app/(dashboard)/wizard/page.tsx` calls `/w/[id]/modules/generate`.
*   **Polling:** Exponential backoff (1s, 2s, 4s, 8s) up to 5 minutes.
*   **Job States:** Handles `QUEUED`, `RUNNING`, `DONE`, `FAILED` accurately in UI.
*   **Completion:** Shows Download (PDF) and Edit Modul (Link) buttons.

## Billing UI Analysis
*   **Summary:** Uses `/wallet/summary` for credits and document counts.
*   **Transactions:** Uses `/wallet/transactions` for history.
*   **Deficit Handling:** Dashboard shows "Generasi Gagal" but no explicit "Low Credit" warning before starting a job was seen in the monolithic wizard (though it might be server-side).

## Document UI Analysis
*   **Preview:** No direct PDF embed seen; uses "Unduh Dokumen (PDF)" links.
*   **Metadata:** Document receipts (SHA-256 hashes) are shown for completed documents.
*   **History:** List view provides quick access to "Pantau" (Active) or "Unduh" (Done).

## API Integration Map
| Endpoint | Method | Workspace ID | Usage Location |
|---|---|---|---|
| `/me` | GET | N/A | `lib/hooks/use-workspace.ts` |
| `/bootstrap` | POST | N/A | `lib/hooks/use-workspace.ts` |
| `/usage-summary` | GET | `prop` | `app/(dashboard)/page.tsx` |
| `/w/:id/profile` | GET/POST| `url` | `profile-setup`, `wizard`, `modules/[id]` |
| `/w/:id/school` | GET/POST| `url` | `school-setup`, `wizard`, `modules/[id]` |
| `/w/:id/modules/generate` | POST | `url` | `app/(dashboard)/wizard/page.tsx` |
| `/w/:id/jobs/:jid`| GET | `url` | `app/(dashboard)/modules/[id]/page.tsx` |
| `/w/:id/documents`| GET | `url` | `app/(dashboard)/modules/page.tsx` |
| `/w/:id/wallet/summary` | GET | `url` | `app/(dashboard)/billing/page.tsx` |
| `/w/:id/wallet/transactions` | GET | `url` | `app/(dashboard)/billing/page.tsx` |

## Dead Code Findings
*   `app/test-wizard`: Developmental tool, should not be in production.
*   `app/(dashboard)/w/[workspaceId]/modules/new`: Fragmented alternative wizard flow that uses separate components (`components/wizard/*`).
*   `components/generate-form.tsx`: Older version of generation logic using `/internal/generate-semester`.
*   `components/wizard/*`: Only used by the non-sidebar "new" route and `test-wizard`.

## UX Gaps & Recommendations
1.  **Divergent Flows:** Consolidate the two generation wizards (`/wizard` vs `/w/[id]/modules/new`).
2.  **Placeholders:** Replace "Coming Soon" messages in `Dataset AI` and `Templates` with minimal MVP lists or hide them if not ready.
3.  **Onboarding:** Transitioning between `profile-setup` and `school-setup` is currently via redirects; a unified "Onboarding Wizard" would feel smoother.
4.  **Error States:** Missing comprehensive "No Credits" state in the generation wizard.
5.  **Settings:** Empty settings page is a major gap for professional users who might want to change their school info or NIP.

## Refactor Recommendations
*   **PR-C2:** Consolidate Onboarding into a single unified workspace setup wizard.
*   **PR-C3:** Finalize the monolithic `/wizard` as THE generation entry point and remove/deprecate `modules/new`.
*   **PR-C5:** Performance clean-up: Remove the 3-second polling interval in `modules/page.tsx` in favor of SWR or a more passive update unless user is actively viewing a pending job.

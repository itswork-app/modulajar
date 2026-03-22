# Console Navigation Map

*Last updated: PR-C4*

## Final Navigation Structure (Production)

| # | Label | Route | Status |
|---|---|---|---|
| 1 | Dashboard | `/` | ✅ Live |
| 2 | Buat Modul | `/wizard` | ✅ Live (Wizard v2) |
| 3 | Riwayat Modul | `/modules` | ✅ Live |
| 4 | Billing | `/billing` | ✅ Live |
| 5 | Referral | `/referral` | ✅ Live |
| 6 | Workspace | `/workspace` | ✅ Live |
| 7 | Pengaturan | `/settings` | ✅ Live |

## Deprecated Routes (Removed from Sidebar)

| Route | Was | Action |
|---|---|---|
| `/templates` | Template Library | Removed from sidebar. Guard page in place. |
| `/dataset` | Dataset AI | Removed from sidebar. Guard page in place. |

## Hidden Placeholder Features

These routes still exist in the filesystem but are **not linked from sidebar navigation**.
They show a "Coming Soon" guard page if accessed directly.

- `/templates`
- `/dataset`

## Legacy Routes (Deprecated & Redirected)

| Route | Redirects To |
|---|---|
| `/test-wizard` | `/wizard` (permanent) |
| `/w/:workspaceId/modules/new` | `/wizard` (permanent) |
| `/profile-setup` | `/onboarding` (permanent) |
| `/workspace/school-setup` | `/onboarding` (permanent) |

## Generation Entry Point

`/wizard` is the **single canonical** generation entry point.
No sidebar links or in-app buttons should point to any other generation route.

## Route Protection

All routes under `/(dashboard)` are protected by Clerk auth middleware in `middleware.ts`.
Workspace context is resolved via `useWorkspace()` hook — missing workspace redirects to bootstrap.

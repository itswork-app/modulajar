# PR-069: Console Navigation

## Overview
This PR implements the fundamental console navigation and route wiring for the new Apple-grade SaaS design in ModulAjar. It updates the layout structure, sidebar navigation, empty states, and route consistency across the console web app.

## Changes

1. **Global Layout & Structure**
   - Transformed the `DashboardLayout` in `app/(dashboard)/layout.tsx` to handle a persistent `Sidebar` and a new `Header` component.
   - The `Header` houses the Workspace Switcher, Credit Balance, and User Profile menu.

2. **Sidebar Navigation**
   - Updated `Sidebar` component in `components/ui/sidebar.tsx` with all the required menu items.
   - Using clean typography and active route highlights for better visual hierarchy.

3. **Dashboard Page (`/`)**
   - Redesigned the primary dashboard to expose clear metrics: Credit Balance, Completed Documents, Failed Generations.
   - Call to action points directly to the `/wizard` route.
   - Added `EmptyState` when the user has not generated any modules.

4. **Modules List Page (`/modules`)**
   - Implemented a clear Table-based view for generated modules featuring column names: Tanggal, Mata Pelajaran, Topik, Status, and Aksi.
   - Status chips use proper semantics (emerald, red, amber, slate).

5. **Module Details and Editor Routes (`/modules/[generation_id]` and `/modules/[generation_id]/edit`)**
   - Relocated and wired the detail view to use `/modules` as its base path.
   - Refactored the Edit action to accurately lead to `/modules/[generation_id]/edit`.

6. **Placeholders & Empty States**
   - Created a reusable `EmptyState` component.
   - Added temporary placeholder pages for `/dataset`, `/billing`, `/workspace`, `/settings`, `/templates` to ensure no dead links exist in the console navigation.

## Route Map
```text
/
├── /wizard
├── /modules
├── /modules/[id]
├── /modules/[id]/edit
├── /templates
├── /dataset
├── /billing
├── /referral
├── /workspace
└── /settings
```

This establishes the baseline infrastructure necessary to implement specific page UI polish such as Billing and Wallet UX in upcoming PRs.

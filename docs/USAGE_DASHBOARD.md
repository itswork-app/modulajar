# Usage Dashboard (PR-057)

The **Usage Dashboard** serves as the primary landing page (Home) for authenticated Workspaces. It delivers real-time usage metrics and provides a history of document generation activities out of the box.

## Core Features

1. **Credit Balance Tracking**
   Credits are computed directly from the `wallet_ledger` using double-entry logic (`SUM(credit) - SUM(debit)`). This ensures total tamper-proof integrity rather than relying on cached scalar values. 

2. **Generation Statistics**
   Aggregates the total generated packages (`DONE`) and processing errors (`FAILED`) directly from the `generation_jobs` table.

3. **Activity Log Feed**
   The dashboard reveals the 10 most recent document generation tasks with intuitive visual chips distinguishing (`QUEUED`, `RUNNING`, `DONE`, `FAILED`). It directly routes to download areas or live polling detail views.

## API Specification

**Endpoint:** `GET /w/:workspaceId/usage-summary`

**Access Control:**
- Protected by standard Clerk Authentication bearer tokens.
- Protected by `fastify.workspaceGuard` to ensure the user belongs to the requested workspace. Cross-workspace reads result in a literal `403 Forbidden`.

### Evaluation Logic
The endpoint issues 4 precise SQL commands concurrently securely scoping parameter `$1` strictly to the checked `workspaceId`.

### Future Billing Integration Point
When moving towards monetization, the Credit Balance serves as the true "Available Fund" which gating engines like the *Usage Guard (PR-046)* intercepts.

## Empty States
The dashboard incorporates an immersive visual empty state encouraging first-time users to click "Buat Modul Pertama" driving growth loops via the `/onboarding` wizard trajectory.

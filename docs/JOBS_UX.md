# Jobs Tracking UX v1

## Overview
As the primary output interface of Generation features, `/jobs` and `/jobs/[generation_id]` provide end-users a centralized dashboard indicating the statuses of asynchronous AI jobs, without compromising sensitive institutional data.

## Polling Behavior
- A lightweight React interval initiates a request to `GET /w/:workspaceId/jobs` or `GET /w/:workspaceId/jobs/:generation_id` every **3000ms**.
- This interval strictly operates **only if** the active view detects jobs trapped in `QUEUED` or `RUNNING` status blocks.
- Polling unconditionally halts immediately after detecting terminal structures (`DONE` or `FAILED`), minimizing API hits significantly compared to infinite loops.

## Data Masking & Privacy Rules
To protect PII (Personally Identifiable Information) and platform security:
- **`workspace_id` Strip**: Workspace parameters are retrieved silently from the Clerk token boundary logic and never displayed visually.
- **GCS Abstract Dumps**: We do not render Google Cloud Storage URI configurations outwardly.
- **SHA-256 Masking**: Validation hashes (HTML/PDF checksum receipts) are forcefully masked down safely to display uniquely the *first 8 characters*, mimicking GitHub SHA references concisely.

## Error Handling & Resumption
When Jobs trigger `FAILED` status events, the payload propagates into a readable error widget exposing `last_error` alongside an opportunistic **Generate Lagi** (Retry) CTA. Users seamlessly push back strictly onto `/onboarding` to adjust conditions or retry unconditionally.

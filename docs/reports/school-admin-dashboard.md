# School Admin Dashboard

## Objective
Provide workspace owners and admins with a centralized dashboard to monitor teacher activity, module production, and credit usage across the entire school workspace.

## Route
`/workspace/dashboard` — Accessible only to `owner` and `admin` roles. Teachers are redirected to `/modules`.

## Role Permission Model

| Role | Access |
|------|--------|
| `owner` | Full access |
| `admin` | Full access |
| `member` (teacher) | Redirected to `/modules` |

Role is determined from `workspace_members.role` (Postgres) and surfaced via `GET /me`.

## Dashboard Sections

### 1. Overview Metrics (Cards)
| Metric | Data Source |
|--------|------------|
| Total Guru | `COUNT(*) FROM workspace_members WHERE workspace_id = ?` |
| Total Modul | `COUNT(*) FROM generation_jobs WHERE status = 'done'` |
| Modul Bulan Ini | Same with `created_at >= date_trunc('month', NOW())` |
| Kredit Tersisa | `SUM(amount > 0) - SUM(abs(amount < 0)) FROM wallet_transactions` |
| Kredit Bulan Ini | `SUM` of negative transactions in current month |

### 2. Credit Usage Bar
Visual progress bar from `credits_remaining / credits_total`. Turns amber at <50%, red at <20%.

### 3. Module Production Chart
Bar chart (14 days) from `generation_jobs` grouped by `date_trunc('day', created_at)`. Rendered via `recharts`.

### 4. Teacher Activity Table
Per-teacher aggregation via JOIN between `workspace_members`, `teacher_profiles`, and `generation_jobs`. Sortable by **Modul** or **Terakhir Aktif**.

### 5. Recent Activity Feed
Last 20 `generation_jobs` joined with `teacher_profiles` for human-readable names.

### 6. Module Distribution by Subject
`generation_jobs` grouped by `metadata->>'subject'` — top 10 subjects with relative bar widths.

## API Endpoint
`GET /w/:workspaceId/admin/dashboard`
- Extends `workspaceGuard` with an additional role check
- Returns 403 for non-owner/admin users
- Runs 8 aggregation queries in parallel via `Promise.all`

# Wizard v2 — Implementation Report

## Overview
`/wizard` is now the single canonical document generation entry point in the console.

## Route Structure (after PR-C3)

| Route | Status |
|---|---|
| `/wizard` | ✅ Canonical — Wizard v2 (4-step) |
| `/test-wizard` | 🔁 Redirects → `/wizard` |
| `/w/[workspaceId]/modules/new` | 🔁 Redirects → `/wizard` |
| `/onboarding` | ✅ Setup flow — leads to `/wizard` |
| `/modules/[job_id]` | ✅ Job monitoring page |

## Removed / Deprecated

| File | Action |
|---|---|
| `components/generate-form.tsx` | ❌ Deleted |
| `app/test-wizard/page.tsx` | ❌ Deleted |
| `app/(dashboard)/w/[workspaceId]/modules/new/page.tsx` | ❌ Deleted |

## Wizard v2 Step Structure

1. **Identitas Dokumen** — Read-only teacher and school identity cards, pre-filled from API. Link to `/onboarding` for edits.
2. **Target Ajar** — Jenjang (locked SD v1), Kelas (from profile), Mata Pelajaran, Semester.
3. **Materi & Fokus** — Topik Utama (required), Tujuan Pembelajaran (optional), Catatan untuk AI (optional).
4. **Review & Generate** — Full summary card, credit balance widget, generate CTA blocked when no credits.

## Pre-fill Data Sources

| Field | Source |
|---|---|
| Nama Guru, NIP | `GET /w/:id/profile` |
| Mapel default, Kelas | `GET /w/:id/profile` → `primary_subject`, `primary_grade` |
| Nama Sekolah, NPSN, Kab/Kota | `GET /w/:id/school` |
| Kepala Sekolah, Kota TTD | `GET /w/:id/school` |
| Credit balance | `GET /w/:id/usage-summary` |

## Credit Awareness

- Balance displayed on Review step as a prominent card.
- Generate CTA is **disabled** when `credits_remaining <= 0`.
- "Isi Saldo" shortcut redirects to `/billing`.

## Submit Flow

1. `POST /w/:id/modules/generate` with `{ mode, subject, grade, topic, semester, notes }`.
2. On success: transition to `GENERATING` step using `ProgressStep` component (real-time polling).
3. On job done: redirect to `/modules/[moduleId]`.
4. On error: return to REVIEW step with error message.

## Follow-up Issues

- Jenjang and Kelas are locked to SD/Kelas 4 in v1. Needs dynamic unlock in v2.
- `usage-summary` endpoint may return 500 if no jobs exist — graceful fallback applied (shows 0 credit).

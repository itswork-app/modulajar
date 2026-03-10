# Module Result Page v2

*PR-C6 — Last updated: 2026-03-10*

## State Model

| Status | UI Label | Indicator | Polling |
|---|---|---|---|
| `QUEUED` | Antrean | Clock icon, pulse | ✅ Active |
| `RUNNING` | Sedang Dibuat | Spinner + rotating stage label | ✅ Active |
| `DONE` | Selesai | Green check + 5-section layout | ❌ Stopped |
| `FAILED` | Gagal | Red X + error + recovery CTAs | ❌ Stopped |

**Polling rule:** Exponential backoff (1s → 2s → 4s → 8s max). Stops immediately when `DONE` or `FAILED`.

## Page Sections (Done State Only)

| Section | Content |
|---|---|
| A — Status Ringkas | Badge, timestamp, subject label |
| B — Aksi Utama | Download PDF, Generate Ulang, Duplikasi, Copy Verify Link, Edit Modul |
| C — Ringkasan Dokumen | mapel, semester, kelas, topik, nama guru, nama sekolah |
| D — Identitas Dokumen | Full teacher + school identity used during generation |
| E — Detail Teknis | Collapsible: pdf_sha256, html_sha256, generation ID, timestamps |

## Actions on Success

| Action | Behavior |
|---|---|
| Unduh Dokumen (PDF) | Opens signed S3 URL in new tab |
| Generate Ulang | Routes to `/wizard` |
| Duplikasi untuk Topik Baru | Routes to `/wizard` |
| Salin Verify Link | Copies `origin/verify/:public_id` to clipboard |
| Edit Modul | Routes to `/modules/:id/edit` |

## Actions on Failure

| Action | Behavior |
|---|---|
| Coba Generate Ulang | Routes to `/wizard` |
| Buka Wizard | Routes to `/wizard` |
| Cek Saldo Kredit | Routes to `/billing` |

## Artifact Access Flow

1. While `QUEUED`/`RUNNING`: no artifact
2. On `DONE`: fetch `GET /w/:id/modules/:jobId` for `pdf.download_url`
3. Show "PDF Belum Tersedia" if URL missing (graceful fallback)

## Auth Guard

- Missing profile (404) → redirect `/onboarding`
- Missing school (404) → redirect `/onboarding`
- Identity section loaded once on bootstrap (non-blocking if unavailable)

## Regenerate / Duplicate Behavior

Both route back to `/wizard`. In v1 the wizard reads identity directly from the live profile/school API, so no explicit prefill URL params are needed.

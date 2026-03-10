# Document Preview & Quick Edit

*PR-C8 — Last updated: 2026-03-10*

## Architecture

Full editor infrastructure was already present. PR-C8 wires it into the result page.

| Layer | Component/Endpoint | Purpose |
|---|---|---|
| Backend | `GET /w/:id/modules/:id/editor` | Returns `{module_json, html_preview, version}` |
| Backend | `PATCH /w/:id/modules/:id` | Saves patch, creates new `document_versions` row |
| Full Editor | `/modules/:id/edit` (ModuleEditor) | 3-panel: nav · editor · live preview |
| Result Page | Section F — Pratinjau Dokumen | Inline iframe preview + Edit Cepat CTA |

## Preview Rendering Strategy

1. On job status → `DONE`, fetch `GET /modules/:id/editor`
2. Extract `html_preview` (server-rendered HTML string)
3. Render in sandboxed `<iframe srcDoc={html}>` at 520px height
4. Graceful fallback: "Pratinjau belum tersedia" + Buka Editor link

## Editable Fields (in Full Editor)

Editable via `module_json` patch — any key the JSON contains. Typical fields:
`title`, `tujuan_pembelajaran`, `kegiatan_awal`, `kegiatan_inti`, `kegiatan_penutup`, `asesmen`

## Identity Lock

Teacher and school identity are read from `packages` table (set at generation time). The PATCH endpoint does not accept identity field overrides — they are always sourced from the teacher context at generation.

## Versioning Rules

- Each `PATCH` creates a new `document_versions` row with `version = current + 1`
- Previous version is immutable
- Version badge shown in result page: "Versi 1 – Hasil AI", "Versi 2+ – Revisi Manual"

## PDF Regeneration

After editing, the server re-renders HTML from the updated `module_json` on each `PATCH`. A new PDF is not auto-generated (PDF generation remains worker-based). Users download the original PDF or open the editor to work with the latest content.

## Edit Guard

"Edit Cepat" button is only rendered when `isDone === true`. The full editor also runs in DONE context by navigating to `/modules/:id/edit`.

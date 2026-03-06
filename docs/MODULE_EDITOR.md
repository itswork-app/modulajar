# Module Editor (PR-067)

Struktur editor modul yang memungkinkan guru untuk mengedit konten yang dihasilkan secara aman dengan versi append-only dan bantuan AI per section.

## Arsitektur

Editor menggunakan sistem versi untuk menjaga integritas data:
1. `documents`: Menyimpan metadata utama.
2. `document_versions`: Menyimpan setiap snapshot perubahan (`module_json`).
3. `packages`: Menyimpan metadata konteks kurikulum (kelas, semester, dll).

Setiap kali pengguna menyimpan (via autosave debounced 800ms), versi baru dibuat di `document_versions`.

## Komponen Utama (Frontend)

- `ModuleEditor.tsx`: Kontainer utama dengan layout 3-panel.
- `SectionNav.tsx`: Navigasi bagian modul (Identitas, CP/TP, Langkah, dll).
- `SectionEditor.tsx`: Area editing teks dengan dukungan AI.
- `PreviewPane.tsx`: Live preview HTML via iframe.
- `AISuggestionModal.tsx`: Memproses saran perbaikan dari Gemini.

## API Endpoints

- `GET /api/w/:workspaceId/modules/:moduleId/editor`: Load data editor & preview.
- `PATCH /api/w/:workspaceId/modules/:moduleId`: Simpan perubahan (patch).
- `POST /api/w/:workspaceId/modules/:moduleId/ai-assist`: Request bantuan AI.
- `GET /api/w/:workspaceId/modules/:moduleId/preview`: Render HTML preview khusus.
- `GET /api/w/:workspaceId/modules/:moduleId/versions`: Riwayat versi.

## Observability

- Metrics: `module_update_total`, `ai_assist_total`.
- Logs: Structured JSON logs dengan `module_id` dan `trace_id`.

## Keamanan

- Semua endpoint dilindungi oleh `workspaceGuard`.
- Validasi format JSON patch pada setiap update.

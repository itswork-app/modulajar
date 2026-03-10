# Kurikulum Merdeka Topic Catalog (PR-C10)

## Overview
This feature introduces a structured, Kurikulum Merdeka-aligned topic catalog into the Modul Ajar generation wizard. It shifts the user experience from a purely free-form topic input to a guided selection process based on the user's chosen educational level (Jenjang), phase/grade (Fase/Kelas), and subject (Mata Pelajaran).

## Components Implemented

### 1. Database Schema & Data Seeding
*   **Migration**: `migrations/017_curriculum_topics.sql`
    *   Creates the `curriculum_topics` table.
    *   Fields include `jenjang`, `fase`, `kelas`, `mata_pelajaran`, `semester`, `title`, `display_order`, `cp_reference`, and `notes`.
    *   Includes an index on `jenjang, kelas, mata_pelajaran` for fast querying.
*   **Seed Script**: `scripts/seed_curriculum.ts`
    *   A TypeScript script to parse JSON/object data into the database.
    *   Initial coverage includes **SMP Kelas 7, 8, and 9** for core subjects: **IPA, Matematika, Bahasa Indonesia, Bahasa Inggris, and IPS**.

### 2. API Endpoint (`apps/api-ts/src/routes/curriculum.ts`)
*   **Route**: `GET /w/:workspaceId/curriculum/topics`
*   **Query Parameters**: `jenjang` (string), `kelas` (string), `mapel` (string), `semester` (optional string).
*   **Response**: Returns an array of topics sorted by semester and display order.
*   **Auth**: Protected by standard workspace authentication guards.

### 3. Wizard UI Integration (`apps/console-web/app/(dashboard)/wizard/page.tsx`)
*   **Step 2 (Target)**: Updated dropdowns for Jenjang, Kelas, and Mapel to be reactive and dependent. Changing Jenjang resets the Kelas and Mapel dropdowns.
*   **Step 3 (Materi)**: 
    *   Introduced a "Topik Rekomendasi" vs "Topik Manual" toggle.
    *   Dynamically fetches the recommended topics from the new API based on Step 2 selections.
    *   If topics are available, they are presented as selectable cards displaying the topic title and semester.
    *   If no topics are found (graceful degradation), the UI advises the user to switch to manual input.

### 4. Batch Generation UI Integration (`apps/console-web/app/(dashboard)/wizard/batch/page.tsx`)
*   **Step 2 (Topik)**:
    *   Upon entering the batch topic step, the UI attempts to load recommended topics for the current context.
    *   If found, an 'emerald' colored alert banner is shown with a "Gunakan Topik Kemdikbud" button.
    *   Clicking this button automatically populates the batch generation inputs with up to 16 recommended topics.

## Future Recommendations
1.  **Expand Data Coverage**: The seed data currently only covers SMP core subjects. We need to expand this to cover SD (Fase A-C) and SMA/SMK (Fase E-F) across all subjects for a complete Kurikulum Merdeka catalog.
2.  **Admin UI**: Develop a dashboard to allow curriculum experts to manage, add, or edit these topics without running DB update scripts.
3.  **Cross-Semester Batch Generation**: Enhance the batch API to automatically split topics by semester if a teacher wants to generate a full academic year at once.

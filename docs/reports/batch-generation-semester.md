# Batch Semester Generation

*PR-C9 — Last updated: 2026-03-10*

## Overview
ModulAjar Batch Semester Generation enables teachers to generate multiple modules for an entire semester in a single workflow. Instead of going through the generation wizard repeatedly, a teacher inputs shared context (subject, grade, semester) once, lists out all topics (up to 16), and the console handles queueing all the jobs sequentially.

## Architecture & Implementation Strategy
To minimize changes and reduce risk, the batch implementation operates entirely client-side, leveraging the existing module generation infrastructure. No changes were made to the backend worker, queue system, or the core generation endpoint. 

### 1. Job Creation Model
The `/wizard/batch` page sequentially calls the existing `POST /w/:workspaceId/modules/generate` API for each valid topic. 
- Sequential dispatch with 300ms delays prevents API rate limiting.
- The generation endpoint already debits 1 credit per call seamlessly.
- If a call returns `402 Payment Required`, the batch loop stops immediately, preventing any negative credit balances or unhandled API loops.

### 2. Session Tracking
Because the jobs are fired sequentially and handled by asynchronous background workers, tracking them is crucial:
- The `sessionStorage` tracks the active batch using a key `modulajar_batch`.
- Payload structure: `{ batch_id, job_ids, subject, semester, total }`.
- The `/modules` (Riwayat Generasi) page detects this session data and renders a sticky "Batch Progress" banner.

### 3. Progress Calculation
On the `/modules` page, progress is calculated by cross-referencing the `activeBatch.job_ids` against the fetched `documents` (jobs) list:
- **Selesai**: `jobs.filter(j => activeBatch.job_ids.includes(j.id) && j.status === 'DONE').length`
- **Gagal**: `jobs.filter(j => activeBatch.job_ids.includes(j.id) && j.status === 'FAILED').length`
- **Memproses/Antre**: `total - (Selesai + Gagal)`

The banner offers a dismiss action (`X` button) when the user no longer wishes to track the specific batch or when it completes.

## Credit Consumption Rules
Credit usage follows existing rules (1 module = 1 credit). Since the batch simply iterates over the standard generate API, billing guards naturally apply per document. The batch wizard implements an early, front-loaded credit guard in **Step 3: Review** to ensure the user has sufficient balance for the entire list before beginning processing.

## Topic / Package Structure
Currently, each topic gets its own standalone `package_id` in the system (the standard generation behavior). From a data model perspective, they remain independent modules that just happen to share the same generation timeframe and user intent.

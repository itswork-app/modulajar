# AI Topic Planner

## Objective
Implement an AI-powered Topic Planner that leverages the Kurikulum Merdeka topic catalog to suggest a structured, ordered semester plan for teachers, feeding directly into the ModulAjar batch generation workflow (PR-C11).

## Workflow

1. **Context Collection**: The teacher enters the `Batch Wizard` and provides the basic curriculum context (Jenjang, Kelas, Mata Pelajaran, Semester) as well as an optional "Fokus Materi / Konteks Lokal" to guide the AI.
2. **AI Planning Request**: The frontend calls `POST /w/:workspaceId/curriculum/planner` via `api-ts`.
3. **Dataset Integration**: The backend queries the `curriculum_topics` table (introduced in PR-C10) to fetch the valid topics for the selected configuration.
4. **Ordering & Selection**: The backend constructs a structured prompt using the dataset and sends it to OpenAI (`gpt-4o-mini`). The AI returns a JSON array containing the ordered `id`s of the topics.
5. **Review UI**: The teacher reviews the AI's proposal as a list of "Pertemuan X". They can drag, drop, manually edit, or remove topics before finalizing.
6. **Batch Generation**: Clicking "Eksekusi Batch" seamlessly converts the ordered list into batch worker jobs.

## Dataset Dependency
The AI planner **does not invent topics**. It strictly acts as an arrangement engine. All available topics inserted into the AI's context window are pulled directly from the `curriculum_topics` table.

## AI Prompt Structure

**System Prompt Overview**:
- Enforces strict adherence to the provided Catalog dataset.
- Forces JSON output containing purely an array of topic IDs.
- Restricts the AI to re-ordering and selecting topics, preventing hallucination.

**User Prompt Overview**:
- Provides `Jenjang`, `Kelas`, `Mata Pelajaran`, `Semester`, and `Fokus Materi`.
- Injects the `Available Catalog (ID and Title)`.

## Fallback Rules
If the AI fails to parse, times out, or hallucinates IDs that do not exist in the database, the backend executes a **fail-safe degradation**. It intercepts the failure and returns the default catalog sequence based on `display_order`. This ensures the UI never breaks, and the teacher still sees a valid sequence they can manually edit.

## Batch Integration
The planner acts purely as a data-feed mechanism for the Review stage of the `Batch Wizard`. The AI payload replaces the `topics` React state. The actual batch generation (API endpoint logic and worker queues) remains unchanged and behaves exactly as built in PR-C9.

## Logging and Metrics
Usage is trackable via standard Fastify structured logging attached to the `POST /w/:workspaceId/curriculum/planner` route. All inference failures or degradations to the fallback ordering are flagged as `error` logs to monitor AI reliability.

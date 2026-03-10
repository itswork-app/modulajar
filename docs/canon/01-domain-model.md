# Canon 01: Domain Model

This document defines the canonical domain model for the ModulAjar platform. It explicitly addresses the structural requirements for database entities, JSONB metadata schemas, and state transitions to prevent implicit architectural drift.

## 1. Core Entities and Relationships

- **Workspace**: The root boundary for multi-tenant isolation.
  - Relations: `1:1` WorkspaceSettings, `1:1` WorkspaceIdentity, `1:N` Packages, `1:N` Employees/Members
  - Constraint: All child tables MUST inherit the `workspace_id` and include it in composite constraints for strict isolation.

- **Package (Modul Ajar Container)**: A request batch representing a module or a set of modules for a specific teacher, grade, and topic.
  - Lifecycle: `draft` -> `generating` -> `ready` -> `failed`
  - Identifier: `public_id` (used as the ModulAjar PID)

- **Document (Module/Subject instance)**: A localized entity of an generated resource belonging to a package.
  - Identifier: `public_id` (DID)
  - Lifecycle: `queued` -> `generating` -> `ready`
  - Schema Dependency: Uses `ArtifactMetadata`

- **Document Version**: Immutable records mapping changes made in the Module Editor over time.
  - Constraint: `module_json` must conform strictly to `DocumentModuleJSON`.
  - Integrity: `html_sha256` represents the visual hash state. 

- **Generation Job**: The async coordination entity driving AI curriculum generation.
  - Lifecycle Rules: Strictly constrained by `{queued, running, done, failed}`. "completed" or other ambiguous synonyms are illegal.
  - Schema Dependency: Uses `GenerationJobMetadata`.

---

## 2. Canonical Job Status Transitions

The job runner and API must adhere to the following strict state transition rules for any `status` field related to background tasks (e.g., `generation_jobs`):

1. **`queued`**: Job has been requested but worker has not acquired a lock.
2. **`running`**: Worker holds a lock (`locked_at` is set) and is actively processing (calling APIs, validating).
3. **`done`**: Job successfully finished all generation, validation, HTML rendering, PDF stamping, and GCS artifact upload.
4. **`failed`**: Job encountered irrecoverable errors or exhausted maximum retry attempts. Recorded reasoning goes to `last_error`.

*Note: Legacy status values like `completed`, `processing`, or `error` have been deprecated and must not be reintroduced.*

---

## 3. JSONB Schema Contracts

To solve implicit coupling between the Go background workers, TypeScript APIs, and database JSONB fields, payload structures now operate under strict JSON schemas defined in `packages/contracts/domain/`.

### 3.1. `GenerationJobMetadata`
- **Location:** `generation_jobs.metadata`
- **Schema:** `generation_job.schema.json`
- **Purpose:** Stores the input request variables (subject, parameters, UI wizard inputs) and the output metrics resulting from the run (AI transaction receipts, PDF hashes, duration).
- **Invariant:** Must be validated by the Worker via `jsonschema` library immediately after acquiring a record from the database.

### 3.2. `DocumentModuleJSON`
- **Location:** `document_versions.module_json`
- **Schema:** `document_module.schema.json`
- **Purpose:** Represents the structural abstract syntax tree for the Modul Ajar payload itself. It defines required keys for `meta`, `tujuan_pembelajaran`, `materi_inti`, and layout components like `langkah_pembelajaran`.
- **Invariant:** Must be validated by the `api-ts` layer via `ajv` inside the `PATCH /modules/:moduleId` route before a new revision is committed to the database.

### 3.3. `ArtifactMetadata`
- **Location:** `documents.metadata`
- **Schema:** `artifact_metadata.schema.json`
- **Purpose:** Tracks specific physical artifact details (GCS path, `pdf_sha256` hash lock, watermark injection keys) tied directly to a finalized `Document`.

---

## 4. Enforcement Strategy

- **API Request Phase:**
  - Fastify JSON Schema validates request models natively.
  - Before writing patches to `document_versions`, the payload is filtered through `DocumentModuleJSON` schema. **Validation is mandatory;** if the schema cannot be loaded or validation fails, the request returns HTTP 400 or HTTP 500 depending on the failure type.
  
- **Worker Execution Phase:**
  - Polled jobs are coerced into a `TaskPayload` struct only after parsing the record `metadata` column against `generation_job.schema.json`. 
  - **Mandatory Enforcement:** The worker will now explicitly fail a job if the schema cannot be loaded or if validation fails. This ensures no malformed jobs poison the processing pipeline.

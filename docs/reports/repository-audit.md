# ModulAjar Repository Audit Report

## Executive Summary
ModulAjar is an institutional-grade SaaS platform designed to generate curriculum documents (Modul Ajar) via AI. The architecture is a mature, production-ready monorepo consisting of a Next.js frontend, a Fastify TypeScript API, and a Go-based background processing pipeline. 

While the system is robust, it highlights an "implementation-first" evolution trajectory. For example, AI prompt generation bifurcates between "SD4" and "Legacy" structures, and job orchestration currently relies on a custom PostgreSQL polling queue. To scale safely, the repository requires strict architectural governance (Canon Alignment) to solidify implicitly established contracts around job lifecycles, tenant isolation, and billing.

---

## System Architecture

The monorepo (`apps/` and `packages/`) separates concerns across the following stack:

- **Frontend:** Next.js 16 (React 19) + Tailwind CSS v4 in `apps/console-web` (admin UI) and `apps/web` (landing). Utilizes `@clerk/nextjs` for identity.
- **API Layer:** Fastify + TypeScript in `apps/api-ts`. Handles synchronous user requests, workspace management, validation, and webhook ingestion.
- **Core Domain & Worker:** Go 1.24 in `apps/core-go` (domain logic) and `apps/worker-go` (job runner).
- **Database:** PostgreSQL used dynamically as the central persistent store and job queue.
- **Storage:** Google Cloud Storage for serving and hosting statically generated PDFs.
- **AI Providers:** Pluggable Go adapters for Google Gemini and OpenAI.
- **Artifact Renderer:** Headless Chrome via ChromeDP (`github.com/chromedp/chromedp`) used for PDF generation.

---

## Domain Model
Entities encapsulate strict multi-tenant constraints using ULID primary keys.

| Entity | Description | Relations / Lifecycle |
|--------|-------------|-----------------------|
| **Workspace** | The central tenant (Personal or Institutional). Contains optional NPSN routing and verification logic. | `1:N` Packages, Documents, Members, Jobs, Ledger |
| **Workspace Member** | Maps Clerk identities to roles within a workspace. | Belongs to Workspace |
| **Curriculum Pack** | Core definition dictionaries spanning Jenjang, Kelas, and mapping Subjects to Outcomes. | `1:N` Subjects |
| **Package** | A container (PID) for a batch generation request mapped to a specific Class and Teacher. | Belongs to Workspace |
| **Document** | A specific subject module inside a Package (DID). Tracks generation status and JSON metadata. | `1:N` Document Versions |
| **Document Version** | Archival tracking of Document JSON structure. Contains `html_sha256` integrity hashes. | Belongs to Document |
| **Generation Job** | Primary Async State Machine object. Follows `queued -> running -> failed/done` lifecycle. | Tied to Workspace & Package |
| **Wallet Ledger** | Append-only ledger mapping top-ups and usage deduction events for a Workspace. | Belongs to Workspace |
| **Receipts & Events** | Transactional proofs acting as idempotency guards for external payment webhooks. | Tied to Payment Events table |

---

## API Inventory

The `api-ts` layer maps domain endpoints under robust `workspaceGuard` authorization middleware.

### Workspaces & Onboarding
- `POST /w/:workspaceId/verify-school`
- `GET, PATCH /w/:workspaceId/workspace`
- `GET /w/:workspaceId/ping`
- `POST /w/:workspaceId/onboarding/profile`, `/onboarding/assignment`
- `GET /w/:workspaceId/onboarding/status`

### Generation & Documents
- `POST /w/:workspaceId/internal/generate-semester` (Enqueues Generation Job)
- `GET /w/:workspaceId/documents`, `GET /w/:workspaceId/documents/:publicId/download`

### Billing & Wallet
- `POST /w/:workspaceId/internal/topup-intent` (Creates Receipt intent)
- `GET /w/:workspaceId/billing/summary`
- `GET /w/:workspaceId/wallet/summary`, `/wallet/transactions`
- `POST /internal/webhooks/payment/confirm` (External Payment Webhook)

### Additional Services
- `GET /verify/:publicId` (Public validation of PDF watermark)
- Profile and Referral routes

---

## AI Generation Pipeline

The generation pipeline is deeply embedded in `apps/worker-go` and orchestrated asynchronously:

1. **Planner & Validator:** A Job grabs a `Package`, maps it to a `CurriculumPack`, generates a Planner constraint, and validates requirements before launching AI calls.
2. **Template Selection:** A sophisticated ranking module (`ranking.GetTemplateCandidates`) fetches the best pre-existing examples (particularly for the newer SD4 format).
3. **Execution & Retry (Quality Gate):**
   - A synchronous call reaches Gemini/OpenAI adapter.
   - Output schema is validated.
   - **Quality Evaluator (`qeval`)** analyzes the output. If the response scores below threshold, the Worker explicitly rejects it and triggers an AI retry (max 2 attempts).
4. **Dataset Sidecar:** Successfully gated modules are asynchronously dumped to dataset tracking (`dataset.CollectDataset`).
5. **Idempotency checks:** Guards in place to skip duplicate generation if GCS artifacts already exist for the requested package.

---

## Job System

- **Database-Backed Queue:** `generation_jobs` table facilitates the queue mechanism polling via `next_run_at` and `locked_at` to serialize work.
- **State Machine:** Expected transitions are `queued` -> `running` -> `done` or `failed`.
- **Failure Handling:** A `last_error` and `attempt_count` string map explicit retries.

---

## Artifact System

Artifact flow bridges Go memory, headless runtime, and Google Cloud Storage:

- **HTML Composer:** A Go `html/template` pipeline replaces variables in structural templates to build the Modul Ajar HTML layout.
- **PDF Generation:** Handled by `ChromeDP`. The worker provisions a headless sandbox, prints the injected HTML payload with explicit header/footer metadata (teacher hash masks), and exports a PDF buffer.
- **Integrity Marking:** Hash keys (`pdf_sha256`, `html_sha256`) are saved within the `document_metadata` JSONB column preventing tampering.
- **Storage:** Direct transfer to GCS bucket defined path `workspaces/{ws}/packages/{pid}/artifacts/{did}`.

---

## Billing System

Monetization adopts an internal **Credits System** with an Append-Only Ledger:
- IDR Top-ups are resolved into `wallet_ledger` credits (e.g. 59,000 IDR -> 20 Credits).
- External webhooks (`/internal/webhooks/payment/confirm`) are securely verified using `x-callback-signature` SHA256 HMACs.
- `payment_events` table guarantees strict idempotency (Provider ID collision avoidance).
- Unrecognized states trigger `ignored` lifecycle rather than failing webhook HTTP 200 ACKs, preventing external retry-storms.

---

## Security, Observability & Infrastructure

- **Security & Tenant Isolation:** Database migrations establish composite primary key constraints (`workspace_id`, `id`) uniformly. API routes mandate workspace authorization token barriers on almost all state-changing endpoints.
- **Observability:** Go implementation tracks Prometheus-based internal metrics (e.g. `QualityRetryTotal`, `TemplateRankLatencyMs`). API TS relies on pino request mapping. 
- **CI/CD:** Governed by `cloudbuild.yaml` pushing Docker containers (`api-ts`, `worker-go`) directly into Google Cloud Run on `asia-southeast1`. `modulajar-api` allows unauthenticated access; `modulajar-worker` restricts access tightly to Pub/Sub or internal triggering roles.

---

## Risks & Technical Debt

1. **Canon Drift:** Implicit state management across database records—status strings like `'completed'` being mapped to `'done'` via migrations signifies a lack of a universal state contract.
2. **AI Logic Forking:** Heavily duplicated orchestration patterns in the Worker for `SD4` vs `Legacy` curriculum objects represent dangerous technical debt.
3. **Queue Reliability Bounds:** Using PostgreSQL for the job queue requires careful transactional locking. Future scale may bottleneck table IOPS on `generation_jobs` without dedicated messaging brokers (like Pub/Sub or Redis).
4. **Unregulated Job Metadata:** Both `metadata` columns and `document_versions.module_json` are unstructured JSONB payloads currently lacking enforced Schema definitions in the application layer.

---

## Canon Alignment Readiness

The architecture is primed for a transition to Canon-Based Architecture Governance. The next phases should formalize the implicit logic into declarative contracts located in `docs/canon/`.

The necessary refactor PR steps follow logically:
* **`PR-A1 (Domain Alignment)`**: Standardize JSONB boundaries on Jobs & Documents.
* **`PR-A2 (API Contract)`**: Define explicit endpoint schemas for Fastify ensuring request/response integrity.
* **`PR-A3 (Job Lifecycle)`**: Encode the Job Queue into a strictly defined State Machine interface.
* **`PR-A4 (Billing Contract)`**: Lock the append-only ledger transaction rules dictating specific Event-Sourced inputs.
* **`PR-A5 (Observability)`**: Map standard tracing IDs across Fastify to Go worker handoffs.

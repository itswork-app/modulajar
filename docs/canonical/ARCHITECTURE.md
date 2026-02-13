# Architecture Specification (v1)

The platform follows an "Apple-grade" separation of concerns.

## Tech Stack
| Component | Technology | Hosting |
|-----------|------------|---------|
| **UI** | Next.js 14+ (Next Forge) | Vercel |
| **Auth** | Clerk | Clerk |
| **API** | TypeScript + Fastify | Cloud Run |
| **Core/Workers** | Go 1.21+ | Cloud Run |
| **Database** | Postgres (v16+) | Neon |
| **Queue** | Cloud Tasks | Google Cloud |
| **Storage** | Google Cloud Storage (GCS) | Google Cloud |
| **AI** | Gemini (via Adapter) | Google Vertex AI |

## Constraints
- **No Direct DB Access from UI**: The Next.js app must NEVER call the database directly. All data flows through the API.
- **Worker Isolation**: Long-running tasks (PDF generation, AI inference) must run in the Go worker, triggered via Cloud Tasks.
- **AI Adapter**: All AI calls must go through a rigid adapter interface (no loose prompt engineering in business logic).

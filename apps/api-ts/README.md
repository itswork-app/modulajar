# apps/api-ts

Fastify + TypeScript API for ModulAjar.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Variables (`.env`):
   ```
   PORT=8080
   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
   CLERK_SECRET_KEY="sk_test_..."
   CLERK_PUBLISHABLE_KEY="pk_test_..."
   ```

## Development

Run dev server:
```bash
npm run dev
```

## Testing

Run tests:
```bash
npm test
```

## Auth & Workspaces (PR-003)

- **Auth**: Clerk JWT. Pass `Authorization: Bearer <token>` header.
- **Workspaces**: All business logic routes are under `/w/:workspaceId/...`.
- **Guards**: A global guard ensures the user is a member of the workspace for these routes.

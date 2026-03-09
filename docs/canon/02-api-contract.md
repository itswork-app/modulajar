# 02 — API Contract

Formal definition of the ModulAjar API layer to ensure stability and prevent contract drift between Frontend, API, and Worker services.

## OpenAPI Integration

The API is documented using **OpenAPI 3.0**. The canonical specification is stored at `contracts/api/openapi.yaml`.

- **Swagger UI**: Exposed at `/docs/api` in production and local development.
- **Enforcement**: Fastify route schemas (`schema.body`, `schema.response`) are used to validate incoming requests and serialize outgoing responses according to the contract.

## Authentication Model

The API uses two primary authentication mechanisms:

### 1. User Authentication (Clerk)
- **Mechanism**: Bearer JWT token issued by Clerk.
- **Scope**: Used for global user actions (e.g., `/me`, `/bootstrap`).
- **Middleware**: `fastify.verifyClerk`.

### 2. Workspace Authentication (Workspace Guard)
- **Mechanism**: Verifies that the authenticated user is a member of the requested `workspace_id`.
- **Scope**: All routes prefixed with `/w/:workspaceId/`.
- **Middleware**: `fastify.workspaceGuard`.
- **Requirement**: The `workspaceId` must be passed as a path parameter.

## Workspace Isolation Rules

To prevent Cross-Tenant Data Leakage:
1. All database queries within `/w/` routes **MUST** include `workspace_id` in the `WHERE` clause.
2. The `request.workspaceId` property (populated by `workspaceGuard`) should be used as the source of truth for the current tenant.
3. Path parameter `:workspaceId` is validated against the user's membership during the `preHandler` phase.

## Error Handling

All error responses follow a consistent JSON format:

```json
{
  "error": "Short error code (e.g. 'insufficient_credits')",
  "message": "Human readable explanation"
}
```

Common HTTP status codes used:
- `400 Bad Request`: Validation failure (schema or logic).
- `401 Unauthorized`: Missing or invalid Clerk token.
- `402 Payment Required`: Insufficient wallet balance.
- `403 Forbidden`: User is not a member of the workspace.
- `404 Not Found`: Resource does not exist.
- `409 Conflict`: Resource already exists or concurrent job limit reached.
- `429 Too Many Requests`: Rate limiting (e.g., job concurrency).

## Versioning Policy

- Current version is **v0** (unversioned URL prefix).
- Future breaking changes will be introduced via `/v1/`, `/v2/` prefixes.
- Non-breaking changes (new fields) are added to existing endpoints with `additionalProperties: true` in schemas.

# Workspace Model Specification

The Workspace is the primary tenant boundary.

## Mapping
- **Clerk**: `Organization` (org_id)
- **Internal**: `Workspace` (workspace_id)
- **Relation**: 1:1 mapping. Code treats `org_id` as the source of truth for auth, but maps to internal integer ID for DB performance.

## Constraints
- **Multi-tenancy**: Strict isolation. A user cannot access another workspace's data without explicit Clerk permission.
- **Routing**: URL MUST include workspace slug/id: `/w/:workspaceId/...`.

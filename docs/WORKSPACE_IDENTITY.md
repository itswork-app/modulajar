# Workspace Identity Foundation

PR-033 introduces an identity layer for workspaces, allowing them to represent either a **Personal** user or an **Institution** (School).

## Workspace Types

- **personal** (default): Used for individual teachers or creators.
- **institution**: Used for schools, foundations, or educational organizations.

## Institutional Metadata

When a workspace is a school, it can optionally store the following metadata:

- **NPSN** (Nomor Pokok Sekolah Nasional): 8-10 digit unique identifier.
- **School Name**: Formal name of the institution (max 120 chars).
- **Region**: Province and Regency.
- **Address**: Full physical address.
- **Logo URL**: URL to the school's logo (must be HTTPS).

## Verification Status

The `is_verified` flag (default `false`) is reserved for future administrative verification flows. Verified workspaces may gain access to premium features, institutional billing, or official stamp/kop surat automation.

## API Integration

### GET /w/:workspace_id/workspace
Returns the current identity and metadata of the workspace.

### PATCH /w/:workspace_id/workspace
Updates the workspace identity. Validation rules:
- `workspace_type`: `personal` | `institution`
- `npsn`: Digits only, 8-10 characters. Unique across all workspaces.
- `school_name`: Max 120 characters.
- `logo_url`: Must start with `https://`.

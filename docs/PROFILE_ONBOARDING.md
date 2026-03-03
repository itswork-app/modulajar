# Teacher Profile & Onboarding

## The Purpose of Teacher Profiling

Before an educator can generate their first Learning Module (Modul Ajar), they must go through the **Teacher Profile** setup steps. This enables Modulajar to produce personalized, high-quality context within each document organically.

The profile captures:
- **Nama Lengkap**: Ensures the output uses the educator's proper title and name.
- **NIP (Optional)**: Automatically inserted into the signature section of matching templates.
- **Mata Pelajaran Utama (Primary Subject)**: Serves to contextualize AI prompt instructions for subject-specific generation logic.
- **Kelas Utama (Primary Grade)**: Used as the default grade configuration.

## Pre-Onboarding Guard
A guard component is embedded directly into the Generate Module interface (`/generate`). If the workspace lacks a completed teacher profile (`GET /profile` returns a `404 Not Found`), users are immediately redirected safely to the `/profile-setup` wizard.

## Constraints & Future State

### Locked to Grade 4 (SD)
For the current launch of Modulajar v1, the `primary_grade` value is explicitly locked to Grade 4 (Kelas 4 SD). Our AI prompts, curriculum graphs, and output structures are rigorously tested specifically to guarantee institutional quality output at the Grade 4 level prior to broadening scope to later stages.

### Workspace Scoping
Currently, Teacher Profiles are implemented at a 1-to-1 ratio with the tenant workspace using a UNIQUE DB constraint on `workspace_id`. In a future release ("Multi-Seat Pro"), workspaces will be upgraded to support multiple teacher profiles corresponding to different invited member seats within the same workspace.

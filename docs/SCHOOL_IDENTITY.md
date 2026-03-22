# School Identity (PR-052)

## Overview
The School Identity feature introduces a mandatory pre-onboarding screen for establishing workspace-level institutional details. Previously, Modulajar captured teacher-specific properties (PR-051). This update guarantees that every workspace possesses a clearly defined educational institution, streamlining AI-driven tasks such as formatting headers and creating personalized RPP (Rencana Pelaksanaan Pembelajaran) letterheads.

## Manual Mode (Version 1)
In V1, the collection of school identity operates in **Manual Mode**.
This means:
1. **Name Required**: Users must provide the `school_display_name` (e.g. "SMP Negeri 1").
2. **NPSN Optional**: Users can submit an 8-digit **NPSN** (Nomor Pokok Sekolah Nasional), but it is not strictly required to adopt the platform.
3. **Location Attributes**: `kab_kota`, `provinsi`, and `alamat` remain optional strings to supplement localized prompting logic.

## Verification Constraints
Currently, whenever a school identity is created or modified, the underlying database property `school_verified` is forcefully mapped to `false`. Verification of the entered NPSN against a national educational database or manual auditing processes will be integrated in subsequent PRs (starting PR-056).

## Pipeline Integrations
- At the Database level (`workspace_settings`), properties are tracked explicitly against a `workspace_id`.
- The main Generation form (`/generate`) enforces the existence of this entry using dual-validation sequentially, intercepting the flow to `/workspace/school-setup` if unassigned.

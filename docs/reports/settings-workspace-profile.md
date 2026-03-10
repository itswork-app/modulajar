# Settings & Workspace Profile

*PR-C5 — Last updated: 2026-03-10*

## Overview

`/settings` is the post-onboarding identity management surface. Users can update any document identity field without re-running the onboarding flow.

## Data Flow

```
API (postgres)
  └── GET /w/:id/profile       ← teacher identity (teachers table)
  └── POST /w/:id/profile      ← saves teacher identity
  └── GET /w/:id/school        ← school + principal (workspace_settings)
  └── POST /w/:id/school       ← saves school + principal

Browser (localStorage)
  └── modulajar_prefs          ← default_subject, default_semester
```

## Section Map

| Section | API Endpoint | Fields |
|---|---|---|
| Profil Guru | `POST /w/:id/profile` | full_name, nip, primary_subject, primary_grade |
| Identitas Sekolah | `POST /w/:id/school` | school_display_name, school_npsn, alamat, kab_kota, provinsi |
| Penandatangan Dokumen | `POST /w/:id/school` | principal_name, principal_nip, signature_location |
| Preferensi Default | localStorage only | default_subject, default_semester |

## Fields Used in Document Generation

| Field | Used In |
|---|---|
| `full_name` | Document header, signature block |
| `nip` | Teacher NIP block |
| `primary_subject` | Auto-fills Subject field in Wizard |
| `primary_grade` | Auto-fills Kelas field in Wizard |
| `school_display_name` | Document header |
| `kab_kota` | Document header |
| `principal_name` | Signature block |
| `signature_location` | Signature date line (`Kota, tanggal`) |

## UX Behavior

- Each section has independent **Edit / Cancel / Save** controls
- Draft copies prevent data loss on cancel
- Success toast auto-dismisses after 3 seconds
- Signature block shows a live preview in read mode
- Preferensi Default stored in browser localStorage, read by Wizard on load

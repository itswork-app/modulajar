# Optional NPSN Verification Strategy (PR-056)

ModulAjar introduces **Optional NPSN Verification** designed to upgrade a generic Workspace into an official Institutional Identity cleanly without blocking core platform features.

## Why NPSN Verification?

Traditional SaaS onboarding frequently locks users into tedious, bureaucratic institutional identification setups ("upload your business license before trying our product"). ModulAjar rejects this paradigm.

Instead, workspaces start *Personal*. Teachers can begin drafting lesson plans immediately. 
At any point, the Workspace Administrator can navigate to **Pengaturan Kop Surat** and opt into typing their 8-Digit *Nomor Pokok Sekolah Nasional* (NPSN) into the system.

## The Architecture Strategy

### 1. The `schools_reference` Lookup Index
Institutions aren't relying on text inputs anymore. The ModulAjar `api-ts` connects to an internal PostgreSQL `schools_reference` table seeded with authentic Ministry of Education registry data.
```sql
CREATE TABLE schools_reference (
    npsn TEXT PRIMARY KEY,
    nama_resmi TEXT NOT NULL,
    jenjang TEXT NOT NULL,
    alamat TEXT NULL,
    kab_kota TEXT NULL,
    provinsi TEXT NULL,
...
```

### 2. Lock & Lock
When a user queries their 8-digit NPSN, the `POST /w/:workspaceId/verify-school` route executes a strict lookup. If matched, the system forcefully upgrades `workspace_settings` by hard-coding:
- `school_display_name`
- `kab_kota` & `provinsi`
- `alamat`

These fields are subsequently **DISABLED** within the Frontend React component (`disabled={formData.school_verified}`). This prevents tampering and asserts the authenticity of ModulAjar documents.

### 3. Display Trust
A "Sekolah Terbaik" and "Verified" badge displays natively on the UI rendering the confidence level back to the users. It seamlessly integrates into the PDF deterministic payload without demanding further input.

## Future Plans (Data Strategy)
Currently, `schools_reference` only contains dummy / seed validation logic limits (e.g. SMAN 1 GARUT). 
Future migrations will script a batch-ingestion importing the aggregate national dataset dynamically providing exhaustive geographical coverage.

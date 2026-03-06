# CONSOLE APPLE GRADE BLUEPRINT

## 1. Global Layout Diagram

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │ Header                                             │
│         │ Workspace Switcher | Credit | User Menu            │
│         ├────────────────────────────────────────────────────┤
│         │ Main Content                                       │
│         │                                                    │
│         │                                                    │
└──────────────────────────────────────────────────────────────┘
```

## 2. Sidebar Map

**Sidebar final items:**
- Dashboard
- Buat Modul
- Riwayat Modul
- Template
- Dataset AI
- Billing
- Referral
- Workspace
- Pengaturan

*(Note: Editor Modul is accessed from module details, keeping the sidebar ringkas.)*

## 3. Page Map

1. **Dashboard**
   - **Purpose**: Quick overview and single main CTA.
   - **Cards**: Saldo Kredit, Modul Selesai, Job Gagal, Aktivitas Terakhir.
   - **Primary Action**: `[ + Buat Modul Baru ]`
2. **Wizard "Buat Modul"**
   - **Purpose**: Step-by-step module generation.
   - **Steps**: Pilih Jalur -> Isi Konteks -> Pilih Template -> Review -> Progress Screen.
3. **Riwayat Modul (Modules List)**
   - **Purpose**: List of all modules and entry point to detail/editor.
   - **Actions**: Detail, Edit, Download, Verify (Done statuses). Retry (Failed).
4. **Detail Modul**
   - **Purpose**: Central hub for all important actions. "Dokumen saya aman, resmi, dan bisa ditelusuri."
   - **Actions**: Download PDF, Edit Modul, Copy Verify Link.
5. **Editor Modul**
   - **Purpose**: Deep editing with AI assistance.
   - **Layout**: Section Nav | Editor | Preview.
   - **AI Rule**: Suggestional only (Gunakan / Batal), no direct overwrite.
6. **Template Library**
   - **Purpose**: Browse templates with "social proof" (usage count, score).
7. **Dataset AI**
   - **Purpose**: Educational copy for teachers to opt-in modules to improve AI.
8. **Billing**
   - **Purpose**: Transparent credit usage and management. SaaS feel.
9. **Referral**
   - **Purpose**: Viral growth loop.
10. **Workspace**
    - **Purpose**: School identity. Profil Sekolah, Kop Surat, Verifikasi NPSN.
11. **Settings**
    - **Purpose**: User configuration (Nama, NIP, Mapel, Email).

## 4. Route Map

```text
/
├── /wizard
├── /modules
├── /modules/[id]
├── /modules/[id]/edit
├── /templates
├── /dataset
├── /billing
├── /referral
├── /workspace
└── /settings
```

## 5. Component System

**Required Reusable Components:**
- PageHeader
- EmptyState
- StatsCard
- StatusChip (Queued=abu, Running=biru, Done=hijau, Failed=merah)
- DataTable
- SidebarNav
- WorkspaceSwitcher
- AIAssistButton
- SaveIndicator
- SkeletonCard

**Design Rules:**
- **Typography**: Clean, large precise headings. Readable body text.
- **Color**: White / light gray backgrounds in main content. Subtle blue-green accents. Avoid noisy colors.
- **Consistency**: Uniform card radii, consistent button sizing, responsive table padding.
- **Apple-grade details**: Proper keyboard focus rings, sticky headers, loading skeletons.

## 6. UX Rules

- Satu layar satu tugas (one screen, one task).
- Minim kebisingan (minimum noise/clutter).
- Semua aksi utama terlihat (all primary actions visible).
- Tidak ada dead end (no dead ends, guide user from empty states or errors).
- Status sistem selalu jelas (clear system status like Queued, Saving..., Saved).

## 7. PR Execution Order

1. **PR-069** — Console Navigation & Route Wiring
2. **PR-070** — Billing Page UI
3. **PR-071** — Wallet UX Integration
4. **PR-072** — Xendit Payment Flow UI
5. **PR-073** — Template Library UI Polish
6. **PR-074** — Dataset Page UI Polish
7. **PR-075** — Console Final Polish

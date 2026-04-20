# Checklist rilis beta ModulAjar

Gunakan daftar ini sebelum mengumumkan beta kepada pengguna.

## Keamanan dan konfigurasi

- [ ] Pastikan tidak ada file `env-*.yaml` atau secret di riwayat git yang masih valid; rotasi kunci bila pernah terpapar.
- [ ] Cloud Run / API: `DATABASE_URL`, `PID_SECRET`, `CLERK_SECRET_KEY`, dan secret pembayaran AI/storage terisi.
- [ ] `USE_MOCK_AUTH` tidak pernah `true` di lingkungan beta/produksi.
- [ ] Platform admin: isi `platform_roles` di database, atau set `PLATFORM_ADMIN_CLERK_USER_IDS` (Clerk user ID, dipisah koma) untuk bootstrap sementara — jangan mengandalkan email di kode.
- [ ] `/metrics`: set `METRICS_SECRET` dan scrape dengan header `X-Metrics-Token: <secret>` atau `Authorization: Bearer <secret>`.

## API dan dokumen

- [ ] `/docs/api` memuat OpenAPI (bundle `contracts/` di image atau set `OPENAPI_SPEC_PATH`).
- [ ] Smoke: `GET /healthz`, `GET /readyz` (dengan DB) OK dari lingkungan beta.

## Frontend konsol

- [ ] Untuk menampilkan banner beta di `console-web`, set `NEXT_PUBLIC_BETA=1` (atau `true`) di Vercel / build.

## Uji manual (smoke)

- [ ] Alur: login → wizard → generate → halaman modul → unduh PDF (sesuai lingkungan beta).
- [ ] Top-up / voucher di sandbox (jika billing beta diaktifkan).

## Komunikasi

- [ ] Channel umpan balik (email, grup, atau form) dikomunikasikan kepada peserta beta.

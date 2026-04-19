# Guide: Setup ops.modulajar.app di Vercel

Panduan ini akan membantu Anda menghubungkan aplikasi `ops-web` (HQ Command Center) ke domain resmi secara otomatis.

---

## 1. Buat Project Baru di Vercel
1. Buka [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik **"Add New"** > **"Project"**.
3. Hubungkan ke repositori GitHub `modulajar`.
4. Pada bagian **"Root Directory"**, klik **"Edit"** dan pilih `apps/ops-web`.
5. Beri nama project: `modulajar-ops`.

## 2. Konfigurasi Billing & Environment
1. Di tab **"Environment Variables"**, tambahkan variabel berikut (sesuaikan dengan API Production):
   - `NEXT_PUBLIC_API_BASE_URL`: `https://api.modulajar.app`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: (Ambil dari Clerk Dashboard)
   - `CLERK_SECRET_KEY`: (Ambil dari Clerk Dashboard)

Pada **API (Cloud Run)**, set juga `CONSOLE_APP_BASE_URL` ke URL origin konsol pengguna (mis. `https://app.modulajar.app`, tanpa slash di akhir) agar redirect setelah pembayaran Xendit mengembalikan pengguna ke halaman Billing. Lihat [docs/BILLING_PAYMENT_SMOKE.md](../BILLING_PAYMENT_SMOKE.md).

## 3. Setting Sub-domain
1. Di dashboard project `modulajar-ops`, buka menu **"Settings"** > **"Domains"**.
2. Masukkan `ops.modulajar.app` dan klik **"Add"**.
3. Vercel akan memberikan record DNS (biasanya CNAME atau A Record). 
4. Login ke penyedia domain Anda (misal: Cloudflare atau Namecheap) dan tambahkan record tersebut.

## 4. Hubungkan ke GitHub Actions (Auto-Deploy)
Agar file `.github/workflows/deploy-ops-web.yaml` yang saya buat bisa bekerja, Anda butuh 2 ID:

1. **Dapatkan Project ID**:
   - Buka terminal di folder `apps/ops-web`.
   - Jalankan `vercel link`. Ini akan membuat folder `.vercel`.
   - Buka `.vercel/project.json`, salin `projectId` dan `orgId`.

2. **Input ke GitHub Secrets**:
   - Buka repositori GitHub > **Settings** > **Secrets and variables** > **Actions**.
   - Tambahkan Secret baru:
     - `VERCEL_OPS_PROJECT_ID`: (Paste `projectId` tadi)
     - `VERCEL_ORG_ID`: (Paste `orgId` tadi)
     - `VERCEL_OPS_TOKEN`: (Buat token baru di [Vercel Account Settings](https://vercel.com/account/tokens))

---

> [!TIP]
> **Pro-Tip**: Karena `ops.modulajar.app` adalah area sensitif, pastikan Anda mengaktifkan **Advanced Deployment Protection** di Vercel jika menggunakan paket Pro, untuk memastikan hanya tim internal yang bisa mengakses preview deployment.

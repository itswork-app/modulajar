# Deploy backend: Cloud Build vs manual

Backend (**api-ts** + **worker-go**) ke Cloud Run **`asia-southeast1`** didefinisikan di [`cloudbuild.yaml`](../../cloudbuild.yaml). Sumber kebenaran untuk **deploy otomatis** setelah merge ke `main` adalah **trigger Cloud Build** di GCP (mis. `modulajar-main-deploy`), bukan push-trigger GitHub Actions terpisah untuk service yang sama.

## 1. Otomatis (disarankan)

- **GCP Console** → Cloud Build → Triggers → trigger yang memakai `cloudbuild.yaml` pada push ke branch (mis. `main`).
- Setelah `git push` ke `main`, build + deploy jalan di infrastruktur Google; tidak perlu menjalankan apa pun dari laptop.

## 2. Manual dari mesin lokal

Pastikan `gcloud` sudah login dan project benar (`gcloud config set project …`).

Dari **akar repositori** (folder yang berisi `cloudbuild.yaml`):

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse HEAD) \
  .
```

`COMMIT_SHA` dipakai sebagai tag image di `cloudbuild.yaml`; untuk submit manual wajib diisi. Jika ada error substitusi, gunakan **Cloud Console → Cloud Build → Triggers → Run** pada branch/commit yang diinginkan (setara, tanpa CLI).

## 3. Manual dari GitHub (hanya API atau hanya worker)

Untuk kasus darurat, ada workflow **manual** (`workflow_dispatch`):

- [`.github/workflows/deploy-api-ts.yaml`](../../.github/workflows/deploy-api-ts.yaml) — hanya image **api-ts**
- [`.github/workflows/deploy-worker-go.yaml`](../../.github/workflows/deploy-worker-go.yaml) — hanya image **worker**

Buka **GitHub → Actions → workflow terkait → Run workflow**. Ini **tidak** menggantikan satu run penuh `cloudbuild.yaml` (yang membangun keduanya sekaligus); gunakan jika perlu deploy satu service saja.

## 4. Frontend (Vercel)

Console, ops, dan landing tetap memakai workflow GitHub Actions ke Vercel (`deploy-console-web`, `deploy-ops-web`, `deploy-web`) — itu terpisah dari Cloud Build backend.

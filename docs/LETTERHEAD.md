# Konfigurasi Kop Surat (Letterhead)

## Konsep Utama
Modulajar mendukung fitur personalisasi institusi melalui **Kop Surat (Letterhead)**. Fitur ini bersifat *workspace-scoped*, yang berarti setiap workspace (sekolah/institusi) memiliki konfigurasi tampilannya sendiri yang disematkan secara spesifik ke dalam kop file RPP/Modul Ajar PDF yang digenerate oleh AI.

## Struktur Data
Konfigurasi ini dinormalisasi ke dalam tabel `workspace_settings` melalui migrasi `010_workspace_letterhead.sql` tanpa menambahkan beban pada tabel parent `workspaces`.

Kolom yang terlibat:
*   `logo_file_path`: Path GCS internal dari logo institusi.
*   `logo_sha256`: Hash integritas file logo.
*   `letterhead_line1` s/d `letterhead_line4`: Teks baris ke-1 hingga ke-4 pada header (seperti Nama Yayasan, Nama Sekolah, dll).
*   `letterhead_contact`: Teks kontak (seperti Alamat, Telepon, Kode Pos, URL).

## Mekanika Sistem

### 1. Upload API (`apps/api-ts`)
Upload difasilitasi oleh endpoint `POST /w/:id/letterhead`.
*   **Security:** Menggunakan dependensi `@fastify/multipart`.
*   **Validation:** Terdapat pembatasan batas besaran MIME Type strict hanya untuk `image/jpeg` dan `image/png`. Kapasitas payload maksimal adalah **512 KB**.
*   **Storage:** File logo di-upload ke direktori internal pada GCP Cloud Storage (GCS). Path GCS berskala `--private` (tidak bisa diakses browser secara publik).

### 2. Live Preview (`apps/console-web`)
Halaman `/workspace/letterhead` melayani antarmuka UI Console.
*   Jika image berhasil diunduh, API menerbitkan Signed URL (kadaluarsa dalam durasi pendek) eksklusif untuk rendering "Live Preview" di web.
*   Kotak pratinjau dirender melalui elemen div yang mensimulasikan ukuran dan posisi Header PDF sebenarnya dari Golang.

### 3. Eksekusi Worker Renderer (`apps/core-go`)
Saat dokumen Modul Ajar di-*generate*, worker yang mengambil alih job akan memuat pengaturan kop surat ini secara *atomic*.
*   **Determinism Mechanism:** File path GCS dari logo dialirkan (diunduh ke memori byte array) melalui method `client.DownloadFile`.
*   **Base64 Injection:** Array memori langsung dikonversikan sebagai *Data URI* (`data:image/jpeg;base64,...`) ke dalam template HTML Golang. Mekanika *inline HTML data injection* ini diwajibkan untuk menjamin nilai `html_sha256` yang diproduksi oleh `ComposerInput` murni deterministik, tanpa bergantung pada request network luar saat runtime headless browser (seperti Chromium PDF conversion) memproses HTML.

## Keamanan & Penggunaan
Sistem menolak *payload* eksternal dan melarang masuknya tag HTML berbahaya (`<script>`) melalui pembatasan sanitasi string ketat berkapasitas 120-Karakter. Metode *Base64 Internal Image Storage* menjaga Modulajar tetap berjalan cepat dan stabil.

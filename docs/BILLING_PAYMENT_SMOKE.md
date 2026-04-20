# Smoke test: alur pembayaran (top-up)

Checklist manual untuk memastikan wire UI → API → Xendit → webhook → saldo konsisten.

## Prasyarat

- API mengarah ke lingkungan yang sama dengan `NEXT_PUBLIC_API_BASE_URL` di console-web.
- **Cloud Run / server API:** set `CONSOLE_APP_BASE_URL` ke origin console produksi (tanpa slash di akhir), misalnya `https://app.modulajar.app`. Tanpa ini, invoice Xendit tetap jalan tetapi pengguna tidak diarahkan kembali ke `/billing` setelah bayar.
- Xendit sandbox/live key dan webhook `PAYMENT_WEBHOOK_SECRET` sesuai lingkungan.

## Langkah

1. Buka **Billing** di konsol, catat saldo token.
2. Klik **Top Up**, pilih paket, lanjut ke halaman Xendit.
3. Selesaikan pembayaran (sandbox: metode uji Xendit).
4. Setelah redirect ke `.../billing?payment=success`, pastikan saldo naik (halaman billing memuat ulang data saat tab kembali terlihat; jika tidak, refresh manual).
5. Cek riwayat transaksi di halaman yang sama.
6. Opsional: ulangi dengan membatalkan/expired di sandbox dan pastikan redirect `?payment=failed` masih menampilkan saldo yang konsisten.

## Troubleshooting

- Saldo tidak berubah: pastikan webhook pembayaran mencapai `POST /internal/webhooks/payment/confirm` dan tanda tangan HMAC valid (lihat log API).
- Tidak kembali ke app: set `CONSOLE_APP_BASE_URL` dan deploy ulang API.

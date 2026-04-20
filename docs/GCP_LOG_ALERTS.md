# Alert dasar di Google Cloud (Cloud Run + Logging)

Tanpa biaya tambahan besar untuk traffic beta: manfaatkan **Cloud Logging** (log dari `stdout`/`stderr` Cloud Run) dan **Cloud Monitoring** untuk alert berbasis log atau metrik layanan.

## Yang gratis / kuota

- Ingest log Cloud Run masuk Cloud Logging; kuota mengikuti [harga GCP](https://cloud.google.com/pricing) (tier gratis berlaku untuk volume kecil).
- Metrik bawaan Cloud Run (request count, latency, error count) tersedia di Monitoring.

## Pola yang disarankan

### 1. Error rate HTTP 5xx (Cloud Run)

Di **Monitoring** → **Alerting** → buat kebijakan berdasarkan metrik **Cloud Run** (request count dengan filter `response_code_class = 5xx`) atau gunakan **Log-based metric** dari log yang memuat status 5xx.

### 2. Log severity ERROR / worker

Buat **log-based metric** dengan filter contoh:

```text
resource.type="cloud_run_revision"
severity>=ERROR
```

Lalu alert jika jumlah melebihi ambang dalam jendela 5–10 menit.

### 3. Prometheus `/metrics` di aplikasi

Endpoint `/metrics` membutuhkan scraper terpisah (Managed Prometheus / agent). Untuk beta, **log + metrik bawaan Cloud Run** biasanya cukup; scrape Prometheus bisa ditunda sampai kebutuhan SLO jelas.

## Tautan

- [Alerting di Cloud Monitoring](https://cloud.google.com/monitoring/alerts)
- [Log-based metrics](https://cloud.google.com/logging/docs/logs-based-metrics/)

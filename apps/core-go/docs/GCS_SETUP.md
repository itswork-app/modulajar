# Google Cloud Storage & PDF Render Setup

PR-014 introduces PDF artifact generation and GCS upload to the worker pipeline.

## 1. Prerequisites

### Playwright (PDF Renderer)
The worker uses a Node.js script (`render/pdf_render.js`) invoking Playwright Chromium to render PDFs.

**Installation:**
```bash
cd apps/core-go
npm install
npx playwright install chromium
```

**Docker Support:**
If running in Docker, ensure Node.js and Playwright dependencies are installed. Consider using the `mcr.microsoft.com/playwright:v1.45.0-jammy` base image for the worker or installing via:
```dockerfile
RUN apt-get update && apt-get install -y nodejs npm
RUN npx playwright install-deps chromium
```

### Google Cloud Storage
You need a GCS bucket to store artifacts.

**Create Bucket:**
```bash
# Set your project and bucket name
export PROJECT_ID=your-project-id
export BUCKET_NAME=modulajar-artifacts

gcloud storage buckets create gs://$BUCKET_NAME --project=$PROJECT_ID --location=asia-southeast2
gcloud storage buckets update gs://$BUCKET_NAME --uniform-bucket-level-access
```

## 2. Configuration

Add the following to your `.env` (or Cloud Run environment variables):

```bash
# Bucket name (without gs:// prefix)
GCS_BUCKET=modulajar-artifacts

# Optional: Custom path for Playwright browsers if not default
# PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

## 3. Authentication

The worker uses **Application Default Credentials (ADC)**.

**Local Development:**
```bash
gcloud auth application-default login
```

**Cloud Run:**
Ensure the service account attached to the Cloud Run service has `Storage Object Admin` or `Storage Object Creator/Viewer` roles on the bucket.

## 4. Architecture

1.  **Planner & Composer**: Generates HTML content.
2.  **PDF Renderer**: `worker` calls `node render/pdf_render.js` -> produces temporary PDF.
3.  **GCS Upload**: `worker` uploads PDF to `artifacts/{workspaceId}/{pid}/{did}/v1.pdf`.
4.  **Finalization**: Updates `document_versions.file_path` from `html://...` to `gcs://...`.

## 5. Troubleshooting

-   **"PDF render skipped" in logs**: Check if `node` is in PATH and `apps/core-go/node_modules` exists.
-   **"GCS upload failed"**: Check `GCS_BUCKET` env var and IAM permissions.

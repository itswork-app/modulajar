# IAM Role Checklist for Cloud Build Service Account

Ensure the Cloud Build Service Account (`<params.PROJECT_NUMBER>@cloudbuild.gserviceaccount.com`) has the following roles:

-   **Cloud Run Admin** (`roles/run.admin`): To deploy Cloud Run services.
-   **Service Account User** (`roles/iam.serviceAccountUser`): To act as the runtime service accounts (`modulajar-api-sa` & `modulajar-worker-sa`).
-   **Artifact Registry Writer** (`roles/artifactregistry.writer`): To push Docker images.

## Runtime Service Accounts
Ensure these exist:
1.  `modulajar-api-sa@modulajar-487006.iam.gserviceaccount.com`
2.  `modulajar-worker-sa@modulajar-487006.iam.gserviceaccount.com`

## Setup Commands (One-time)

```bash
# Grant Cloud Build SA permissions
PROJECT_ID=modulajar-487006
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
    --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
    --role=roles/iam.serviceAccountUser

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
    --role=roles/artifactregistry.writer
```

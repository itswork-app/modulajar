# Verification Specification

The integrity of generated Modul Ajar is paramount.

## Endpoints

### 1. Public Verification (No Auth)
- **URL**: `https://modulajar.app/verify/:scan_id?s=HMAC`
- **Output**:
    - **Status**: VALID / EXPIRED / REVOKED
    - **Metadata**: School Name, Teacher Name (Masked), Created At.
    - **Privacy**: NO PII exposed. Teacher name is masked (e.g., `Budi ***`).

### 2. Private Verification (Auth Required)
- **URL**: `https://app.modulajar.app/w/:workspace_id/verify/:scan_id`
- **Output**: Full details, including unmasked PII and full document download.

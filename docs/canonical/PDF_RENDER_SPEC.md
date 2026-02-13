# PDF Render Specification (v1)

PDF generation uses a headless browser strategy for maximum fidelity.

## Pipeline
1. **HTML Template (v1.0)**: Strict HTML/CSS structure.
2. **Playwright**: Chromium instance controlled by Go worker.
3. **Render**: `page.pdf()` with standard A4 settings.
4. **Output**: PDF/A-1b compliant file stored in GCS.

## Watermark
- **Footer**: Every page MUST have a footer containing:
    - **PID/DID**: Unique document ID.
    - **Verify URL**: `modulajar.app/verify/:id`
    - **Timestamp**: Generation time (UTC).

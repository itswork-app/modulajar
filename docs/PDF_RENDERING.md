# PDF Rendering (PR-024)

Modul Ajar uses `chromedp` (Headless Chrome) to generate deterministic PDFs from HTML content.

## Architecture

1.  **HTML Generation**: Go `html/template` renders the content (PR-023).
2.  **PDF Generation**: `apps/core-go/render/pdf_chromedp.go` launches a headless Chrome instance.
3.  **Watermark**: A footer template is applied during `Page.printToPDF`:
    ```html
    <div style="...">modulajar.app — {PID} — {Teacher} — {Date} — Verify: {URL}</div>
    ```
4.  **Persistence**: PDF bytes are uploaded to GCS (`artifacts/{ws}/{pid}/v1.pdf`) and metadata (`pdf_sha256`) is stored in the job receipt.

## Environment Requirements

The Worker environment **MUST** have a Chrome or Chromium binary installed and accessible in `$PATH`.
Common paths checked:
- `/usr/bin/google-chrome`
- `/usr/bin/chromium`
- `/usr/bin/chromium-browser`
- Or set `CHROME_BIN` env var.

### Cloud Run / Docker
Use a base image that includes Chromium.
Example `Dockerfile`:
```dockerfile
FROM golang:1.24 as builder
...
FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/worker /worker
CMD ["/worker"]
```

### Memory & CPU
- **Heap**: `chromedp` uses significant memory per page.
- **Recommendation**: Min 1GB RAM, 1 CPU.
- **Concurrency**: Limit concurrent PDF generations to 1-2 per instance to avoid OOM.

## Troubleshooting

### "Chrome/Chromium not found"
- Install Chromium package (`apt install chromium`).
- Verify path with `which chromium`.

### "chromedp run failed: context deadline exceeded"
- Rendering took longer than 30s.
- Check complex assets or slow CPU.
- Increase timeout in `pdf_chromedp.go`.

### Blank PDF or Missing Footer
- Ensure `printBackground` and `displayHeaderFooter` are `true`.
- Check margins (bottom margin must be sufficient for footer).
- Footer HTML must use inline styles (no external CSS).

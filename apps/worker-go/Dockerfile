# Multi-stage build for Go worker with Node.js/Playwright support
FROM golang:1.24-bookworm AS builder

WORKDIR /app

# Copy dependency module first (core-go)
COPY apps/core-go/go.mod apps/core-go/go.sum ./apps/core-go/
# Copy worker module manifest
COPY apps/worker-go/go.mod ./apps/worker-go/

# Download dependencies (trick to leverage cache)
# We need to set up the replace directive correcty in the container
WORKDIR /app/apps/worker-go
# This might fail if it tries to resolve local path ../core-go which is not fully there yet
# So we copy sources early or ignore this step optimization if tricky.
# Let's copy everything for simplicity in monorepo build.

WORKDIR /app
COPY apps/core-go ./apps/core-go
COPY apps/worker-go ./apps/worker-go

WORKDIR /app/apps/worker-go
RUN go mod download
RUN go build -o /worker-bin .

# Runtime stage: Use official Playwright image (has Node + Browsers)
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Install basic utils if needed (Playwright image is Ubuntu based)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /worker-bin /app/worker-go

# Copy core-go render scripts (pdf_render.js and node_modules)
# We need to install node deps for the script to work
COPY apps/core-go/render /app/apps/core-go/render
COPY apps/core-go/package.json apps/core-go/package-lock.json* /app/apps/core-go/

# Install Node dependencies (playwright wrapper)
WORKDIR /app/apps/core-go
RUN npm install

# Copy templates (needed for HTML composition if relative path logic uses them)
# logic searches: templates/v1, ../templates/v1 etc.
# Code creates temp HTML then renders it. Code resolves templates from pack path usually.
# But pack path in cloud might be GCS? Or local?
# The worker payload has `PackPath`.
# If packs are in the image, we need to copy them! Ref task payload: "PackPath": "..."
# Assuming packs are mounted or baked in. 
# PR requirement: "HTML composed... from inputs".
# If packs are needed, we should copy them.
# The user's env has `packs/` directory.

WORKDIR /app
COPY apps/core-go/packs /app/packs
COPY apps/core-go/templates /app/templates

# Environment setup
ENV PORT=8080
# Point to where we installed playwright deps (PWD is /app/apps/core-go)
# Actually pdf.go executes `node .../pdf_render.js`.
# It finds it via relative path.
# Worker is at /app/worker-go.
# It looks for `render/pdf_render.js`, `../render/pdf_render.js`, etc.
# If PWD is /app, `apps/core-go/render/pdf_render.js` matches one candidate?
# `filepath.Join("apps", "core-go", "render", "pdf_render.js")` was added as candidate 4.

CMD ["/app/worker-go"]

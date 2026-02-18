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

# Runtime stage: Debian with Chromium (for Chromedp)
FROM debian:bookworm-slim

WORKDIR /app

# Install Chromium and dependencies
# Chromium in Debian Bookworm is available as a package.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set CHROME_BIN just in case, though chromedp looks for 'chromium'
ENV CHROME_BIN=/usr/bin/chromium

# Copy compiled binary
COPY --from=builder /worker-bin /app/worker-go

# Copy template resources
# Assuming they are needed for HTML generation
COPY apps/core-go/packs /app/packs
COPY apps/core-go/templates /app/templates

ENV PORT=8080

CMD ["/app/worker-go"]

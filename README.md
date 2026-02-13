# Modulajar Monorepo

This monorepo contains the following applications:

- **apps/console-web**: Next.js application for the admin console.
- **apps/api-ts**: Fastify-based Typescript API.
- **apps/core-go**: Go module for core logic.
- **apps/worker-go**: Go module for background workers.

## Local Development

### Prerequisites

- Node.js 18+
- Go 1.21+
- Docker (optional, for container builds)

### Running Locally

Use the Makefile to run commands across the repo.

```bash
# Install dependencies
make install

# Build all applications
make build

# Run tests
make test
```

### CI/CD

This repo uses GitHub Actions for CI. Checks run on every PR.

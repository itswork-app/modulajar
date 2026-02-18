#!/bin/bash
set -e

# 1. Start Test DB
echo "Starting Test DB..."
docker-compose -f docker-compose-test.yaml up -d --wait

# 2. Run Migrations
echo "Running Migrations..."
# Check if goose is installed
if ! command -v goose &> /dev/null; then
    echo "goose not found, installing..."
    go install github.com/pressly/goose/v3/cmd/goose@latest
fi
# Add GOPATH/bin to PATH
export PATH=$(go env GOPATH)/bin:$PATH

# Additional: Install Chrome if not found
if [ ! -d "./chrome-bin/chrome" ]; then
    echo "Installing Chrome for testing..."
    npx -y @puppeteer/browsers install chrome --path ./chrome-bin
fi

# Detect local chrome
if [ -d "./chrome-bin/chrome" ]; then
    CHROME_DIR=$(find ./chrome-bin/chrome -maxdepth 2 -name "chrome-linux64" | head -n 1)
    if [ -n "$CHROME_DIR" ]; then
        echo "Found local Chrome at $CHROME_DIR"
        export CHROME_BIN=$(readlink -f "$CHROME_DIR/chrome")
    fi
fi

export DATABASE_URL="postgres://user:password@localhost:5433/modulajar_test?sslmode=disable"
goose -dir migrations postgres "$DATABASE_URL" up

# 3. Run Tests
echo "Running Tests..."
# Set ENV vars for test
export DID_SECRET="test-did-secret"
export PID_SECRET="test-pid-secret"

# We only run core-go tests for now, specifically worker
cd apps/core-go
go test -v ./worker/...

# 4. Cleanup (optional, comment out to debug)
# echo "Cleaning up..."
# docker-compose -f docker-compose-test.yaml down

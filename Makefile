.PHONY: install build test migrate-up migrate-down migrate-status

install:
	cd apps/console-web && npm install
	cd apps/web && npm install
	cd apps/api-ts && npm install
	cd apps/core-go && go mod download
	cd apps/worker-go && go mod download

build:
	cd apps/console-web && npm run build
	cd apps/web && npm run build
	cd apps/api-ts && npm run build
	cd apps/core-go && go build ./...
	cd apps/worker-go && go build ./...

test:
	cd apps/console-web && npm run lint
	cd apps/web && npm run build
	cd apps/api-ts && npm test
	cd apps/core-go && go test ./...
	cd apps/core-go && go test ./...
	cd apps/worker-go && go test ./...

test-integration:
	./scripts/test-integration.sh

migrate-up:
	goose -dir migrations postgres "$(DATABASE_URL)" up

migrate-down:
	goose -dir migrations postgres "$(DATABASE_URL)" down

migrate-status:
	goose -dir migrations postgres "$(DATABASE_URL)" status

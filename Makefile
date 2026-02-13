.PHONY: install build test

install:
	cd apps/console-web && npm install
	cd apps/api-ts && npm install
	cd apps/core-go && go mod download
	cd apps/worker-go && go mod download

build:
	cd apps/console-web && npm run build
	cd apps/api-ts && npm run build
	cd apps/core-go && go build ./...
	cd apps/worker-go && go build ./...

test:
	cd apps/console-web && npm run lint
	cd apps/api-ts && npm test
	cd apps/core-go && go test ./...
	cd apps/worker-go && go test ./...

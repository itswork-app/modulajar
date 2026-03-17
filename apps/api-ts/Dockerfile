FROM node:22-bookworm-slim AS builder

WORKDIR /

COPY packages/ ./packages/
COPY apps/api-ts/package*.json ./apps/api-ts/

WORKDIR /apps/api-ts
RUN npm ci --ignore-scripts

COPY apps/api-ts/ .
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /

# Install Chromium and production dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium

COPY --from=builder /packages/ ./packages/
COPY --from=builder /apps/api-ts/dist ./apps/api-ts/dist
COPY --from=builder /apps/api-ts/package*.json ./apps/api-ts/

WORKDIR /apps/api-ts
RUN npm ci --omit=dev --ignore-scripts

EXPOSE 8080

CMD ["node", "dist/index.js"]

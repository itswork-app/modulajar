FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY apps/api-ts/package*.json ./
RUN npm install

COPY apps/api-ts/ .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

# Install Chromium and production dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm install --production

EXPOSE 8080

CMD ["node", "dist/index.js"]

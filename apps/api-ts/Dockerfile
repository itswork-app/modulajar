FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/api-ts/package*.json ./
RUN npm install

COPY apps/api-ts/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm install --production

EXPOSE 8080

CMD ["node", "dist/index.js"]

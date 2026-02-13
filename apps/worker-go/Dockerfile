FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
# COPY go.sum ./
RUN go mod download

COPY . .
RUN go build -o /worker-go

FROM alpine:latest

WORKDIR /
COPY --from=builder /worker-go /worker-go

CMD ["/worker-go"]

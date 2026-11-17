FROM node:24-alpine AS frontend-builder

WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
COPY database/ ./database/
COPY llm/ ./llm/
COPY --from=frontend-builder /src/frontend/dist ./frontend/dist

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /smartfridge .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -H -u 10001 smartfridge
WORKDIR /app

COPY --from=backend-builder --chown=smartfridge:smartfridge /smartfridge ./smartfridge

USER smartfridge
EXPOSE 8000

ENTRYPOINT ["/app/smartfridge"]

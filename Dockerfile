FROM node:22-bookworm-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build
FROM node:22-bookworm-slim AS renderer
WORKDIR /app/renderer
COPY renderer/package*.json ./
RUN npm ci
COPY renderer/ ./
RUN npm run typecheck && npm run bundle
FROM golang:1.25-bookworm AS go
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY server/ ./server/
RUN CGO_ENABLED=0 go build -trimpath -o /sana ./server
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg chromium poppler-utils fonts-dejavu-core wget dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=go /sana ./sana
COPY --from=web /app/web/dist ./web/dist
COPY --from=renderer /app/renderer ./renderer
RUN mkdir -p /app/data/media && chown -R node:node /app
USER node
ENV CHROME_EXECUTABLE=/usr/bin/chromium
EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/sana"]

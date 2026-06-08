# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=3000

# Docker CLI — talks to host daemon via /var/run/docker.sock for LaTeX compiles
RUN apt-get update \
  && apt-get install -y --no-install-recommends docker.io ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/docker ./docker
COPY deploy/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p storage compile-workspace

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]

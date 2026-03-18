# ─────────────────────────────────────────────────────────────────
# order-service/Dockerfile
# Multi-stage build — NestJS + Prisma
# ─────────────────────────────────────────────────────────────────

# ── Étape 1 : installation des dépendances ───────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Étape 2 : génération du client Prisma + build ────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL factice uniquement pour générer les types Prisma
ENV DATABASE_URL="file:/tmp/dev.db"

RUN npx prisma generate
RUN npm run build

# ── Étape 3 : dépendances de production uniquement ───────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ── Étape 4 : image de production ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_SOURCE
LABEL org.opencontainers.image.title="Order Service"
LABEL org.opencontainers.image.description="Service de commandes — NestJS + Prisma"
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.source=$GIT_SOURCE

ENV NODE_ENV=production

# Utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Répertoire dédié pour la base SQLite
RUN mkdir -p /app/data && chown appuser:appgroup /app/data

# Copie des artefacts nécessaires au runtime
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=appuser:appgroup prisma ./prisma
COPY --chown=appuser:appgroup prisma.config.ts ./

USER appuser

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]

# ─────────────────────────────────────────────────────────────────
# frontend/Dockerfile
# Multi-stage build — Next.js
# ─────────────────────────────────────────────────────────────────

# ── Étape 1 : installation des dépendances ───────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copie uniquement les fichiers de dépendances (optimisation du cache)
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ── Étape 2 : build de l'application ─────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Toutes les dépendances (dev inclus) pour le build
COPY package.json package-lock.json* ./
RUN npm ci

# Sources de l'application
COPY . .

# Variables de build (injectées par le pipeline)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Étape 3 : image de production ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Métadonnées OCI (valeurs dynamiques injectées par le pipeline)
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_SOURCE
LABEL org.opencontainers.image.title="Microservices Frontend"
LABEL org.opencontainers.image.description="Next.js frontend + API Gateway"
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.source=$GIT_SOURCE

# Environnement de production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copie uniquement les artefacts nécessaires au runtime
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

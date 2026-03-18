# ─────────────────────────────────────────────────────────────────
# auth-service/Dockerfile
# Multi-stage build — FastAPI + SQLite
# ─────────────────────────────────────────────────────────────────

# ── Étape 1 : installation des dépendances ───────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ── Étape 2 : image de production ────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

# Métadonnées OCI
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_SOURCE
LABEL org.opencontainers.image.title="Auth Service"
LABEL org.opencontainers.image.description="Service d'authentification JWT — FastAPI + SQLite"
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.source=$GIT_SOURCE

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Utilisateur non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Répertoire dédié pour la base SQLite avec les bons droits
# (doit être fait avant USER appuser)
RUN mkdir -p /app/data && chown appuser:appgroup /app/data

# Sources de l'application
COPY --chown=appuser:appgroup . .

USER appuser

# La base SQLite sera créée dans /app/data/auth.db
ENV DATABASE_URL="sqlite:////app/data/auth.db"

EXPOSE 8000

CMD ["sh", "-c", "python init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]

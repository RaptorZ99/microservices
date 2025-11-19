"""
Point d'entrée principal du service d'authentification.
Configure l'application FastAPI, les CORS, les routes, ainsi que l'initialisation
de la base de données au démarrage.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from db import init_db
from auth import router as auth_router
from jwks import router as jwks_router


# ---------------------------------------------------------------------------
# Application FastAPI
# ---------------------------------------------------------------------------
# Création de l'application avec un titre (visible dans /docs et /openapi.json).
app = FastAPI(title="Auth Service")


# ---------------------------------------------------------------------------
# Configuration CORS (Cross-Origin Resource Sharing)
# ---------------------------------------------------------------------------
# Le frontend (Next.js) tourne sur un port différent → nécessite CORS.
# La variable CORS_ORIGINS peut contenir une liste séparée par des virgules.
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # domaines autorisés
    allow_credentials=True,       # autorise cookies/tokens envoyés depuis le front
    allow_methods=["*"],          # autorise toutes les méthodes HTTP
    allow_headers=["*"],          # autorise les headers personnalisés (ex: Authorization)
)


# ---------------------------------------------------------------------------
# Hook de démarrage : initialisation de la base SQLite
# ---------------------------------------------------------------------------
@app.on_event("startup")
def on_startup():
    """
    Exécuté automatiquement au lancement du serveur FastAPI.
    - Initialise la base SQLite si elle n'existe pas.
    - Crée les tables selon les modèles SQLModel.
    """
    init_db()


# ---------------------------------------------------------------------------
# Déclaration des routes
# ---------------------------------------------------------------------------
# Routes d'authentification (register, login, refresh)
app.include_router(auth_router, prefix="/auth", tags=["auth"])

# Endpoint JWKS (.well-known/jwks.json), utile pour la validation des clés JWT.
app.include_router(jwks_router, tags=["jwks"])

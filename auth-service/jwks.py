from fastapi import APIRouter
import os

router = APIRouter()


@router.get("/.well-known/jwks.json")
def get_jwks():
    """
    Endpoint d'exemple pour exposer des métadonnées de clés.
    - Pour HS256 (algorithme symétrique), il n'y a pas de vraie clé publique à publier.
    - Pour RS256, on publierait ici la ou les clés publiques (modulus, exponent, etc.).
    """
    algo = os.getenv("JWT_ALGO", "HS256")
    return {
        "keys": [
            {
                "kty": "oct",
                "alg": algo,
                "use": "sig",
            }
        ]
    }
# TP 03 - Auth Service (Python FastAPI + SQLite) - TD

# Partie 1 — Socle Python FastAPI

## Environnement Python et installation du socle applicatif

**1. Créer un environnement virtuel Python dédié.**

L’utilisation d’un environnement virtuel (`venv`) permet d’isoler les dépendances du projet, garantissant reproductibilité et compatibilité, conformément aux bonnes pratiques Python (PEP 405).

Documentation : [https://docs.python.org/3/library/venv.html](https://docs.python.org/3/library/venv.html)

**2. Activer l’environnement selon le système d’exploitation.**

Une fois activé, toutes les commandes `pip install` n’affecteront que cet environnement.

**3. Installer les dépendances stables et compatibles avec Python 3.12+.**

Le service repose sur :

- **FastAPI** : framework web asynchrone performant (documentation officielle : [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/))
- **Uvicorn** : serveur ASGI hautes performances
- **SQLModel** : ORM combinant SQLAlchemy et Pydantic (documentation officielle : [https://sqlmodel.tiangolo.com/](https://sqlmodel.tiangolo.com/))
- **PyJWT** : génération et validation JWT (RFC 7519)
- **Passlib + bcrypt** : hashage robuste des mots de passe
- **python-multipart** : support des formulaires (`Form(...)`) dans FastAPI
- **python-jose[cryptography]** : alternative RSA/EC pour JWT si passage vers RS256

**4. Geler les dépendances exactes dans un fichier **`**requirements.txt**`**.**

Cette pratique garantit la reproductibilité des environnements dans les futurs TP (Docker, CI/CD, Kubernetes).

---

### Scripts Install

**Création et initialisation du projet **`**auth-service/**`** :**

```bash
# 1. Créer un environnement virtuel Python
python3 -m venv .venv

# 2. Activer l'environnement
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell :
# .venv\Scripts\Activate.ps1

# 3. Installer les dépendances applicatives
pip install \
  "fastapi>=0.115.0" \
  "uvicorn[standard]>=0.31.0" \
  "sqlmodel>=0.0.22" \
  "pyjwt>=2.10.0" \
  "passlib==1.7.4" \
  "bcrypt==4.1.3" \
  "python-multipart>=0.0.9" \
  "python-jose[cryptography]>=3.3.0"

# 4. Geler les versions exactes
pip freeze > requirements.txt


```

---

## Définition de la structure du service FastAPI

**1. Définir une architecture claire et extensible.**

La structure suit les bonnes pratiques FastAPI et SQLModel, inspirées des modèles recommandés par les mainteneurs.

**2. Créer des fichiers distincts pour :**

- les modèles SQLModel (`models.py`),
- la base de données et les sessions (`db.py`),
- les mécanismes de sécurité (hashage, JWT, `security.py`),
- les routes d’authentification (`auth.py`),
- la publication optionnelle d’un JWKS (`jwks.py`),
- l’application principale FastAPI (`main.py`).

**3. Préparer un fichier **`**.env.example**`** pour documenter les variables d’environnement.**

Ce fichier ne doit jamais être commité sous forme réelle (`.env`), en cohérence avec les pratiques DevOps.

---

### **Arborescence du projet**

```plain text
auth-service/
├── main.py            # point d'entrée : CORS, routers, init DB
├── models.py          # modèles SQLModel (tables)
├── auth.py            # routes d'authentification (login, register, refresh)
├── init_db.py         # scripts d'initialisation de la bdd SQLite
├── db.py              # moteur SQLAlchemy/SQLModel et sessions
├── security.py        # hashage + génération/validation JWT
├── jwks.py            # métadonnées JWT (optionnel)
├── requirements.txt   # dépendances du service
└── .env.example       # documentation des variables environnement
```

---

## Mise en place du modèle utilisateur (SQLModel)

**1. Créer la classe **`**User**`** héritant de **`**SQLModel**`**.**

SQLModel permet de combiner validation Pydantic et ORM SQLAlchemy en un seul modèle.

**2. Déclarer la table **`**User**`** avec :**

- une clé primaire `id`,
- un champ unique `username`,
- un champ sécurisé `password_hash`.

**3. Utiliser **`**Field(unique=True)**`** pour imposer l’unicité au niveau ORM.**

---

### `models.py`

```python
from sqlmodel import SQLModel, Field
from typing import Optional

class User(SQLModel, table=True):
    """
    Modèle SQLModel représentant un utilisateur.
    - id : clé primaire auto-incrémentée
    - username : identifiant unique
    - password_hash : hash sécurisé du mot de passe
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
```

---

## Initialisation du moteur SQLite et gestion des sessions

**1. Définir l’URL de base de données via **`**DATABASE_URL**`**.**

Par défaut :

```plain text
sqlite:///./auth.db
```

**2. Créer le moteur SQLModel/SQLAlchemy.**

**3. Implémenter la fonction **`**init_db()**` qui crée les tables lors du démarrage.

**4. Implémenter un générateur **`**get_session()**` pour injecter une session via `Depends`, conformément aux recommandations FastAPI/SQLModel.

Documentation SQLModel :

[https://sqlmodel.tiangolo.com/tutorial/create-db-and-table/](https://sqlmodel.tiangolo.com/tutorial/create-db-and-table/)

---

### `db.py`

```python
from sqlmodel import create_engine, SQLModel, Session
import os

# URL de la base SQLite (modifiable via .env)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./auth.db")

# Moteur SQLAlchemy/SQLModel
engine = create_engine(DATABASE_URL, echo=False)

def init_db():
    """
    Création des tables au démarrage de l'application.
    """
    SQLModel.metadata.create_all(engine)

def get_session():
    """
    Injection de dépendance FastAPI.
    Fournit une session SQLModel dans un contexte 'with', garantissant
    l'ouverture et la fermeture propres de la connexion.
    """
    with Session(engine) as session:
        yield session
```

---

# Partie 2 — Service d’authentification complet (hashage, JWT, routes)

## Sécurité locale : hashage des mots de passe

**Le stockage des mots de passe en clair est proscrit dans toute architecture sérieuse. Le service d’authentification doit impérativement :**

- **recevoir un mot de passe en clair uniquement à la marge (au moment du **`**register**`** ou du **`**login**`**) ;**
- **le transformer immédiatement en hash non réversible avant stockage (**`**register**`**) ;**
- **ne jamais “dé-hacher” un mot de passe ;**
- **vérifier un mot de passe saisi en recalculant un hash et en le comparant au hash stocké.**

`**passlib**`** propose une abstraction **`**CryptContext**`** permettant :**

- la configuration d’un ou plusieurs algorithmes de hashage (ici : `bcrypt`) ;
- la centralisation de la logique de hashage et de vérification ;
- la gestion future de migrations d’algorithmes (si l’on souhaite passer à un autre schéma de hashage).

Documentation officielle :

[https://passlib.readthedocs.io/](https://passlib.readthedocs.io/)

**Cette étape introduit donc un module de sécurité dédié (**`**security.py**`**) qui fournira :**

- une fonction `hash_password(password: str) -> str`,
- une fonction `verify_password(password: str, hash_: str) -> bool`.

Ces fonctions seront utilisées dans les routes d’authentification.

---

## Sécurité globale : génération et validation des tokens JWT

**Les JSON Web Tokens suivent la spécification RFC 7519 :**

- ce sont des jetons signés via une clé secrète (HS256) ou une paire de clés (RS256) ;
- ils contiennent un **payload** comprenant :
  - un sujet (`sub`) : ici, le `username` ;
  - une date d’expiration (`exp`) ;
  - éventuellement un type de token (`type` : `access` ou `refresh`).

Documentation JWT (RFC 7519) :

[https://www.rfc-editor.org/rfc/rfc7519](https://www.rfc-editor.org/rfc/rfc7519)

**Dans ce service, deux types de tokens sont utilisés :**

- **Access token** (durée courte) : destiné à être présenté lors des appels aux micro-services (ex. Order Service) ;
- **Refresh token** (durée longue) : utilisé pour obtenir un nouveau access token lorsque celui-ci expire.

**Les paramètres de sécurité sont fournis par des variables d’environnement :**

- `JWT_SECRET` : clé de signature des tokens ;
- `JWT_ALGO` : algorithme (par défaut `HS256`) ;
- `ACCESS_TOKEN_EXPIRES_MIN` : durée de vie du token d’accès en minutes ;
- `REFRESH_TOKEN_EXPIRES_MIN` : durée de vie du token de rafraîchissement en minutes.

**Le module **`**security.py**`** est complété par :**

- `create_token(sub: str, refresh=False)` : génère un JWT `access` ou `refresh` ;
- `decode_token(token: str)` : vérifie la signature, la validité (`exp`) et retourne le payload.

### `security.py`

```python
"""
Module de gestion de la sécurité applicative :
- Hashage des mots de passe (bcrypt via Passlib)
- Vérification des mots de passe
- Création de tokens JWT (access + refresh)
- Décodage et vérification des tokens JWT
"""

from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import os


# ---------------------------------------------------------------------
# 🔐 Configuration sécurité (variables d'environnement)
# ---------------------------------------------------------------------

# Clé secrète pour signer les JWT (HS256)
# En production : clé longue, aléatoire, jamais committée.
SECRET_KEY = os.getenv("JWT_SECRET", "change-me")

# Algorithme cryptographique utilisé pour signer les tokens.
# Typiquement HS256 (symétrique) ou RS256 (asymétrique si clés RSA).
ALGORITHM = os.getenv("JWT_ALGO", "HS256")

# Durée d’expiration des tokens (en minutes)
ACCESS_EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRES_MIN", 60))
REFRESH_EXPIRE_MIN = int(os.getenv("REFRESH_TOKEN_EXPIRES_MIN", 43200))  # 30 jours


# ---------------------------------------------------------------------
# 🔒 Contexte Passlib : hashage bcrypt
# ---------------------------------------------------------------------

# bcrypt est la recommandation standard pour les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Retourne un hash sécurisée (bcrypt) du mot de passe en clair.
    Aucune conservation du mot de passe en clair en base.
    """
    return pwd_context.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    """
    Vérifie qu'un mot de passe correspond à son hash.
    Passlib gère automatiquement le salage et les paramètres bcrypt.
    """
    return pwd_context.verify(password, hash_)


# ---------------------------------------------------------------------
# 🔑 JWT : création + décodage
# ---------------------------------------------------------------------

def create_token(sub: str, refresh: bool = False) -> str:
    """
    Génère un JWT signé contenant :
    - sub : identifiant du sujet (ex. username)
    - exp : date d’expiration
    - type : 'access' ou 'refresh'

    Les durées d'expiration sont configurées via les variables .env.
    """
    expire = datetime.utcnow() + timedelta(
        minutes=REFRESH_EXPIRE_MIN if refresh else ACCESS_EXPIRE_MIN
    )

    payload = {
        "sub": sub,
        "exp": expire,
        "type": "refresh" if refresh else "access"
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Décode un JWT signé :
    - Vérifie la signature et l'expiration
    - Retourne le payload décodé
    - Lève jwt.ExpiredSignatureError ou jwt.InvalidTokenError en cas d’erreur
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

---

## Implémentation des routes d’authentification (register, login, refresh)

**1. Créer un **`**APIRouter**`** dédié (**`**auth.py**`**).**

L’API est structurée autour d’un router spécifique, monté ensuite dans `main.py` sous le préfixe `/auth`.

Documentation FastAPI (routers) :

[https://fastapi.tiangolo.com/tutorial/bigger-applications/](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

**2. Définir les entrées/sorties des routes.**

- Pour `register` et `login`, le service recevra des données en JSON (correspondant à l’appel du frontend Next.js).
- Pour `refresh`, les notes existantes et l’intégration TP02 prévoient un `Content-Type: application/x-www-form-urlencoded` avec un champ `refresh_token`. On utilise donc `Form(...)` pour ce dernier.

**3. Intégrer le hashage et la vérification de mot de passe.**

- `register` utilise `hash_password()` pour stocker un hash ;
- `login` utilise `verify_password()` pour comparer mot de passe / hash.

**4. Générer les tokens en réponse.**

- `login` renvoie `access_token`, `refresh_token`, `token_type`, `expires_in`.
- `refresh` renvoie un nouveau `access_token`.

### `auth.py`

```python
"""
Routes d'authentification du service :
- /register : création d'un utilisateur
- /login    : authentification + émission des tokens JWT
- /refresh  : renouvellement de l'access token via un refresh token
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from models import User
from db import get_session
from security import (
    create_token,
    verify_password,
    hash_password,
    decode_token,
)

router = APIRouter()


# ---------------------------------------------------------------------
# 🟦 Register : création d’un utilisateur
# ---------------------------------------------------------------------
@router.post("/register")
async def register(request: Request, session: Session = Depends(get_session)):
    """
    Création d'un utilisateur à partir d’un JSON :
    {
        "username": "john",
        "password": "secret"
    }
    """

    # Récupération des données envoyées
    data = await request.json()
    username = data.get("username")
    password = data.get("password")

    # Vérification minimale
    if not username or not password:
        raise HTTPException(status_code=400, detail="Missing username or password")

    # Vérifie l'unicité du username
    existing = session.exec(
        select(User).where(User.username == username)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Création de l'utilisateur (mot de passe haché)
    user = User(
        username=username,
        password_hash=hash_password(password),
    )

    session.add(user)
    session.commit()

    return {"message": "User created"}


# ---------------------------------------------------------------------
# 🟦 Login : authentification + création des tokens
# ---------------------------------------------------------------------
@router.post("/login")
async def login(request: Request, session: Session = Depends(get_session)):
    """
    Authentifie un utilisateur via un JSON :
    {
        "username": "john",
        "password": "secret"
    }

    Retourne :
    - access_token   (valide 1h par défaut)
    - refresh_token  (valide 30 jours par défaut)
    """

    data = await request.json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Missing username or password")

    # Recherche de l'utilisateur
    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    # Vérification du mot de passe
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Génération des tokens JWT
    access = create_token(username)
    refresh = create_token(username, refresh=True)

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 60 * 60,  # 1h exprimée en secondes
    }


# ---------------------------------------------------------------------
# 🟦 Refresh : renouvellement du token d'accès
# ---------------------------------------------------------------------
@router.post("/refresh")
async def refresh(request: Request):
    """
    Échange un refresh token contre un nouvel access token.
    Attend un JSON :
    {
        "refresh_token": "<token>"
    }
    """

    data = await request.json()
    refresh_token = data.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Missing refresh_token")

    try:
        # Décodage du refresh token
        payload = decode_token(refresh_token)

        # Vérification du type
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")

        # Nouveau token d'accès
        new_access = create_token(payload["sub"])
        return {"access_token": new_access}

    except Exception:
        # Token expiré / modifié / signature invalide
        raise HTTPException(status_code=401, detail="Invalid refresh token")

```

---

## Intégration dans l’application FastAPI : CORS, routers, JWKS

**1. Configurer l’application principale **`**FastAPI**`**.**

- Donner un titre (`Auth Service`),
- Configurer les CORS pour autoriser les requêtes provenant de `http://localhost:3000` (ou autre via variable d’environnement `CORS_ORIGINS`).

Documentation CORS (FastAPI) :

[https://fastapi.tiangolo.com/tutorial/cors/](https://fastapi.tiangolo.com/tutorial/cors/)

**2. Initialiser la base au démarrage via **`**@app.on_event("startup")**`**.**

`init_db()` crée les tables définies dans `models.py`.

**3. Monter les routes d’authentification.**

`app.include_router(auth_router, prefix="/auth", tags=["auth"])`

**4. (Optionnel) Ajouter un router JWKS (**`**jwks.py**`**).**

Ce dernier permet d’exposer des métadonnées de clé sous `/\.well-known/jwks.json`.

Avec un algorithme symétrique (HS256), cet endpoint est surtout pédagogique.

Avec RS256, il deviendra utile pour publier des clés publiques.

### `jwks.py`

```python
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
```

### `main.py`

```python
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

```

---

# Partie 3 — Stockage SQLite et visualisation

## Paramétrage du stockage SQLite

**La base SQLite est définie par l’URL **`**DATABASE_URL**`** dans le fichier **`**.env**`**.
Lors de l’instanciation du moteur SQLModel/SQLAlchemy, cette URL permet de créer ou d’ouvrir le fichier **`**auth.db**`**.**

**Le moteur déclaré dans **`**db.py**`** assure la connexion et la création du schéma via :**

```python
SQLModel.metadata.create_all(engine)
```

**Cette configuration est suffisante pour :**

- générer physiquement le fichier SQLite,
- créer la table `user`,
- assurer la persistance des données utilisateur.

**Afin de rendre la configuration explicite et réutilisable, le fichier **`**.env.example**`** documente les variables attendues.**

---

### `.env`

```bash
# Base de données locale (fichier SQLite)
DATABASE_URL=sqlite:///./auth.db

# JWT
JWT_SECRET=change-me-in-prod
JWT_ALGO=HS256
ACCESS_TOKEN_EXPIRES_MIN=60
REFRESH_TOKEN_EXPIRES_MIN=43200

# CORS
CORS_ORIGINS=http://localhost:3000
```

---

## Mise en place d’un script d’initialisation : création automatique de l’utilisateur admin

**Le script **`**init_db.py**`** réalise plusieurs opérations :**

- invoquer `SQLModel.metadata.create_all(engine)` pour garantir l’existence des tables ;
- ouvrir une session SQL via `Session(engine)` ;
- vérifier si un utilisateur `admin` existe déjà ;
- si ce n’est pas le cas, créer un utilisateur `admin` avec mot de passe haché ;
- confirmer la création via un affichage console.

**L’usage de **`**hash_password()**`** garantit que le mot de passe n’est pas stocké en clair, conformément aux exigences métier et de sécurité.**

---

### `init_db.py`

```python
from sqlmodel import SQLModel, Session, select
from db import engine
from models import User
from security import hash_password


def init_admin_user():
    """
    Initialise la base de données et crée un utilisateur admin
    si aucun utilisateur portant ce nom n'existe encore.
    """
    print("Initialisation de la base d'utilisateurs...")

    # Création des tables si elles n'existent pas déjà
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # Vérifier l'existence d'un utilisateur admin
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if admin:
            print("Utilisateur 'admin' déjà présent.")
            return

        # Hash sécurisé du mot de passe
        hashed_pw = hash_password("admin")

        # Création du compte administrateur
        session.add(User(username="admin", password_hash=hashed_pw))
        session.commit()

        print("Utilisateur administrateur créé (username=admin / password=admin)")


if __name__ == "__main__":
    init_admin_user()
```

---

## Visualisation du contenu de la base via une interface web SQLite

**L’outil **`**sqlite-web**`** constitue une solution légère et efficace pour explorer rapidement une base SQLite.**

**Son fonctionnement général :**

- installation locale via pip,
- ouverture d’un mini-serveur web,
- navigation graphique dans les tables et colonnes,
- exécution de requêtes SQL,
- inspection du schéma généré par SQLModel.

**En particulier, son usage permet de vérifier :**

- la présence du fichier `auth.db`,
- la structure de la table `user`,
- la présence de l’utilisateur `admin` généré par `init_db.py`,
- la cohérence des opérations effectuées par les endpoints `/auth/register` et `/auth/login`.

---

### Commandes sqlite-web

Installation :

```bash
pip install sqlite-web
```

Lancement :

```bash
sqlite_web auth.db
```

Cela génère une interface accessible localement, par exemple :

```plain text
http://127.0.0.1:8080
```

Depuis cette interface, il est possible d’inspecter :

- les tables (`user`),
- les colonnes (`id`, `username`, `password_hash`),
- les enregistrements existants,
- les requêtes SQL exécutées.

# Partie 4 — Lancement du serveur et vérifications CURL

## **Exécuter le script d’initialisation **

```bash
python init_db.py
```

Ce script crée la base, les tables et l’utilisateur `admin` si nécessaire.

---

## **Lancer le serveur FAST API en local après initialisation**

```bash
uvicorn main:app --reload --port 8000
```

---

## Vérifications rapides via CURL

**Valider le fonctionnement minimal du service d’authentification:**

**1. Tester **`**login**`

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

**2. Tester **`**refresh**`

```bash
curl -X POST http://127.0.0.1:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"COLLER_ICI_REFRESH_TOKEN\"}"
  
```

---

# Partie 5 — Mise à jour du frontend Dashboard : vérification du JWT

## Affichage du statut du token dans le Dashboard

**Adapter la page Dashboard pour :**

- récupérer le token SSR,
- indiquer s’il est présent,
- indiquer s’il a été envoyé dans le header `Authorization`,
- afficher les données reçues.

---

### `frontend/app/dashboard/page.tsx`

```typescript
import { serverApi } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export default async function Dashboard() {
  const api = serverApi()
  const token = await getAccessToken()

  const hasToken = Boolean(token)
  let tokenSent = false
  let orders: any[] = []

  try {
    const headers: Record<string, string> = { 'x-ssr': '1' }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      tokenSent = true
    }

    orders = await api.get('/orders', {
      headers,
      cache: 'no-store',
    })
  } catch {
    orders = []
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Dashboard</h1>

      <div style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #ddd' }}>
        <p><strong>Access Token présent :</strong> {hasToken ? 'Oui' : 'Non'}</p>
        <p><strong>Token envoyé :</strong> {tokenSent ? 'Oui' : 'Non'}</p>
      </div>

      <pre>{JSON.stringify(orders, null, 2)}</pre>
    </main>
  )
}

```

## Authentification via le navigateur web

**Lancer vos deux services (frontend + auth-service)**

```dart
// auth-service
uvicorn main:app --reload --port 8000

// frontend
npm run dev
```

**Rendez-vous sur ****[localhost:3000](http://localhost:3000)**** et authentifiez-vous avec le compte *****admin / admin***

Vous devriez pouvoir accéder à Dashboard.

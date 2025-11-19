# TP 05 - Conteneurisation (Docker + Docker Compose) - TD

# Partie 2 — Objectif du TP + Organisation finale

## Objectif du TP

**L’objectif de ce TP est de conteneuriser entièrement les trois services du projet microservices :**

- **frontend** (Next.js + API Gateway),
- **auth-service** (FastAPI + SQLite),
- **order-service** (NestJS + Prisma + SQLite),

**et de permettre leur exécution simultanée à l’aide d’un seul **`**docker-compose**`**.**

L’environnement final doit :

- fonctionner sur macOS, Windows ou Linux ;
- embarquer toutes les dépendances nécessaires ;
- exposer clairement les services :

| Service | Technologie | Port externe | Port interne conteneur |
| --- | --- | --- | --- |
| Frontend | Next.js | 3000 | 3000 |
| Auth-service | FastAPI + SQLite | 8000 | 8000 |
| Order-service | NestJS + SQLite | 4000 | 4000 |

**Le lancement doit se résumer à une commande unique :**

```bash
docker-compose up --build
```

**et la fermeture complète :**

```bash
docker-compose down -v
```

---

## Organisation finale du projet

**L’arborescence standardisée du TP doit être la suivante :**

```plain text
microservices/
├── frontend/
│   ├── Dockerfile
│   ├── .env
│   └── ...
├── auth-service/
│   ├── Dockerfile
│   ├── .env
│   └── ...
├── order-service/
│   ├── Dockerfile
│   ├── .env
│   └── ...
└── docker-compose.yml
```

**Chaque service contient :**

- un `Dockerfile` complet,
- un fichier `.env` chargé par Docker Compose,
- ses propres sources applicatives,
- son éventuelle base SQLite montée dans un volume dédié (ex. `auth_db_data`, `order_db_data`).

---

## Architecture attendue après conteneurisation

```plain text
[ navigateur ]
       ↓
localhost:3000  →  frontend (Next.js + API Gateway)
                          ↓
                 /api/auth → auth-service (FastAPI)
                 /api/orders → order-service (NestJS)
```

**Les services ne communiquent plus avec **`**localhost**`**, mais entre eux grâce au réseau Docker :**

- `http://auth-service:8000`
- `http://order-service:4000/orders`

# Partie 3 — Les Dockerfile

## Dockerfile du Auth-service (FastAPI + SQLite)

Ce Dockerfile produit une image Python minimaliste capable de :

- installer les dépendances depuis `requirements.txt` ;
- créer automatiquement la base SQLite et l’utilisateur admin via `init_db.py` ;
- démarrer le serveur FastAPI sous Uvicorn.

### **auth-service/Dockerfile**

```docker
FROM python:3.12-slim

# Répertoire de travail du conteneur
WORKDIR /app

# Copie des dépendances Python et installation
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code de l'application
COPY . .

# Permet à Python de trouver automatiquement les modules locaux
ENV PYTHONPATH=/app

# Lancement : initialise la base puis démarre Uvicorn
CMD ["bash", "-c", "python init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
```

**Points importants**

- L’image utilise un Python minimal (`slim`) pour réduire la taille.
- `PYTHONPATH=/app` permet à `main.py`, `auth.py`, `security.py` d’être importés proprement.
- `init_db.py` garantit que la base SQLite et l’utilisateur `admin` existent au démarrage.
- Le port exposé dans le conteneur est **8000**, mais sera mappé côté host via docker-compose.

---

## Dockerfile du Order-service (NestJS + Prisma + SQLite)

Ce Dockerfile est multi-étage pour optimiser la taille finale :

1. une image builder (installe dépendances, génère Prisma, compile TypeScript),
1. une image runner (n’embarque que le code compilé et les dépendances nécessaires).

### **order-service/Dockerfile**

```docker
# Étape 1 : Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances NPM
COPY package*.json ./
RUN npm ci

# Copie du reste du code source
COPY . .

# Génération du client Prisma
RUN npx prisma generate

# Compilation du projet NestJS
RUN npm run build

# Étape 2 : Runner minimal
FROM node:20-alpine AS runner

WORKDIR /app

# Copie des artefacts essentiels
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000

# IMPORTANT : chemin absoluté dans l'image
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV JWT_SECRET="change-me"

RUN npx prisma migrate deploy

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
```

**Points importants**

- `npm ci` garantit une installation reproductible basée sur `package-lock.json`.
- Prisma génère un client compatible avec SQLite avant compilation.
- Le runner final ne contient pas TypeScript ni Prisma CLI, seulement le code JS final et le client Prisma.
- Le port interne du conteneur est **4000**.

---

## Dockerfile du Frontend (Next.js)

Deux étapes également : build → runtime.

### **frontend/Dockerfile**

```docker
# Étape 1 : Build
FROM node:20-alpine AS builder

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code source et build Next.js
COPY . .
RUN npm run build

# Étape 2 : Runtime minimal
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copie de la build Next.js
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./

# Installation uniquement des dépendances nécessaires au runtime
RUN npm ci --omit=dev

EXPOSE 3000

CMD ["npm", "start"]


```

**Points importants**

- Next.js génère une build dans `.next/` qui est ensuite exécutée dans une image plus légère.
- `npm ci --omit=dev` supprime les dépendances inutiles en production.
- Le conteneur écoute en interne sur le port **3000**, mappé via docker-compose.

---

# Partie 4 — Mise à jour des variables d’environnement

Les trois microservices utilisent chacun un fichier `**.env**` et doivent désormais fonctionner **à la fois en local et en conteneur Docker**.

Cette partie formalise les bonnes pratiques permettant :

- d’avoir un `.env` dédié à chaque service ;
- d’assurer le bon chargement des variables dans Docker ;
- de gérer correctement les bases SQLite persistées dans les volumes ;
- d’unifier les communications inter-conteneurs via les **hostnames Docker Compose**.

---

### Objectifs des variables d’environnement dans une architecture microservices

Les variables d’environnement servent à :

- **isoler les configurations** propres à chaque service ;
- éviter toute configuration hardcodée dans les sources ;
- permettre de basculer facilement entre :
  - environnement local hors Docker
  - environnement Docker Compose
  - environnement de production
- assurer la compatibilité multiplateforme (macOS, Windows, Linux).

Chaque service dispose donc :

- d’un fichier `.env` pour le mode Docker ;
- éventuellement d’un `.env.local` pour un usage hors Docker ;
- d’un `.env.production` pour un déploiement réel.

---

### Rappel : fonctionnement des fichiers `.env` dans Docker

Lorsque docker-compose utilise :

```yaml
env_file:
  - ./service/.env
```

alors :

- **toutes les variables du fichier **`**.env**`** sont injectées dans le conteneur** ;
- `process.env.*` (Node.js) ou `os.getenv()` (Python) y ont accès immédiatement ;
- les fichiers `.env.local` **ne sont pas utilisés par Docker** (seulement par Next.js en mode dev).

Les `.env` doivent donc être adaptés aux contraintes internes du réseau Docker :

- les URL doivent utiliser les **hostnames Docker** :
  `http://auth-service:8000`, `http://order-service:4000`
- jamais `localhost` (cela désigne le conteneur lui-même, pas la machine hôte)

---

## Variables d’environnement du Auth-service

### `**auth-service/.env**`

```bash
# JWT variables
JWT_SECRET=change-me
JWT_ALGO=HS256
ACCESS_TOKEN_EXPIRES_MIN=60
REFRESH_TOKEN_EXPIRES_MIN=43200

# Build variables
CORS_ORIGINS=http://localhost:3000

# SQLite variables
DATABASE_URL=sqlite:///db/auth.db
```

**Points importants**

- Le chemin `sqlite:///db/auth.db` correspond au point de montage du volume Docker :
  ```yaml
  volumes:
    - auth_db_data:/app/db
  ```
- Le Frontend y accède via `http://auth-service:8000` (déclaré dans son `.env`).

---

## Variables d’environnement du Order-service

### `**order-service/.env**`

```bash
# JWT variables
JWT_SECRET=change-me

# Build variables
PORT=4000

# SQLite variables
DATABASE_URL="file:./dev.db"
```

**Points importants**

- Prisma demande une URL `file:./dev.db` relative au répertoire `prisma/`.
- Le volume Docker monte le dossier :
  ```yaml
  volumes:
    - order_db_data:/app/prisma/db
  ```
  ce qui permet à SQLite d’être persistant entre 2 `docker-compose up`.
- Le service s’exécutant dans Docker doit utiliser :
  ```bash
  JWT_SECRET=change-me
  ```
  (identique à auth-service pour que la vérification du JWT soit possible).

---

## Variables d’environnement du Frontend (Next.js)

Le frontal distingue :

- `.env.local` → utilisation hors Docker (local, dev)
- `.env` → utilisation interne à Docker Compose
- `.env.production` → utilisation en déploiement

---

### `.env` (utilisé par Docker Compose)

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3000/api
AUTH_SERVICE_URL=http://auth-service:8000
ORDER_SERVICE_URL=http://order-service:4000/orders
```

### `.env.local` (mode développement sans Docker)

```bash
AUTH_SERVICE_URL=http://localhost:8000
ORDER_SERVICE_URL=http://localhost:4000/orders
```

### `.env.production` (serveur de production)

```bash
NEXT_PUBLIC_API_BASE=http://devops.local/api
AUTH_SERVICE_URL=http://devops.local
ORDER_SERVICE_URL=http://devops.local/orders
```

---

## Bonnes pratiques de gestion des variables d’environnement

**Ne jamais commiter un **`**.env.local**`

Ce fichier doit contenir des secrets uniquement pour le développement local.

**Ne jamais coder en dur les URL**

Toujours utiliser les variables :

```typescript
process.env.AUTH_SERVICE_URL
process.env.ORDER_SERVICE_URL


```

**Utiliser des valeurs cohérentes entre services**

Exemple : `JWT_SECRET` doit être strictement identique dans auth-service et order-service.

**Toujours vérifier que Docker charge bien les **`**.env**`

```bash
docker-compose config
```

Cette commande :

- assemble la configuration finale ;
- montre les variables injectées ;
- détecte les erreurs d’indentation YAML.

## Vérification individuelle des builds

Avant d’intégrer les Dockerfile dans docker-compose, il est recommandé de vérifier que chaque image construit correctement.

Dans le dossier racine :

```bash
docker build -t auth-service:dev ./auth-service
docker build -t order-service:dev ./order-service
docker build -t frontend:dev ./frontend
```

---

# Partie 5 — Docker Compose et YAML

---

## Présentation générale

Docker Compose permet de :

- définir plusieurs services au sein d’un même fichier YAML ;
- décrire pour chacun le **build**, les **ports**, les **volumes**, les **variables d’environnement**, les **dépendances** ;
- garantir que les conteneurs communiquent via un **réseau interne dédié** ;
- démarrer l’ensemble avec une seule commande :

```bash
docker-compose up --build
```

(La commande `docker compose` fonctionne également selon les installations.)

L’objectif de ce projet est de réunir :

| Service | Port externe | Rôle |
| --- | --- | --- |
| frontend | 3000 | Interface utilisateur + API Gateway |
| auth-service | 8000 | Service d’authentification (FastAPI + SQLite) |
| order-service | 4000 | Service commandes (NestJS + Prisma + SQLite) |

---

## Structure du fichier `docker-compose.yml`

```yaml
version: "3.0"

services:
  auth-service:
    build:
      context: ./auth-service
    container_name: auth-service
    ports:
      - "8000:8000"
    env_file:
      - ./auth-service/.env
    volumes:
      - auth_db_data:/app/db
    restart: unless-stopped

  order-service:
    build:
      context: ./order-service
    container_name: order-service
    ports:
      - "4000:4000"
    env_file:
      - ./order-service/.env
    volumes:
      - order_db_data:/app/prisma/db
    depends_on:
      - auth-service
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    container_name: frontend
    ports:
      - "3000:3000"
    env_file:
      - ./frontend/.env
    depends_on:
      - auth-service
      - order-service
    restart: unless-stopped

volumes:
  auth_db_data:
  order_db_data:


```

---

## Analyse

**Définition du service **`**auth-service**`

```yaml
auth-service:
  build:
    context: ./auth-service
```

Indique que Docker doit construire l’image à partir du répertoire `auth-service/` contenant son Dockerfile.

```yaml
container_name: auth-service
```

Nom lisible du conteneur. Permet d’entrer dans le conteneur facilement :

```bash
docker exec -it auth-service sh
```

```yaml
ports:
  - "8000:8000"
```

Expose le port interne 8000 du conteneur vers le port 8000 local.

```yaml
env_file:
  - ./auth-service/.env
```

Charge automatiquement les variables d’environnement nécessaires.

```yaml
volumes:
  - auth_db_data:/app/db
```

Monte le volume Docker pour la base SQLite.

Le fichier SQLite devient persistant, même si le conteneur est recréé.

```yaml
restart: unless-stopped
```

Redémarre automatiquement le service en cas de crash.

---

**Définition du service **`**order-service**`

```yaml
order-service:
  build:
    context: ./order-service
```

Construit l’image Node.js + Prisma depuis `order-service/`.

```yaml
ports:
  - "4000:4000"
```

Expose le service sur `localhost:4000`.

```yaml
env_file:
  - ./order-service/.env
```

Charge les variables nécessaires (JWT_SECRET, DATABASE_URL…).

```yaml
volumes:
  - order_db_data:/app/prisma/db
```

Permet de conserver `dev.db` entre deux exécutions.

```yaml
depends_on:
  - auth-service
```

Assure l’ordre de démarrage.

Ce n’est **pas** un mécanisme de vérification mais une dépendance logique.

---

**Définition du service **`**frontend**`

```yaml
frontend:
  build:
    context: ./frontend
```

Construit l’image Next.js (Build stage + Runtime stage).

```yaml
ports:
  - "3000:3000"
```

Le frontend est accessible via `localhost:3000`.

```yaml
env_file:
  - ./frontend/.env
```

Charge les URLs interne Docker :

- `AUTH_SERVICE_URL=http://auth-service:8000`
- `ORDER_SERVICE_URL=http://order-service:4000/orders`

```yaml
depends_on:
  - auth-service
  - order-service
```

Garantit que les backend sont lancés avant Next.js.

---

## Les volumes Docker

En bas du fichier :

```yaml
volumes:
  auth_db_data:
  order_db_data:
```

Ces volumes sont :

- gérés par Docker ;
- persistants ;
- indépendants du cycle de vie des conteneurs.

Vous pouvez les inspecter :

```bash
docker volume ls
docker volume inspect microservices_auth_db_data
```

Ou ouvrir une base SQLite depuis un conteneur :

```bash
docker exec -it order-service sqlite3 prisma/dev.db
```

---

## Communication entre conteneurs

Les services peuvent s’adresser entre eux via leurs **hostnames** :

| Depuis | Accès à |
| --- | --- |
| frontend | `http://auth-service:8000` |
| frontend | `http://order-service:4000/orders` |
| order-service | n’a pas besoin de contacter auth-service |

Il est crucial que **le frontend ne tente jamais d’appeler **`**localhost:8000**`** dans Docker**.

Cela désignerait le conteneur frontend lui-même, pas la machine.

---

# Partie 6 — Tester tous les services

Cette partie valide la conteneurisation complète du projet.

L’objectif est de reconstruire proprement les images, démarrer tous les services, vérifier leur état, puis tester le fonctionnement via `curl` et via le navigateur.

---

## Reconstruction complète des images

Il est recommandé de reconstruire **sans cache**, afin de s’assurer que les Dockerfile et les dépendances sont bien appliqués.

```bash
docker-compose build --no-cache
```

Cela reconstruit les images de :

- `auth-service`
- `order-service`
- `frontend`

Lorsque les builds sont terminés, on peut vérifier :

```bash
docker images
```

Les images `auth-service`, `order-service` et `frontend` doivent apparaître.

---

## Démarrage de l’ensemble des microservices

Une fois les images reconstruites :

```bash
docker-compose up
```

ou en mode détaché :

```bash
docker-compose up -d
```

Vérification du bon démarrage :

```bash
docker-compose ps
```

Les trois conteneurs doivent être en état **Up** :

```plain text
frontend         Up      0.0.0.0:3000->3000/tcp
auth-service     Up      0.0.0.0:8000->8000/tcp
order-service    Up      0.0.0.0:4000->4000/tcp
```

---

## Vérification via les endpoints `/health`

Chaque service expose un endpoint de vérification.

### Auth-service (FastAPI)

```bash
curl http://localhost:8000/health
```

Réponse attendue :

```json
{"status": "ok"}
```

### Order-service (NestJS)

```bash
curl http://localhost:4000/health
```

Réponse attendue :

```json
{"status":"ok","service":"orders"}
```

### Frontend (Next.js)

```bash
curl http://localhost:3000/api/health
```

Réponse typique :

```json
{"status": "ok"}
```

---

## Test complet du workflow JWT + Orders via curl

### 1. Obtenir un JWT depuis Auth-service

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

Réponse attendue :

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

Copier **access_token**.

---

### 2. Tester Order-service avec le JWT

### Créer une commande

```bash
curl -X POST http://localhost:4000/orders \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"item": "book-123"}'
```

Réponse attendue :

```json
{
  "id": 1,
  "user": "admin",
  "item": "book-123",
  "createdAt": "..."
}
```

### Lister les commandes

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:4000/orders
```

### Supprimer une commande

```bash
curl -X DELETE http://localhost:4000/orders/1 \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Vérification via le Frontend (navigateur)

1. Ouvrir :

```plain text
http://localhost:3000
```

1. Aller dans **Login**
  - username : `admin`
  - password : `admin`
1. Après connexion, la page `/dashboard` doit afficher :
  - soit une liste vide,
  - soit les commandes précédemment créées.
1. Tester :
  - Création d’une commande
  - Rafraîchissement automatique
  - Suppression de commande

Le tableau doit se mettre à jour correctement.

---

## Vérification du réseau Docker

### Voir les conteneurs et leur réseau

```bash
docker network ls
```

Le réseau par défaut créé par docker-compose doit apparaître, par exemple :

```plain text
microservices_default
```

Inspecter les IP internes des conteneurs :

```bash
docker network inspect microservices_default
```

---

## Vérification des volumes SQLite

### Lister les volumes

```bash
docker volume ls
```

On doit voir :

```plain text
microservices_auth_db_data
microservices_order_db_data
```

### Inspecter un volume

```bash
docker volume inspect microservices_auth_db_data
```

### Entrer dans un conteneur pour consulter SQLite

```bash
docker exec -it order-service sh
sqlite3 prisma/dev.db
```

---

## Arrêt et nettoyage

Arrêt simple :

```bash
docker-compose down
```

Arrêt + suppression des volumes :

```bash
docker-compose down -v
```

> Attention : cette commande supprime les bases SQLite (auth.db et dev.db).

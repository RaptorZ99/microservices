# I Want it — Plateforme microservices

Quatre services containerisés illustrant un parcours d'authentification et des appels inter-microservices via une façade Next.js.

```
Utilisateur → Next.js (cookies httpOnly) → Auth Service
                                   ↳ Order Service (CRUD commandes)
                                   ↳ Book Service (OpenLibrary)
```

## Architecture et responsabilités

| Service        | Stack                              | Port | Stockage    | Rôle principal |
|----------------|------------------------------------|------|-------------|----------------|
| frontend       | Next.js 16 (App Router)            | 3000 | stateless   | UI + passerelle `/api/*` |
| auth-service   | FastAPI + SQLModel                 | 8000 | SQLite      | Register / Login / Refresh (JWT HS256) |
| order-service  | NestJS + Prisma 7 + better-sqlite3 | 4000 | SQLite      | CRUD des commandes authentifiées |
| book-service   | NestJS + Prisma 7 + better-sqlite3 | 9000 | SQLite      | Recherche OpenLibrary + bibliothèque utilisateur |

- Tous les services exposent `/health` (liveness/readiness en Kubernetes).
- Le secret `JWT_SECRET` est partagé : signature et vérification HS256 alignées entre les trois backends et la gateway.
- Les Dockerfile sont multi-étapes (build → runtime léger) avec `.dockerignore` pour éviter de copier les `node_modules` locaux.
- Les manifestes Kubernetes montent des PVC sur `/app/data` (NestJS) et `/app/db` (auth) pour persister les bases SQLite sans écraser le schema Prisma.

## Fonctionnement applicatif

- **Authentification** : `POST /auth/login` (JSON `username` / `password`) génère `access_token` (1 h) et `refresh_token` (30 j). Un compte `admin`/`admin` est créé automatiquement au démarrage si absent.
- **Gateway Next.js** : route `/api/auth-login` appelle l'Auth Service puis écrit `access_token` et `refresh_token` en cookies httpOnly. Les routes `/api/orders*` et `/api/books*` relaient ensuite le JWT dans `Authorization: Bearer ...`.
- **Middleware** : les routes `/order` et `/book` sont protégées par un middleware Next.js qui vérifie la présence du cookie `access_token` et redirige vers `/` si absent.
- **Order Service** : routes protégées par `JwtAuthGuard` (Nest). Endpoints `/orders` (GET/POST), `/orders/:id` (GET/DELETE) filtrés par l'utilisateur issu du JWT (`sub`).
- **Book Service** : mêmes protections JWT. Endpoints `/books/search?q=&scope=title|author`, `/books/library` (GET/POST), `/books/library/:workId` (DELETE), `/books/details/:workId`. Les données livres sont récupérées sur l'API publique OpenLibrary et seules les références (workId) sont stockées.
- **Refresh** : `POST /auth/refresh` attend un JSON `{"refresh_token": "..."}` et renvoie un nouvel access token ; le frontend expose `/api/refresh` pour automatiser l'appel côté serveur.

## Structure du dépôt

```
auth-service/        FastAPI + SQLModel + bcrypt + JWT (HS256)
order-service/       NestJS + Prisma 7 + better-sqlite3, DTO validés, guard JWT
book-service/        NestJS + Prisma 7 + better-sqlite3, client OpenLibrary
frontend/            Next.js 16 (App Router), API Routes de proxy, UI (Commandes & Livres)
  app/(protected)/   Route group — layout partagé entre /order et /book
  middleware.ts      Protection des routes authentifiées
k8s/                 namespace, deployments, services, PVC, ingress Minikube
docker-compose.yml   Orchestration locale des quatre conteneurs
.gitlab-ci.yml       Point d'entrée du pipeline CI/CD
.gitlab/
  ci/
    frontend.yml     Pipeline frontend (lint, notify, build, verify:build)
    auth-service.yml Pipeline auth (lint, build)
    order-service.yml Pipeline order (lint, build)
    book-service.yml Pipeline book (lint, build)
  merge_request_templates/
    Default.md       Template de Merge Request
  CODEOWNERS         Responsables par service
```

## Variables d'environnement (Docker Compose)

Les fichiers `.env` sont fournis dans chaque dossier et référencés par `docker-compose.yml`. Points importants :
- `JWT_SECRET` doit être identique dans `auth-service`, `order-service`, `book-service` et la gateway.
- Les services NestJS utilisent un driver adapter (`@prisma/adapter-better-sqlite3`) — la `DATABASE_URL` pointe vers `/app/data/dev.db` (volume Docker séparé du dossier `prisma/`).
- OpenLibrary : `OPENLIBRARY_USER_AGENT` et `BOOK_SEARCH_LIMIT` pilotent l'appel externe.

Exemple de configuration (valeurs par défaut fournies) :

`auth-service/.env`
```conf
DATABASE_URL=sqlite:////app/db/auth.db
JWT_SECRET=change-me
JWT_ALGO=HS256
ACCESS_TOKEN_EXPIRES_MIN=60
REFRESH_TOKEN_EXPIRES_MIN=43200
CORS_ORIGINS=http://localhost:3000
```

`order-service/.env`
```conf
PORT=4000
DATABASE_URL=file:/app/data/dev.db
JWT_SECRET=change-me
```

`book-service/.env`
```conf
PORT=9000
DATABASE_URL=file:/app/data/dev.db
JWT_SECRET=change-me
OPENLIBRARY_USER_AGENT=BookInsights/1.0 (contact@example.com)
BOOK_SEARCH_LIMIT=12
```

`frontend/.env`
```conf
AUTH_SERVICE_URL=http://auth-service:8000
ORDER_SERVICE_URL=http://order-service:4000/orders
BOOK_SERVICE_URL=http://book-service:9000/books
NEXT_PUBLIC_API_BASE=http://localhost:3000/api
```

## Lancement local (Docker Compose)

Prérequis : Docker + Docker Compose.

1) Construire les images :
`docker compose build`

2) Démarrer :
`docker compose up -d`

3) Contrôles de santé :
`curl http://localhost:8000/health`
`curl http://localhost:4000/health`
`curl http://localhost:9000/health`
`curl http://localhost:3000/api/health`

4) Premier login (compte seedé) :
`curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}'`

5) Parcours applicatif : `http://localhost:3000` → login → `/order` pour gérer les commandes, `/book` pour chercher des ouvrages OpenLibrary, les ajouter à la bibliothèque et consulter les détails.

6) Logs :
`docker compose logs -f frontend auth-service order-service book-service`

7) Arrêt :
`docker compose down` (ajouter `-v` pour supprimer les volumes SQLite et repartir d'un état vierge).

Volumes utilisés : `auth_db_data` (`/app/db`), `order_db_data` (`/app/data`), `book_db_data` (`/app/data`).

## API de référence

- **Auth Service (FastAPI)** :
  - `POST /auth/register` (`username`, `password`)
  - `POST /auth/login` (`username`, `password`)
  - `POST /auth/refresh` (`refresh_token` en JSON)
  - `GET /.well-known/jwks.json`
  - `GET /health`
- **Order Service (NestJS)** :
  - `GET /orders` — liste des commandes de l'utilisateur courant
  - `POST /orders` — création `{ item }`
  - `GET /orders/:id` — détail si propriétaire
  - `DELETE /orders/:id` — suppression si propriétaire
  - `GET /health`
- **Book Service (NestJS)** :
  - `GET /books/search?q=...&scope=title|author`
  - `GET /books/library` — bibliothèque utilisateur
  - `POST /books/library` — ajoute `{ workId }`
  - `DELETE /books/library/:workId` — retire une entrée
  - `GET /books/details/:workId` — fiche enrichie OpenLibrary
  - `GET /health`
- **Gateway Next.js** :
  - `/api/auth-login`, `/api/refresh` (gestion des cookies JWT)
  - `/api/orders*`, `/api/books*` (proxy vers les microservices)
  - `/api/health`

## Déploiement Kubernetes (Minikube)

Prérequis : `kubectl`, `minikube`, addon `ingress`.

1) Démarrer le cluster :
`minikube start --driver=docker`

2) Déployer le namespace puis les ressources :
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/auth -n microservices
kubectl apply -f k8s/order -n microservices
kubectl apply -f k8s/book -n microservices
kubectl apply -f k8s/frontend -n microservices
kubectl apply -f k8s/ingress -n microservices
```

3) Activer et exposer l'ingress :
```bash
minikube addons enable ingress
minikube tunnel            # laisser ouvert
echo "127.0.0.1 devops.local" | sudo tee -a /etc/hosts
```

4) Vérifications rapides :
`kubectl get pods,svc,ingress -n microservices`

5) Accès utilisateur : `http://devops.local` → login → `/order` et `/book`.

6) Nettoyage complet :
`kubectl delete ns microservices`

## CI/CD — GitLab Pipeline

**Repo** : https://gitlab.com/loulou.scarfone/microservices

Pipeline GitLab CI/CD mono-repo avec jobs conditionnels par service, images Docker production-ready, et sécurité supply chain.

### Workflow Gitflow simplifié

| Branche | Pipeline | Environnement |
|---------|----------|---------------|
| `feature/*` / `hotfix/*` | verify + lint | Feedback rapide |
| `develop` | verify + lint + build + scan (SBOM + Grype) | Staging / Dev |
| `main` | verify + lint + build + scan (SBOM + Grype) + sign (Cosign) | Production |

- `feature/*` → `develop` via Merge Request
- `develop` → `main` via MR + validation manuelle
- Push direct interdit sur `main` et `develop` (branches protégées)
- `workflow:` avec `$CI_OPEN_MERGE_REQUESTS` empêche les pipelines dupliqués (push + MR)

### Stages et DAG par service

```
verify:structure          (global, toujours)
       ↓
  lint:SERVICE             (si fichiers du service modifiés)
       ↓
  build:SERVICE            (develop/main — Docker build + push GitLab Registry)
       ↓
  sbom:SERVICE             (develop/main — inventaire SBOM via Syft, format CycloneDX)
       ↓
  grype:SERVICE            (develop/main — scan de vulnérabilités depuis le SBOM)
       ↓
  sign:SERVICE             (main uniquement — signature Cosign de l'image)
```

Chaque service a sa propre chaîne DAG indépendante. Si le lint d'un service échoue, seul son build/scan est bloqué — les autres services continuent.

### Jobs conditionnels

Chaque service a ses propres `rules: changes` — seuls les jobs du service modifié s'exécutent. Les builds utilisent `$SERVICE_NAME` dans les rules `changes` du template, expansé depuis les `variables:` du job enfant.

### Templates réutilisables

| Template | Fichier | Rôle |
|----------|---------|------|
| `.job:build-push` | `.gitlab/ci/templates/build-push.yml` | Build Docker + push GitLab Registry (tags SHA, branche, semver, latest) |
| `.job:sbom` | `.gitlab/ci/templates/scan.yml` | Génération SBOM CycloneDX via Syft |
| `.job:grype` | `.gitlab/ci/templates/scan.yml` | Scan de vulnérabilités via Grype |
| `.job:sign` | `.gitlab/ci/templates/scan.yml` | Signature d'image via Cosign |

### Dockerfiles production-ready

Tous les services utilisent des Dockerfiles multi-stage :
- Images de base Alpine / slim (réduction ~70-80% de la taille)
- Séparation build / runtime (pas de devDependencies en prod)
- Utilisateur non-root (`appuser`)
- Labels OCI (titre, description, commit, date, source)
- `.dockerignore` complets

### Linters par service

| Service | Linter |
|---------|--------|
| frontend | ESLint (`npm run lint`) |
| auth-service | flake8 (`--max-line-length=120 --exclude=.venv`) |
| order-service | ESLint + Prisma generate |
| book-service | ESLint + Prisma generate |

### Variables CI/CD

| Variable | Type | Usage |
|----------|------|-------|
| `APP_ENV` | Variable | Environnement CI |
| `COSIGN_PRIVATE_KEY` | File | Clé privée pour signature d'images |
| `COSIGN_PUBLIC_KEY` | Variable | Clé publique pour vérification |
| `COSIGN_PASSWORD` | Variable (masked) | Passphrase Cosign |
| `DOCKERHUB_USERNAME` | Variable | Identifiant Docker Hub (optionnel) |
| `DOCKERHUB_TOKEN` | Variable (masked) | Token Docker Hub (optionnel) |

## Tests

- Les services NestJS incluent des suites Jest : `npm test` dans `book-service/` ou `order-service/`.
- Probes `/health` sur chaque service + `/api/health` côté gateway.

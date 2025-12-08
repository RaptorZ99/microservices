# Plateforme microservices — Auth / Orders / Books / Gateway Next.js

Quatre services containerisés illustrant un parcours d’authentification et des appels inter-microservices via une façade Next.js.

```
Utilisateur → Next.js (cookies httpOnly) → Auth Service
                                   ↳ Order Service (CRUD commandes)
                                   ↳ Book Service (OpenLibrary)
```

## Architecture et responsabilités

| Service        | Stack                    | Port | Stockage    | Rôle principal |
|----------------|--------------------------|------|-------------|----------------|
| frontend       | Next.js 16 (App Router)  | 3000 | stateless   | UI + passerelle `/api/*` |
| auth-service   | FastAPI + SQLModel       | 8000 | SQLite      | Register / Login / Refresh (JWT HS256) |
| order-service  | NestJS + Prisma          | 4000 | SQLite      | CRUD des commandes authentifiées |
| book-service   | NestJS + Prisma          | 9000 | SQLite      | Recherche OpenLibrary + bibliothèque utilisateur |

- Tous les services exposent `/health` (liveness/readiness en Kubernetes).
- Le secret `JWT_SECRET` est partagé : signature et vérification HS256 alignées entre les trois backends et la gateway.
- Les Dockerfile sont multi-étapes (build → runtime léger) et les manifestes Kubernetes montent des PVC pour conserver les bases SQLite.

## Fonctionnement applicatif

- **Authentification** : `POST /auth/login` (JSON `username` / `password`) génère `access_token` (1 h) et `refresh_token` (30 j). Un compte `admin`/`admin` est créé automatiquement au démarrage via `init_db.py` si absent.
- **Gateway Next.js** : route `/api/auth-login` appelle l’Auth Service puis écrit `access_token` et `refresh_token` en cookies httpOnly. Les routes `/api/orders*` et `/api/books*` relaient ensuite le JWT dans `Authorization: Bearer ...`.
- **Order Service** : routes protégées par `JwtAuthGuard` (Nest). Endpoints `/orders` (GET/POST), `/orders/:id` (GET/DELETE) filtrés par l’utilisateur issu du JWT (`sub`).
- **Book Service** : mêmes protections JWT. Endpoints `/books/search?q=&scope=title|author`, `/books/library` (GET/POST), `/books/library/:workId` (DELETE), `/books/details/:workId`. Les données livres sont récupérées sur l’API publique OpenLibrary (User-Agent configurable) et seules les références (workId) sont stockées.
- **Refresh** : `POST /auth/refresh` attend un JSON `{"refresh_token": "..."}` et renvoie un nouvel access token ; le frontend expose `/api/refresh` pour automatiser l’appel côté serveur.

## Structure du dépôt
- `auth-service/` : FastAPI + SQLModel + bcrypt + JWT (HS256). Admin seedé (`admin`/`admin`).
- `order-service/` : NestJS + Prisma + SQLite, DTO validés (class-validator), guard JWT maison.
- `book-service/` : NestJS + Prisma + SQLite, client OpenLibrary, cache d’auteurs en mémoire.
- `frontend/` : Next.js 16 (App Router), API Routes de proxy, UI dashboard (Commandes & Bibliothèque).
- `k8s/` : namespace, deployments, services, PVC, ingress Minikube.
- `docker-compose.yml` : orchestration locale des quatre conteneurs.

## Variables d’environnement (Docker Compose)
Les fichiers `.env` sont déjà fournis dans chaque dossier et référencés par `docker-compose.yml`. Points importants :
- `JWT_SECRET` doit être identique dans `auth-service`, `order-service`, `book-service` et la gateway.
- Le chemin par défaut de l’Auth Service pointe déjà sur le volume (`DATABASE_URL=sqlite:////app/db/auth.db`) monté par `auth_db_data`.
- OpenLibrary : `OPENLIBRARY_USER_AGENT` et `BOOK_SEARCH_LIMIT` pilotent l’appel externe.

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
DATABASE_URL=file:/app/prisma/dev.db
JWT_SECRET=change-me
```

`book-service/.env`
```conf
PORT=9000
DATABASE_URL=file:/app/prisma/dev.db
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

1) Vérifier les `.env` (secret partagé) puis construire les images :  
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

5) Parcours applicatif : `http://localhost:3000` → login → `/dashboard/order` pour gérer les commandes, `/dashboard/book` pour chercher des ouvrages OpenLibrary, les ajouter à la bibliothèque et consulter les détails.

6) Logs :  
`docker compose logs -f frontend auth-service order-service book-service`

7) Arrêt :  
`docker compose down` (ajouter `-v` pour supprimer les volumes SQLite et repartir d’un état vierge).

Volumes utilisés : `auth_db_data` (`/app/db/auth.db`), `order_db_data` (`/app/prisma/dev.db`), `book_db_data` (`/app/prisma/dev.db`).

## API de référence
- **Auth Service (FastAPI)** :  
  - `POST /auth/register` (`username`, `password`)  
  - `POST /auth/login` (`username`, `password`)  
  - `POST /auth/refresh` (`refresh_token` en JSON)  
  - `GET /.well-known/jwks.json` (JWKS fictif pour HS256)  
  - `GET /health`
- **Order Service (NestJS)** :  
  - `GET /orders` — liste des commandes de l’utilisateur courant  
  - `POST /orders` — création `{ item }`  
  - `GET /orders/:id` — détail si propriétaire  
  - `DELETE /orders/:id` — suppression si propriétaire  
  - `GET /health`
- **Book Service (NestJS)** :  
  - `GET /books/search?q=...&scope=title|author`  
  - `GET /books/library` — bibliothèque utilisateur  
  - `POST /books/library` — ajoute `{ workId }` (unicité par user/workId)  
  - `DELETE /books/library/:workId` — retire une entrée  
  - `GET /books/details/:workId` — fiche enrichie OpenLibrary  
  - `GET /health`
- **Gateway Next.js** :  
  - `/api/auth-login`, `/api/refresh` (gestion des cookies JWT)  
  - `/api/orders*`, `/api/books*` (proxy vers les microservices)  
  - `/api/health`

## Déploiement Kubernetes (Minikube)
Prérequis : `kubectl`, `minikube`, addon `ingress`.

1) D démarrer le cluster :  
`minikube start --driver=docker`

2) Construire les images avec les tags attendus par les manifests :  
```bash
minikube image build -t louisscrf/auth-service:latest auth-service
minikube image build -t louisscrf/order-service:latest order-service
minikube image build -t louisscrf/book-service:latest book-service
minikube image build -t louisscrf/frontend:latest frontend
```

3) Déployer le namespace puis les ressources :  
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/auth -n microservices
kubectl apply -f k8s/order -n microservices
kubectl apply -f k8s/book -n microservices
kubectl apply -f k8s/frontend -n microservices
kubectl apply -f k8s/ingress -n microservices
```

4) Activer et exposer l’ingress :  
```bash
minikube addons enable ingress
minikube tunnel            # laisser ouvert
echo "127.0.0.1 devops.local" | sudo tee -a /etc/hosts
```

5) Vérifications rapides :  
`kubectl get pods,svc,ingress -n microservices`  
`kubectl logs deploy/auth-service -n microservices` (ou autres deployments)

6) Accès utilisateur : `http://devops.local` (service `frontend` exposé par l’Ingress).

7) Nettoyage complet :  
`kubectl delete ns microservices` (supprime deployments, services et PVC SQLite).

## Supervision et tests
- Probes `/health` sur chaque service + `/api/health` côté gateway.
- Les services NestJS incluent des suites Jest (`npm test` dans `book-service/` ou `order-service/`).  
- Le service FastAPI peut être lancé hors conteneur via `uvicorn main:app --reload --port 8000` pour des tests manuels.

Ce README documente le fonctionnement end-to-end (authentification, proxy Next.js, commandes, bibliothèque OpenLibrary) ainsi que les procédures de lancement Docker Compose et Minikube/Kubernetes attendues pour l’évaluation.

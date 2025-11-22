# Plateforme microservices — Auth / Orders / Books / Frontend

Ensemble cohérent de quatre services containerisés :

- **Frontend / API Gateway** : Next.js 16 (App Router) joue le rôle de façade publique. Les routes `/api/*` proxient l’Auth Service, l’Order Service et le Book Service.
- **Auth Service** : FastAPI + SQLModel + SQLite. Gestion des utilisateurs, émission/renouvellement des tokens JWT (HS256).
- **Order Service** : NestJS + Prisma + SQLite. CRUD de commandes authentifiées.
- **Book Service** : NestJS + Prisma + SQLite. Recherche et bibliothèque personnelle de livres (données OpenLibrary).

Chaque service expose `/health` pour la supervision, persiste ses données en SQLite (volumes Docker / PVC Kubernetes) et partage le secret `JWT_SECRET` pour valider les tokens.

```
Utilisateur → Next.js (cookies httpOnly) → Auth / Orders / Books
                               ↳ OpenLibrary (Book Service)
```

## Fonctionnement applicatif
- Authentification via `/auth/login` (Auth Service). Les JWT signés HS256 sont placés dans des cookies httpOnly par le frontend.
- Le frontend agit comme passerelle : les routes `/api/orders/*` et `/api/books/*` transmettent le token au bon microservice et renvoient la réponse telle quelle.
- Order Service gère des commandes par utilisateur (Prisma + SQLite).
- Book Service se connecte à l’API OpenLibrary pour la recherche/les détails, stocke uniquement les liens vers les œuvres dans la base utilisateur.
- Un endpoint `/refresh` permet de renouveler le token d’accès sans réauthentification utilisateur.
- Supervision : chaque service expose `/health`, le frontend expose `/api/health`.

## Services & ports
| Service         | Stack               | Port | Persistance | Notes |
|-----------------|---------------------|------|-------------|-------|
| frontend        | Next.js 16          | 3000 | stateless   | Gateway + UI, cookies httpOnly |
| auth-service    | FastAPI + SQLModel  | 8000 | SQLite      | Émission/validation JWT |
| order-service   | NestJS + Prisma     | 4000 | SQLite      | CRUD commandes authentifiées |
| book-service    | NestJS + Prisma     | 9000 | SQLite      | Recherche OpenLibrary + bibliothèque |

## Structure du dépôt
- `frontend/` : Next.js + routes API d’agrégation.
- `auth-service/` : FastAPI (login/register/refresh, JWKS).
- `order-service/` : NestJS + Prisma (commandes).
- `book-service/` : NestJS + Prisma (recherche OpenLibrary, bibliothèque).
- `k8s/` : manifests Kubernetes (namespace, deployments, services, ingress).
- `docker-compose.yml` : orchestration locale.
- `Documentation/` : supports de cours/TP liés au projet.

## Points forts techniques
- Découplage strict : chaque microservice possède son runtime, sa base SQLite et son Dockerfile multistage.
- Sécurité : JWT centralisé (`JWT_SECRET` partagé), vérification côté services, cookies httpOnly côté gateway.
- Résilience : probes liveness/readiness dans les manifests Kubernetes, volumes/pvc pour la rétention des données.
- Expérience développeur : API REST lisible, tests Jest/Prisma sur les services Node, FastAPI facilement testable via Uvicorn.

## Prérequis
- Docker + Docker Compose.
- Node.js 20+ / npm (uniquement si développement hors conteneur).
- Pour Kubernetes : `kubectl` + Minikube (ou un cluster compatible) et l’addon `ingress`.

## Configuration (.env recommandés)
Créez les fichiers attendus par `docker-compose.yml` avant de lancer les conteneurs.

`auth-service/.env`
```
DATABASE_URL=sqlite:///./auth.db
JWT_SECRET=change-me
JWT_ALGO=HS256
ACCESS_TOKEN_EXPIRES_MIN=60
REFRESH_TOKEN_EXPIRES_MIN=43200
CORS_ORIGINS=http://localhost:3000
```

`order-service/.env`
```
PORT=4000
DATABASE_URL=file:/app/prisma/dev.db
JWT_SECRET=change-me
```

`book-service/.env`
```
PORT=9000
DATABASE_URL=file:/app/prisma/dev.db
JWT_SECRET=change-me
OPENLIBRARY_USER_AGENT=BookInsights/1.0 (contact@example.com)
BOOK_SEARCH_LIMIT=12
```

`frontend/.env`
```
AUTH_SERVICE_URL=http://auth-service:8000
ORDER_SERVICE_URL=http://order-service:4000/orders
BOOK_SERVICE_URL=http://book-service:9000/books
```

## Démarrage local (Docker Compose)
1. Construire les images : `docker compose build`
2. Lancer les services : `docker compose up -d`
3. Vérifier : `docker compose ps` puis `curl http://localhost:8000/health`, `http://localhost:4000/health`, `http://localhost:9000/health`
4. Accès front : `http://localhost:3000` (les cookies httpOnly stockent les tokens renvoyés par l’Auth Service).
5. Logs en continu : `docker compose logs -f frontend auth-service order-service book-service`
6. Arrêt : `docker compose down` (ajoutez `-v` si vous voulez supprimer les volumes SQLite).

## Déploiement Kubernetes (Minikube)
1. Démarrer Minikube : `minikube start --driver=docker`
2. Construire et charger les images dans le cluster (tag attendu par les manifests) :
```bash
minikube image build -t louisscrf/auth-service:latest auth-service
minikube image build -t louisscrf/order-service:latest order-service
minikube image build -t louisscrf/book-service:latest book-service
minikube image build -t louisscrf/frontend:latest frontend
```
3. Déployer les ressources :
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/auth -n microservices
kubectl apply -f k8s/order -n microservices
kubectl apply -f k8s/book -n microservices
kubectl apply -f k8s/frontend -n microservices
kubectl apply -f k8s/ingress -n microservices
```
4. Activer l’ingress et ouvrir le tunnel :
```bash
minikube addons enable ingress
minikube tunnel   # à garder ouvert dans un terminal
echo "127.0.0.1 devops.local" | sudo tee -a /etc/hosts
```
5. Accès : `http://devops.local` (Service `frontend` exposé via l’Ingress).
6. Supervision rapide : `kubectl get pods,svc,ingress -n microservices`
7. Nettoyage : `kubectl delete ns microservices` (supprime aussi les PVC SQLite).

## Notes de fonctionnement
- Les trois services métiers vérifient les JWT avec le même `JWT_SECRET`. Le frontend stocke les tokens en cookies httpOnly et s’occupe du refresh côté serveur.
- Les PVC/volumes conservent les bases SQLite entre les redémarrages. Supprimez les volumes pour repartir d’un état vierge.
- Endpoints santé : `/health` sur chaque service, `/api/health` côté frontend.
- Tests (hors conteneur) : `npm test` dans `book-service/` ou `order-service/`; le service FastAPI peut être démarré en local via `uvicorn main:app --reload --port 8000`.

Ce dépôt fournit ainsi un scénario complet de microservices authentifiés, prêt à être lancé en local avec Docker Compose ou présenté sur un cluster Kubernetes Minikube.

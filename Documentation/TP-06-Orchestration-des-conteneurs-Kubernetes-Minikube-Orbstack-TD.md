# TP 06 - Orchestration des conteneurs (Kubernetes - Minikube / Orbstack) - TD

# Partie 2 — Install Minikube et setup

Minikube est la solution la plus utilisée dans les formations DevOps car elle fournit un cluster complet avec un seul nœud, facile à configurer, compatible macOS / Windows / Linux.

---

## Présentation technique de Minikube

Minikube est une distribution Kubernetes "all-in-one", conçue pour :

- exécuter un cluster **mononode** (1 worker + control plane sur la même VM),
- se baser sur divers drivers de virtualisation (Docker, HyperKit, Hyper-V, VirtualBox),
- inclure automatiquement les composants du Control Plane :
  - API Server
  - Scheduler
  - Controller Manager
  - etcd
  - CoreDNS
  - kube-proxy
- offrir un environnement de développement complet incluant :
  - Ingress Controller (Nginx) activable,
  - Dashboard Kubernetes,
  - stockage local (hostPath + volumes),
  - tunnel pour exposer les Services.

Minikube fonctionne comme suit :

- crée une **VM virtuelle** ou un **container Docker** pour héberger le nœud Kubernetes,
- installe Kubernetes dans cette instance,
- configure kubectl pour pointer automatiquement vers le nouveau cluster.

---

## Installation de Minikube et kubectl

### macOS (Homebrew)

```bash
brew install minikube kubectl
```

### Linux (apt)

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

sudo snap install kubectl --classic
```

### Windows (Chocolatey)

```powershell
choco install minikube kubernetes-cli
```

---

## Vérifier l’installation

```bash
minikube version
kubectl version --client
```

---

## Démarrage du cluster

*(configuration matériel, choix du driver et options réseau)*

Minikube peut tourner avec plusieurs drivers :

- Docker (recommandé)
- Hyper-V (Windows)
- VirtualBox
- HyperKit (macOS Intel)
- QEMU (Linux)

Dans cette formation, nous utilisons le driver Docker, car il est :

- rapide,
- léger,
- compatible Windows/macOS/Linux,
- parfaitement intégré avec les images construites localement.

Démarre ton cluster :

```bash
minikube start --driver=docker --cpus=4 --memory=5000mb
```

### Pourquoi ces paramètres ?

- `-driver=docker` : le cluster tourne dans un conteneur Docker (pas de VM lourde).
- `-cpus=4` : assure la stabilité du nœud avec plusieurs Pods simultanés.
- `-memory=5000mb` : assez de RAM pour Next.js + NestJS + FastAPI.

Une fois démarré, vérifie que ton cluster est actif :

```bash
kubectl get nodes
```

Sortie attendue :

```plain text
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   20s   v1.30.0
```

---

## Configuration automatique de kubectl

Minikube configure automatiquement le *kubeconfig* du poste :

```bash
cat ~/.kube/config
```

Tu y verras une section :

```plain text
current-context: minikube
```

Cela signifie que **kubectl pointe maintenant vers Minikube et non Docker Desktop ou un cluster distant**.

---

## Dossier Kubernetes du projet

Dans `microservices/k8s/`, nous organisons les manifestes Kubernetes par microservice :

```plain text
k8s/
├── auth/
│   ├── deployment.yaml
│   └── service.yaml
├── order/
│   ├── deployment.yaml
│   └── service.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── ingress/
    └── ingress.yaml
```

Cette structure respecte les bonnes pratiques :

- Un dossier par microservice,
- Des fichiers séparés par type de ressource (Deployment, Service, Ingress),
- Versionnable,
- Compatible CI/CD.

---

## Interagir avec Minikube

Quelques commandes essentielles :

### Ouvrir le Dashboard Web

```bash
minikube dashboard
```

### Voir la VM / Container Docker utilisé par Minikube

```bash
minikube ssh
```

### Voir les images internes de Minikube

```bash
minikube image ls
```

### Stocker une image locale dans Minikube

```bash
minikube image load juliencouraud/auth-service:latest
```

*(utile si tu ne pousses pas encore tes images sur Docker Hub)*

---

## Push des images docker sur Docker Hub

il faut faire un push correct vers Docker Hub :

```bash
docker login
docker build -t juliencouraud/frontend:latest frontend/
docker build -t juliencouraud/order-service:latest order-service/
docker build -t juliencouraud/auth-service:latest auth-service/

docker push juliencouraud/frontend:latest
docker push juliencouraud/order-service:latest
docker push juliencouraud/auth-service:latest



```

# Partie 3 — Écriture des fichiers de configuration Kubernetes (Deployments + Services)

Création des manifests Kubernetes pour chacun des trois microservices :

- **auth-service** (FastAPI)
- **order-service** (NestJS + Prisma)
- **frontend** (Next.js)

Chaque service est défini à travers **deux ressources Kubernetes fondamentales** :

- **Deployment** → exécution et gestion du cycle de vie
- **Service** → exposition réseau et load-balancing interne

Chaque sous-partie fournit un manifest complet, commenté et prêt à appliquer.

---

# Créer le namespace

Exécute :

```bash
kubectl create namespace microservices
```

# Vérifie que le namespace existe

```bash
kubectl get ns
```

Tu dois voir :

```plain text
microservices   Active
```

# Auth-service (FastAPI)

## Deployment — `k8s/auth/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  labels:
    app: auth-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: juliencouraud/auth-service:latest
          ports:
            - containerPort: 8000

          # Vérifie régulièrement si le service fonctionne
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10

          # Vérifie si le service est prêt à recevoir du trafic
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 2
            periodSeconds: 5
```

Points importants :

- `replicas: 1` → Minikube est mono-nœud ; scale vertical possible, horizontal limité en local.
- `readinessProbe` → filtre un pod tant qu’il n’est pas prêt (protège les rolling updates).
- `livenessProbe` → redémarre le pod si l’app ne répond plus.

---

## Service — `k8s/auth/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  selector:
    app: auth-service
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
```

Notes :

- `ClusterIP` expose l’application **uniquement dans le cluster**.
- Le DNS interne devient :
  **[http://auth-service.default.svc.cluster.local](http://auth-service.default.svc.cluster.local/)**

---

# Order-service (NestJS + Prisma + SQLite)

Ce service inclut un ORM (Prisma), une base SQLite embarquée, une API REST et un JWT Guard.

Kubernetes doit donc :

- monter l’image,
- définir les variables d’environnement,
- gérer le port 4000,
- vérifier le `/health`.

---

## Deployment — `k8s/order/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  labels:
    app: order-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: juliencouraud/order-service:latest
          ports:
            - containerPort: 4000

          env:
            - name: DATABASE_URL
              value: "file:./dev.db"
            - name: JWT_SECRET
              value: "change-me"
            - name: PORT
              value: "4000"

          # Vérifie si l’app répond
          livenessProbe:
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 10

          # Vérifie si l’app est prête à recevoir du trafic
          readinessProbe:
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 2
            periodSeconds: 5
```

---

## Service — `k8s/order/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
    - port: 4000
      targetPort: 4000
  type: ClusterIP
```

Notes :

- Le port interne Kubernetes est 4000 → mappé vers le même port du Pod.
- Le backend Next.js pointera vers :
  `http://order-service:4000/orders`

---

# Frontend (Next.js)

Le frontend joue le rôle de **gateway** : il appelle directement auth-service et order-service depuis ses API Routes.

Il doit donc recevoir des variables d’environnement configurées pour Kubernetes (DNS internes).

---

## Deployment — `k8s/frontend/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  labels:
    app: frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: juliencouraud/frontend:latest
          ports:
            - containerPort: 3000

          env:
            - name: AUTH_SERVICE_URL
              value: "http://auth-service:8000"
            - name: ORDER_SERVICE_URL
              value: "http://order-service:4000/orders"
```

---

## Service — `k8s/frontend/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

Notes :

- Ce service ne sera pas exposé directement à l’extérieur.
- Il sera rendu visible par un **Ingress Controller**.

---

# Application des manifests

Une fois tous les fichiers écrits, on peut les appliquer :

```bash
kubectl apply -f k8s/auth/
kubectl apply -f k8s/order/
kubectl apply -f k8s/frontend/
```

Vérifie ensuite :

```bash
kubectl get pods
kubectl get svc
```

---

```dart
// En cas de bug avec build

kubectl rollout restart deployment/<service-name>

kubectl rollout restart deployment/frontend
kubectl rollout restart deployment/auth-service
kubectl rollout restart deployment/order-service
```

---

# Partie 4 — Mise en place d’un Ingress (reverse proxy Kubernetes)

L’Ingress est l’élément Kubernetes qui permet d’exposer plusieurs services internes (frontend, auth-service, order-service) derrière **un seul point d’entrée HTTP**.

Il joue le rôle d’un reverse proxy L7 (HTTP) comparable à Nginx, Traefik ou Istio Ingress Gateway.

Il travaille conjointement avec un **Ingress Controller**, un pod Kubernetes qui implémente réellement le routage.

---

## Rôle général d’un Ingress

Un Ingress permet :

- d’exposer un cluster Kubernetes via une seule IP externe ;
- de router `/auth`, `/orders`, `/` vers différents services ;
- de gérer TLS (certificats HTTPS) ;
- d’appliquer des règles de réécriture, headers, policies.

Dans notre architecture microservices :

- `frontend` → interface Next.js
- `auth-service` → API FastAPI
- `order-service` → API NestJS

L’Ingress va servir de **Gateway HTTP unique**.

---

## Reverse proxy HTTP — Explication

Un reverse proxy redirige les requêtes HTTP entrantes selon leur chemin.

Exemple conceptuel :

```plain text
http://devops.local/auth        → auth-service:8000
http://devops.local/orders      → order-service:4000
http://devops.local/            → frontend:3000
```

Cela permet :

- une seule URL pour tout le système,
- gestion centralisée de la sécurité,
- isolation des services internes (pas exposés sur Internet),
- compatibilité avec les API Routes du frontend.

---

# Activation de l’Ingress Controller dans Minikube

Minikube fournit un add-on officiel basé sur **NGINX Ingress Controller**.

Installation :

```bash
minikube addons enable ingress
```

Vérifier :

```bash
kubectl get pods -n ingress-nginx
```

Tu dois voir des pods :

```plain text
ingress-nginx-controller-xxxxx   Running
```

L’Ingress Controller écoute sur une IP interne à Kubernetes et injecte automatiquement les règles Nginx depuis les manifests Ingress.

---

# Configuration de l’Ingress (routing HTTP)

Créer le fichier :

```plain text
k8s/ingress/ingress.yaml
```

Contenu complet et commenté :

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: devops-ingress
  namespace: default
spec:
  rules:
    - host: devops.local
      http:
        paths:
          # 1) Auth-service : /auth → FastAPI
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: 8000

          # 2) Order-service : /orders → NestJS
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 4000

          # 3) Frontend : tout le reste → Next.js
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000
```

### Explication de la règle

- `host: devops.local` → l'Ingress répond uniquement à ce domaine.
- `pathType: Prefix` → toutes les URL commençant par `/auth` / `/orders` matchent.
- `rewrite-target` → corrige les chemins pour les backends si nécessaire.

Ainsi :

```plain text
http://devops.local/auth/login   → auth-service:8000/auth/login
http://devops.local/orders       → order-service:4000/orders
http://devops.local/             → frontend:3000
```

---

# Configuration DNS locale

Sans DNS public, on modifie simplement `/etc/hosts` ou équivalent Windows.

### macOS / Linux :

```plain text
sudo nano /etc/hosts
```

Ajouter :

```plain text
127.0.0.1 devops.local

ou 

// après avoir minikube ip

192.168.49.2 devops.local
```

### Windows (PowerShell admin) :

```plain text
notepad C:\Windows\System32\drivers\etc\hosts
```

Ajouter :

```plain text
127.0.0.1 devops.local
```

---

# Déploiement de l’Ingress

Appliquer :

```bash
kubectl apply -f k8s/ingress/
```

(Ou pour tout le dossier Kubernetes)

```bash
kubectl apply -f k8s/


```

Si Minikube requiert un tunnel :

```bash
minikube tunnel
```

Ce tunnel permet à l’Ingress Controller d’avoir une IP publique locale.

Vérification :

```bash
kubectl get ingress
```

Sortie attendue :

```plain text
NAME             CLASS   HOSTS          ADDRESS       PORTS
devops-ingress   nginx   devops.local   127.0.0.1     80
```

---

# Test initial

Une fois l’Ingress actif et les pods en Ready :

Visite :

```plain text
http://devops.local
```

Tu dois voir le frontend Next.js.

Test du backend :

```plain text
http://devops.local/auth/health
http://devops.local/orders/health
```

Chaque service répond indépendamment, mais via le même point d’entrée.

---

# Partie 5 — Tester les pods

Cette partie présente les différentes méthodes pour interagir avec les microservices déployés dans Kubernetes : inspection des Pods, tests réseau internes, accès externe via Ingress, et tests côté navigateur. Elle constitue la validation fonctionnelle du déploiement Kubernetes.

---

## Vérifier l’état des ressources

```bash
kubectl get pods
kubectl get svc
kubectl get deployments
kubectl get ingress
```

Pour plus de détails :

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

---

## Tester via port-forward

Le port-forward permet de contourner temporairement Ingress ou les Services.

### Auth-service

```bash
kubectl port-forward svc/auth-service 8000:8000
curl http://localhost:8000/health
```

### Order-service

```bash
kubectl port-forward svc/order-service 4000:4000
curl http://localhost:4000/health
```

### Frontend

```bash
kubectl port-forward svc/frontend 3000:3000
open http://localhost:3000
```

Utilisation typique : diagnostic ou tests rapides.

---

## Tester via Ingress

Assurez-vous que l’add-on Ingress est actif :

```bash
minikube addons enable ingress
```

Ajoutez dans `/etc/hosts` :

```plain text
127.0.0.1 devops.local
```

Une fois vos manifestes appliqués :

```bash
kubectl apply -f k8s/
minikube tunnel
```

Tests via Ingress :

### Frontend

```bash
curl http://devops.local/
```

### Auth-service

```bash
curl http://devops.local/auth/health
```

### Order-service

```bash
curl http://devops.local/orders/health
```

Si ces trois commandes renvoient un JSON valide, l’Ingress fonctionne.

---

## Tester l’authentification complète (JWT)

### 1. Générer un token via Auth-service

```bash
curl -X POST http://devops.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

Récupérez `"access_token"` dans la réponse JSON.

### 2. Utiliser le token contre Order-service

```bash
curl -X GET http://devops.local/orders \
  -H "Authorization: Bearer <TOKEN>"
```

Créer une commande :

```bash
curl -X POST http://devops.local/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"item": "book-123"}'


```

Supprimer une commande :

```bash
curl -X DELETE http://devops.local/orders/1 \
  -H "Authorization: Bearer <TOKEN>"


```

Les trois requêtes doivent répondre avec un statut HTTP 2xx.

---

## Tester via le navigateur

1. Démarrer le tunnel :

```bash
minikube tunnel // Si vous voulez le localhost sinon technique minikube ip
```

1. Ouvrir le frontend :

```plain text
http://devops.local
```

1. Scénario complet :
- Se connecter avec `admin / admin`
- Vérifier la présence du JWT dans les cookies
- Liste des commandes (GET)
- Création d’une commande (POST)
- Suppression d’une commande (DELETE)

Chaque action doit être correctement redirigée via l’API Gateway frontend → Ingress → Services → Pods.

---

## Publication des images sur Docker Hub (optionnel)

Construire :

```bash
docker build -t <username>/auth-service:latest ./auth-service
docker build -t <username>/order-service:latest ./order-service
docker build -t <username>/frontend:latest ./frontend
```

Pousser :

```bash
docker push <username>/auth-service:latest
docker push <username>/order-service:latest
docker push <username>/frontend:latest
```

Puis re-déployer :

```bash
kubectl rollout restart deployment/auth-service
kubectl rollout restart deployment/order-service
kubectl rollout restart deployment/frontend
```

---

# TP 07 - Projet Evalué

## 1. Objectif général

Vous allez devoir **concevoir, développer, conteneuriser et déployer** un **nouveau micro-service** dans l’architecture existante du cours.

Ce micro-service devra fonctionner :

1. **En local** (exécution simple)
1. **Via Docker Compose** (orchestration multi-services locale)
1. **Dans Kubernetes local (Minikube)** via une image poussée dans un **registry Docker Hub personnel**

Le projet sera rendu via un **repository GitHub complet, documenté et fonctionnel**.

---

## 2. Architecture générale

Vous disposez déjà de :

- **frontend** : Next.js
- **auth-service** : FastAPI + SQLite
- **order-service** : NestJS + Prisma (exemple d’intégration micro-service, peut servir de guide)

Ces trois composants **ne doivent pas être supprimés**, mais vous pouvez :

- les modifier légèrement,
- les enrichir,
- les intégrer davantage à votre nouveau service.

---

## 3. Nouveau micro-service à développer

### 3.1 Fonctionnalités attendues

Le service devra :

- Consommer **une API publique** de votre choix
- Permettre **au moins une fonctionnalité côté client** dans le frontend
- **Stocker des données** dans une base de votre choix (SQLite, PostgreSQL, MongoDB, etc.)
- Interagir avec **le auth-service** (authentification / JWT obligatoire)
- Être totalement fonctionnel dans *les trois modes* : local, Docker Compose, Kubernetes

---

## 4. Exemples de micro-services autorisés (non exhaustif)

### Thème cinéma / séries

- API : **TheMovieDB**, OMDb, TVMaze
- Exemple : Plateforme type “Allociné” avec avis, favoris, recommandations

### Thème jeux vidéo

- API : **RAWG**, IGDB
- Exemple : Application de collection de jeux, notes partagées, liste d’attente

### Thème finance / bourse

- API : **AlphaVantage**, Yahoo Finance, CoinGecko
- Exemple : Tableau de bord crypto, portefeuille, historique personnalisé

### Thème sport

- API : **API-Football**, balldontlie
- Exemple : Suivi d’équipe, classement, commentaires authentifiés

### Thème livres

- API : **Google Books**
- Exemple : Bibliothèque sociale, critiques, wishlist

Le sujet est **libre**, tant qu'il :

- utilise une API publique,
- propose une fonctionnalité utile visible dans le frontend,
- interagit avec des utilisateurs authentifiés.

---

## 5. Contraintes techniques

### 5.1 Backend (micro-service)

Stack technique **libre**.

Le service doit fournir au minimum :

- un contrôleur d’API interne,
- l’appel à l’API publique,
- un modèle persistant (DB),
- une intégration JWT (via auth-service),
- une documentation OpenAPI ou similaire (Readme au minimum).

### 5.2 Frontend (Next.js existant)

Le frontend devra être modifié pour :

- appeler votre nouveau micro-service,
- afficher au moins une page fonctionnelle,
- gérer authentification et autorisation.

### 5.3 Auth-service (FastAPI existant)

Doit être utilisé pour :

- login / register
- gestion et validation de JWT dans votre service

### 5.4 Docker Compose

Vous devrez :

- ajouter votre micro-service
- ajouter sa base de données
- gérer les variables d’environnement
- permettre le lancement complet avec :

```bash
docker-compose up --build
```

### 5.5 Kubernetes local (Minikube)

Pour votre nouveau micro-service :

- Deployment
- Service (ClusterIP)
- ConfigMap / Secret
- Ingress (devops.local ou autre)
- Image poussée sur **Docker Hub**

Le tout doit être déployable avec :

```bash
kubectl apply -f k8s/
```

---

## 6. Livrables attendus

### 6.1 Repository GitHub complet

Doit contenir :

```plain text
📁 frontend/
📁 auth-service/
📁 your-new-service/
📁 k8s/
📁 docker/ (ou Dockerfile dans chaque repo)
📁 docs/ (si besoin)
README.md
docker-compose.yml
```

### 6.2 README technique complet (obligatoire)

Un README bien structuré, contenant :

- Description du projet
- Architecture globale
- Installation locale
- Lancement via Docker Compose
- Déploiement Kubernetes
- Variables d’environnement
- Appels API principaux

### 6.3 Fonctionnement démontrable

Trois modes obligatoires :

1. **local** :
1. **docker-compose** :
1. **kubernetes local** avec registry Docker Hub :

---

## 7. Critères d’évaluation (notation)

| Critère | Description | Points |
| --- | --- | --- |
| Fonctionnalité globale | Le micro-service fonctionne réellement (en local) | 4 pts |
| Intégration API publique | Appels API externes corrects | 2 pts |
| Stockage de données | Modèles et persistance corrects | 2 pts |
| Frontend | Page fonctionnelle, intégration clean | 2 pts |
| Docker Compose | Architecture multi-services opérationnelle | 3 pts |
| Kubernetes | Déploiement complet fonctionnel | 4 pts |
| Documentation (README) | Qualité, clarté, instructions | 1 pts |
| Qualité du code & git | Structure, conventions, commits | 2 pts |

---

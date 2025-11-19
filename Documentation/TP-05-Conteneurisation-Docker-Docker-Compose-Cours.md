# TP 05 - Conteneurisation (Docker + Docker Compose) - Cours

# Partie 1 — Qu’est-ce que Docker ?

Docker est une technologie de virtualisation légère permettant d’exécuter des applications dans des environnements isolés appelés **conteneurs**.

Ces conteneurs garantissent que l’application fonctionne de la même manière sur **tous les systèmes d’exploitation** : macOS, Windows, Linux.

L’objectif de cette partie est de rappeler les fondamentaux indispensables avant de conteneuriser nos trois microservices (frontend, auth-service, order-service).

---

## Comprendre les conteneurs

Un **conteneur Docker** est une unité d’exécution légère, isolée et reproductible. Il repose sur des **mécanismes du noyau Linux** pour isoler les processus, ce qui le rend beaucoup plus performant qu’une machine virtuelle traditionnelle.

Cette section approfondit les concepts techniques clés, tout en renvoyant aux éléments essentiels de la documentation officielle.

---

### Fondements techniques des conteneurs

**Namespaces (isolation)**

Docker isole les processus à l’aide de plusieurs types de **Linux namespaces**.

Chaque conteneur perçoit son propre « environnement » séparé du système hôte :

| Namespace | Rôle |
| --- | --- |
| `pid` | Isole l’arborescence des processus |
| `net` | Fournit un réseau virtuel dédié |
| `mnt` | Isole les systèmes de fichiers montés |
| `uts` | Hostname / domainname indépendants |
| `ipc` | Isole les mécanismes de communication inter-process |
| `user` | Permet le mapping des utilisateurs UID/GID |

Grâce à eux, un conteneur pense être seul sur la machine.

Documentation :

https://docs.docker.com/get-started/overview/#containers-and-virtual-machines

---

**Control Groups (cgroups)**

Les **cgroups** limitent et surveillent la consommation des ressources :

- CPU
- mémoire
- I/O disque
- réseau

Cela permet :

- d’empêcher un conteneur de saturer la machine,
- de garantir des performances prévisibles,
- de créer une architecture stable même avec de nombreux microservices.

Documentation :

https://docs.docker.com/config/containers/resource_constraints/

---

**Union File System (OverlayFS)**

Docker utilise des systèmes de fichiers union (Overlay2 sur Linux).

Ils permettent :

- des couches immuables (filesystem en lecture seule),
- des couches en écriture par-dessus,
- un cache partagé entre plusieurs images,
- une construction rapide grâce à des étapes incrémentales.

Chaque instruction d’un Dockerfile (`FROM`, `COPY`, `RUN`, …) génère une **nouvelle couche**.

Documentation :

https://docs.docker.com/storage/storagedriver/overlayfs-driver/

---

**Processus unique**

Un conteneur exécute **un seul processus principal** :

```bash
PID 1 → uvicorn
PID 1 → node
PID 1 → gunicorn
```

Lorsque ce processus s’arrête, **le conteneur s’arrête**.

C’est un modèle simple et efficace permettant :

- supervision claire,
- logs centralisés,
- arrêt propre,
- comportement reproductible.

Recommandation officielle :

https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#entrypoint

---

### Conteneur vs Machine virtuelle

Docker ne virtualise pas un OS complet :

il partage le **noyau du système hôte**.

**Différences structurées**

| Critère | Machine virtuelle | Conteneur Docker |
| --- | --- | --- |
| Noyau OS | Émulé | Partagé |
| Poids | Gigaoctets | Quelques dizaines de Mo |
| Démarrage | Lenteur (secondes à minutes) | Instantané |
| Isolation | Très forte (hyperviseur) | Processus + namespaces |
| Performance | Moins efficace | Native (quasi bare-metal) |

Documentation :

https://docs.docker.com/get-started/overview/#what-is-a-container

---

### Cycle de vie d’un conteneur

**3.1 Construction d’une image**

Basée sur un Dockerfile :

```bash
docker build -t my-app .
```

**3.2 Démarrage d’un conteneur**

```bash
docker run -p 3000:3000 my-app
```

**3.3 Arrêt**

```bash
docker stop <id>
```

**3.4 Suppression**

```bash
docker rm <id>


```

Documentation :

https://docs.docker.com/engine/reference/commandline/docker/

---

### Réseau interne Docker

Docker crée un réseau de type **bridge** pour tous les services d’un docker-compose.

Les conteneurs peuvent communiquer entre eux **par leur nom de service** :

Exemple :

```bash
curl http://auth-service:8000/auth/login
curl http://order-service:4000/orders
```

Documentation :

[https://docs.docker.com/network/](https://docs.docker.com/network/)

---

### Persistance avec les volumes

Les conteneurs sont éphémères.

Pour persister des données (comme les bases SQLite), on crée des volumes :

```yaml
volumes:
  auth_db_data:
  order_db_data:
```

Cela permet de conserver les données même si le conteneur est recréé.

Documentation :

[https://docs.docker.com/storage/volumes/](https://docs.docker.com/storage/volumes/)

---

## Les images Docker

Une **image Docker** est un modèle immuable contenant tout ce qu’il faut pour exécuter un conteneur : code source, dépendances, runtime, fichiers de configuration, variables d'environnement par défaut, système de fichiers minimal.

Elle est **l’unité fondamentale** de déploiement dans Docker.

---

### Anatomie d’une image : système de couches (layers)

Docker construit une image **couche par couche**.

Chaque instruction du Dockerfile génère une couche **en lecture seule**, stockée dans le cache Docker.

Exemple :

```docker
FROM node:20-alpine
COPY package.json .
RUN npm install
COPY . .
CMD ["node", "server.js"]
```

Génère dans cet ordre :

1. Base : `node:20-alpine`
1. Copie du package.json
1. Installation des dépendances (RUN)
1. Copie du code
1. Définition de la commande (CMD)

### Pourquoi les couches sont importantes ?

- **Cache de build** : accélère massivement la construction.
- **Réutilisation** : deux images utilisant la même base partagent la même couche.
- **Optimisation** : modifier une couche invalide toutes les couches suivantes.

Documentation :

https://docs.docker.com/build/building/layers/

---

### Image ≠ Conteneur

| Concept | Description |
| --- | --- |
| **Image** | Modèle, immutable, stocké, versionné |
| **Conteneur** | Instance vivante d’une image |
| **Image = classe**, **Conteneur = objet** | Analogie utile |

Une image peut servir à créer **plusieurs conteneurs** identiques.

---

### Sources des images : Docker Registry

Les images viennent de registres, publics ou privés :

- **Docker Hub** (officiel)
  [https://hub.docker.com](https://hub.docker.com/)
- **GitHub Container Registry**
  `ghcr.io`
- **Google Artifact Registry**
- **Harbor**
- Registres internes aux entreprises

En Dockerfile :

```docker
FROM python:3.12-slim
```

Cette ligne télécharge l’image depuis Docker Hub si elle n’est pas en cache.

---

### Structure réelle d’une image

Une image Docker est composée de :

1. **Manifest.json**
  Décrit la liste des couches et les métadonnées.
1. **Layers**
  Compressées en fichiers `tar`.
1. **Config.json**
  Contient :
  - variables ENV par défaut
  - CMD, ENTRYPOINT
  - architecture CPU (amd64, arm64…)
  - labels
  - volumes
  - ports exposés

Documentation :

https://docs.docker.com/engine/reference/commandline/image_inspect/

Exemple d’inspection :

```bash
docker image inspect node:20-alpine
```

---

### Multi-architecture (amd64 / arm64)

Docker utilise **Buildx** pour produire des images multiplateformes.

Exemple :

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t my-app .
```

Important pour les machines :

- Mac M1/M2 (arm64)
- PC x86 (amd64)
- Serveurs cloud ARM (AWS Graviton)

Documentation :

[https://docs.docker.com/build/building/multi-platform/](https://docs.docker.com/build/building/multi-platform/)

---

## Le rôle du Dockerfile

Le Dockerfile est un fichier texte décrivant **comment construire une image Docker**, étape par étape.

Il sert de **recette déterministe**, garantissant que l’environnement d’exécution sera **identique** sur toutes les machines : Windows, macOS, Linux, CI/CD, serveurs cloud ou postes de développement.

Le Dockerfile construit une image sous forme de **couches immutables**, produites à chaque instruction.

Ces couches sont **cacheables**, **réutilisables** et permettent des builds rapides et reproductibles.

---

### Instruction FROM : définir l’image de base

`FROM` définit l’image parent, toujours en première ligne.

C’est la base du système :

```docker
FROM node:20-alpine
FROM python:3.12-slim


```

Elle fournit :

- un système minimal (Debian, Alpine…),
- un runtime (Node, Python, Java…),
- un environnement stable et officiel.

**Documentation** : https://docs.docker.com/reference/dockerfile/#from

---

### Instruction WORKDIR : définir le dossier de travail

`WORKDIR` définit le répertoire dans lequel toutes les commandes suivantes seront exécutées :

```docker
WORKDIR /app


```

Il simplifie les chemins et crée automatiquement le dossier si nécessaire.

---

### Instruction COPY : importer des fichiers dans l’image

`COPY` ajoute des fichiers du poste local vers l’image :

```docker
COPY package.json .
COPY src ./src


```

Chaque COPY produit **une nouvelle couche**.

Optimiser cette étape est essentiel pour de bons temps de build.

**Documentation** :

https://docs.docker.com/reference/dockerfile/#copy

---

### Instruction RUN : exécuter des commandes au build

`RUN` exécute des commandes lors de la construction de l’image :

```docker
RUN npm ci
RUN pip install -r requirements.txt


```

Il crée une couche persistante contenant la sortie de la commande.

Cette instruction ne s’exécute **pas au runtime**.

---

### Instruction ENV : configurer des variables dans l’image

`ENV` définit des variables d’environnement intégrées dans l’image :

```docker
ENV NODE_ENV=production
ENV PORT=4000


```

Pratique pour configurer l’application, mais **jamais pour stocker des secrets**, car ces valeurs deviennent visibles dans l’image.

---

### Instruction EXPOSE : documenter les ports utilisés

`EXPOSE` indique quel port l’application utilise :

```docker
EXPOSE 3000


```

C’est une **documentation interne** :

cela n’ouvre pas le port sur la machine hôte.

---

### Instruction CMD : définir la commande principale

`CMD` définit la commande exécutée lorsque le conteneur démarre :

```docker
CMD ["node", "dist/main.js"]


```

Points clés :

- un conteneur exécute **un seul processus principal**
- si CMD s’arrête → le conteneur s’arrête
- la forme JSON est recommandée

**Documentation** :

https://docs.docker.com/reference/dockerfile/#cmd

---

### Instruction ENTRYPOINT : définir le programme permanent

`ENTRYPOINT` fixe le programme de base du conteneur, même si des arguments supplémentaires sont fournis :

```docker
ENTRYPOINT ["uvicorn"]
CMD ["main:app", "--host", "0.0.0.0", "--port", "8000"]


```

Souvent utilisé pour :

- un serveur (Uvicorn, Gunicorn),
- un binaire (Node, Java),
- une CLI spécialisée.

**Documentation** :

https://docs.docker.com/reference/dockerfile/#entrypoint

---

### Multi-stage build : séparer compilation et exécution

Technique recommandée pour produire des images **plus légères**, **plus sécurisées**, et **plus rapides à déployer**.

Exemple :

```docker
FROM node:20 AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/main.js"]


```

Ce principe :

- évite d’inclure les dépendances de développement,
- réduit considérablement la taille de l’image finale,
- limite la surface d’attaque.

**Documentation** :

[https://docs.docker.com/build/building/multi-stage/](https://docs.docker.com/build/building/multi-stage/)

---

## Docker Compose : orchestrer plusieurs services

Docker Compose est un outil permettant de **définir, organiser et démarrer plusieurs conteneurs** à partir d’un seul fichier YAML.

Il agit comme un **orchestrateur local**, idéal pour les environnements de développement, les tests, les démonstrations et les systèmes multi-services.

Compose simplifie la gestion d’architectures complexes où plusieurs conteneurs doivent :

- tourner ensemble,
- communiquer entre eux,
- partager des volumes,
- utiliser des variables d’environnement,
- être lancés et arrêtés avec une seule commande.

**Documentation officielle** :

[https://docs.docker.com/compose/](https://docs.docker.com/compose/)

---

### Un unique fichier pour décrire toute l’application

Docker Compose repose sur un fichier :

```plain text
docker-compose.yml


```

Ce fichier décrit, sous forme déclarative :

- les services (auth, orders, frontend…),
- les volumes (stockage persistant),
- les réseaux (communication interne),
- les ports exposés,
- les variables d’environnement,
- les règles de dépendance entre services.

Cette approche élimine la nécessité de lancer manuellement chaque conteneur avec `docker run`.

---

### Définir des services

Chaque service correspond à un conteneur :

```yaml
services:
  auth-service:
    build: ./auth-service
    ports:
      - "8000:8000"
    env_file:
      - ./auth-service/.env


```

Chaque bloc décrit :

- comment construire l’image (`build: context`),
- quel port exposer,
- quelles variables d’environnement charger,
- quels volumes attacher,
- quelles dépendances respecter.

Compose agit comme un **superviseur** :

il démarre, suit et stoppe ces services ensemble.

---

### Variables d’environnement et fichiers .env

Un service peut charger des variables à partir d’un fichier `.env` dédié :

```yaml
env_file:
  - ./order-service/.env


```

Avantages :

- séparation propre entre code et configuration,
- gestion simple entre dev / staging / production,
- compatibilité immédiate avec les Dockerfile (ENV / process.env).

Docker Compose supporte aussi un **fichier .env global** au même niveau que le `docker-compose.yml`.

Documentation :

https://docs.docker.com/compose/environment-variables/

---

### Gestion des volumes

Les volumes permettent de **persister les données**, même si les conteneurs sont supprimés.

Exemple pour SQLite :

```yaml
volumes:
  auth_db_data:
  order_db_data:


```

Et attachement dans les services :

```yaml
volumes:
  - auth_db_data:/app/db


```

Les avantages :

- les données ne disparaissent pas,
- les fichiers de base de données restent isolés,
- la configuration est portable entre machines.

Documentation :

https://docs.docker.com/storage/volumes/

---

### Réseau interne automatique

Docker Compose crée automatiquement un réseau par projet.

Tous les services y sont **accessibles par leur nom**, comme un DNS interne.

Exemple :

- `http://auth-service:8000`
- `http://order-service:4000`
- `http://frontend:3000`

Cela permet :

- de ne plus utiliser `localhost` dans les conteneurs,
- d'avoir un maillage réseau propre,
- de reproduire le fonctionnement d’un cluster (Kubernetes, Swarm…).

---

### Relations entre services

`depends_on` permet d’exprimer l’ordre de démarrage :

```yaml
depends_on:
  - auth-service


```

Il ne garantit pas que le service est « prêt », mais assure qu’il est **démarré**.

Pour des orchestrations avancées (healthchecks, readiness), Compose peut être étendu avec :

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 5s
  retries: 3


```

---

### Commandes essentielles

**Lancer l’ensemble de l’infrastructure**

```bash
docker-compose up


```

**Rebuild complet**

```bash
docker-compose build --no-cache


```

**Détacher l’exécution**

```bash
docker-compose up -d


```

**Arrêter et supprimer les conteneurs**

```bash
docker-compose down


```

**Supprimer les volumes également**

```bash
docker-compose down -v


```

**Inspecter un service**

```bash
docker exec -it <service> sh


```

Ces commandes fonctionnent aussi avec la syntaxe récente `docker compose`, mais on garde ici l’usage traditionnel de `docker-compose`.

---

### Pourquoi Docker Compose est indispensable en microservices ?

Parce qu’il permet de :

- démarrer toutes les API d’un projet en un seul geste,
- garantir une configuration reproductible,
- unifier les ports, réseaux, volumes dans un fichier unique,
- tester une architecture complète sans déployer sur le cloud,
- reproduire un comportement similaire à Kubernetes en local,
- isoler chaque service tout en les rendant interconnectés.

Compose est aujourd’hui l’outil standard pour **structurer localement** les microservices d’un projet DevOps moderne.

---

## Gestion cross-OS (macOS, Windows, Linux)

Docker fonctionne sur plusieurs systèmes d’exploitation, mais son mode d’exécution diffère selon la plateforme. Comprendre ces différences est essentiel pour éviter les erreurs lors de l’exécution des conteneurs ou la gestion des volumes.

---

### macOS

Docker Desktop pour macOS repose sur une **machine virtuelle Linux intégrée** (HyperKit ou Apple Virtualization Framework).

Cela signifie :

- les conteneurs ne tournent pas nativement sur macOS, mais dans une VM Linux transparente,
- les performances disque peuvent être légèrement inférieures à Linux,
- les volumes montés depuis macOS (`:./local/path:/container/path`) fonctionnent normalement,
- pas besoin de configuration particulière : Docker Desktop inclut tout.

Alternative possible : **OrbStack**, plus léger et rapide que Docker Desktop, particulièrement recommandé pour les développeurs (intégration plus propre, moins de ressources consommées).

Documentation officielle :

[https://docs.docker.com/desktop/setup/install/mac-install/](https://docs.docker.com/desktop/setup/install/mac-install/)

---

### Windows

Trois approches existent :

### 1. Docker Desktop (recommandé)

Docker Desktop repose sur **WSL2 (Windows Subsystem for Linux)**.

Docker ne tourne pas sur Windows natif mais dans une couche Linux virtualisée moderne et performante.

Caractéristiques :

- nécessite Windows 10/11 64 bits,
- WSL2 doit être activé,
- support complet : volumes, réseaux, compose, etc.

Dans `Settings > Resources`, il est souvent utile d’ajuster CPU/RAM.

Documentation :

[https://docs.docker.com/desktop/setup/install/windows-install/](https://docs.docker.com/desktop/setup/install/windows-install/)

### 2. WSL2 + Docker Engine (avancé)

Sans Docker Desktop, il est possible d’installer **Docker Engine directement dans Ubuntu WSL** :

```bash
sudo apt install docker.io
sudo service docker start
```

Cela permet d’éviter les licences Docker Desktop, mais demande une configuration réseau plus avancée.

### 3. Windows Server (professionnel)

Prend en charge des conteneurs **Windows** et **Linux**, mais demande une configuration plus complexe.

---

### Linux

Sur Linux, Docker tourne **nativement**, sans machine virtuelle.

C’est la plateforme la plus performante, la plus simple et la plus stable.

Installation (exemple Ubuntu) :

```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl enable --now docker
```

Avantages :

- performance maximale,
- accès direct aux ressources système,
- gestion des fichiers/volumes simplifiée,
- networking Docker plus rapide.

Documentation :

[https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)

---

### Points de vigilance selon les OS

| Sujet | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Virtualisation | Oui (VM Linux) | Oui (WSL2) | Non |
| Performance | Bonne | Bonne | Excellente |
| Montée en charge | Peut ralentir avec beaucoup de conteneurs | Dépend de WSL2 | Très stable |
| Volumes | Parfois plus lent (FS partagé) | Très rapide avec WSL2 | Rapide |
| Ports | Toujours disponibles | Peut nécessiter `netsh` dans certains cas | Sans problème |
| Droits fichiers | OK | Peut changer les permissions via WSL | Idéal |

---

### Astuce : vérifier que Docker fonctionne

Sur tous les OS :

```bash
docker version
```

Vérifier que le moteur est actif :

```bash
docker info
```

Tester avec un conteneur :

```bash
docker run hello-world
```

---

## Alternatives à Docker Desktop

Docker Desktop est la solution la plus couramment utilisée sur macOS et Windows, mais elle n’est pas la seule.

Il existe plusieurs alternatives permettant d’exécuter Docker Engine, souvent plus légères, plus rapides ou gratuites pour un usage professionnel.

---

### OrbStack (macOS)

OrbStack est une alternative moderne et performante à Docker Desktop, conçue spécifiquement pour macOS.

Il se distingue par :

- une **consommation mémoire et CPU très faible**,
- un **démarrage quasi instantané**,
- un **accès fichiers extrêmement rapide** entre macOS et la VM Linux,
- une interface graphique simple permettant de gérer conteneurs et VMs.

Avantages techniques :

- réseau interne Docker compatible avec Docker Desktop (bridge, ports),
- support pour Docker Compose (versions v1 et v2),
- meilleure intégration avec macOS que Docker Desktop,
- pas de surcharge HyperKit : utilise une VM Linux plus optimisée.

Documentation :

[https://orbstack.dev/](https://orbstack.dev/)

---

### Colima (macOS & Linux)

Colima est une alternative en ligne de commande, basée sur Lima (Linux Machines).

Il permet d’exécuter Docker Engine dans une VM Linux légère.

Caractéristiques :

- configuration extrêmement simple,
- support natif de Docker et Docker Compose,
- faible consommation CPU,
- particulièrement apprécié pour les environnements CI locaux et les développeurs ne souhaitant pas d’interface graphique.

Installation macOS (exemple) :

```bash
brew install colima
colima start


```

Documentation :

[https://github.com/abiosoft/colima](https://github.com/abiosoft/colima)

---

### Rancher Desktop (macOS, Windows, Linux)

Rancher Desktop propose un environnement complet pour Docker et Kubernetes.

Avantages :

- open-source et gratuit pour un usage professionnel,
- supporte Docker (via dockerd) ou containerd (nerdctl),
- gestion intégrée de Kubernetes (K3s).

Inconvénients :

- peut être plus lourd qu’OrbStack ou Colima,
- performances de disque parfois plus faibles que Docker Desktop.

Documentation :

[https://rancherdesktop.io/](https://rancherdesktop.io/)

---

### Docker Engine sous WSL2 (Windows)

Sur Windows, il est possible d’installer Docker **sans Docker Desktop**, uniquement dans un environnement WSL2 (Ubuntu).

Installation dans Ubuntu WSL :

```bash
sudo apt update
sudo apt install docker.io
sudo service docker start


```

Avantages :

- solution entièrement gratuite,
- performance excellente grâce au système de fichiers WSL2.

Limitations :

- nécessite une configuration manuelle (daemon, accès depuis Windows),
- pas d’interface graphique intégrée.

Guide officiel :

[https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)

---

### Podman (macOS, Windows, Linux)

Podman est un moteur de conteneurs “Docker-compatible” sans daemon.

Points clés :

- compatible avec les commandes Docker (`alias docker=podman`),
- conteneurs rootless (plus sécurisés),
- ne nécessite pas de démon système dockerd.

Limitations :

- Docker Compose n’est pas supporté nativement (mais fonctionne via Podman Compose),
- certains workflows ne sont pas 100 % compatibles.

Documentation :

[https://podman.io/](https://podman.io/)

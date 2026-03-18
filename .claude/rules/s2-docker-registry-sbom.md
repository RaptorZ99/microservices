---
paths:
  - "**/Dockerfile"
  - "**/.dockerignore"
  - ".gitlab-ci.yml"
  - ".gitlab/ci/**/*"
  - "docker-compose.yml"
---

# Seance 2 — Docker production, Registry, SBOM et signatures

## Partie 1 — Le probleme des Dockerfiles naifs

Un Dockerfile fonctionnel n'est pas production-ready. Exemple typique d'un Dockerfile de premiere approche :

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
```

Ce Dockerfile fonctionne mais souffre de 5 problemes critiques en contexte professionnel :

**Probleme 1 — Taille excessive** : l'image `node:20` pese ~1 Go. Elle contient les outils de compilation, headers systeme, binaires de developpement — utiles pour construire, inutiles pour faire tourner. Image lourde = telechargement lent en CI/CD, surface d'attaque augmentee (plus de binaires = plus de CVEs potentielles), consommation inutile d'espace registry.

**Probleme 2 — Secrets potentiellement embarques** : `COPY . .` copie tout le contexte de build, y compris `.env`, cles SSH, fichiers de configuration locaux si le `.dockerignore` est absent ou incomplet.

**Probleme 3 — Couches non optimisees** : l'ordre des instructions determine la mise en cache des couches Docker. `COPY . .` avant `RUN npm install` invalide le cache des dependances a chaque modification de code — meme si `package.json` n'a pas change.

**Probleme 4 — Processus root** : par defaut, le processus s'execute en tant que `root` dans le conteneur. En cas de faille d'execution, l'attaquant dispose des droits root.

**Probleme 5 — Pas de distinction build/runtime** : les outils de compilation (compilateurs, bundlers, devDependencies) se retrouvent dans l'image finale, alourdissant inutilement et augmentant la surface de vulnerabilite.

## Partie 2 — Multi-stage builds

### Le principe

Les multi-stage builds permettent de definir plusieurs etapes (`FROM`) dans un seul Dockerfile. Seule la derniere etape (ou une etape nommee explicitement) constitue l'image finale. Les etapes precedentes servent uniquement a construire — elles ne laissent aucune trace dans l'image produite.

```dockerfile
# Etape 1 : builder — image lourde, tous les outils
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etape 2 : runner — image legere, uniquement ce qui tourne
FROM node:20-alpine AS runner
WORKDIR /app
# On copie uniquement les artefacts produits par le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

L'image finale ne contient que le resultat du build et les dependances de production — pas les outils de compilation, pas les sources, pas les devDependencies.

### Optimisation de l'ordre des couches

Docker construit les images couche par couche et met en cache chaque couche. Si une couche change, toutes les couches suivantes sont reconstruites. La regle d'or : **ce qui change le moins doit etre copie en premier**.

```dockerfile
# MAUVAIS ordre — package.json copie avec le code
COPY . .
RUN npm ci          # invalide a chaque modification de code

# BON ordre — dependances isolees
COPY package*.json ./
RUN npm ci          # mis en cache tant que package.json ne change pas
COPY . .            # le code change souvent, mais ne casse pas le cache des deps
```

### Utilisateur non-root

```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app

# Creer un utilisateur dedie sans privileges
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Basculer sur l'utilisateur non-root
USER appuser

CMD ["node", "dist/main.js"]
```

### .dockerignore — Le .gitignore de Docker

Le `.dockerignore` exclut les fichiers du contexte de build envoye au daemon Docker. Sans lui, `COPY . .` peut embarquer des fichiers sensibles ou volumineux.

```
# Dependances locales
node_modules/
.venv/
__pycache__/

# Variables d'environnement — JAMAIS dans une image
.env
.env.*

# Builds locaux
.next/
dist/
build/

# Git
.git/
.gitignore

# IDE et OS
.idea/
.vscode/
.DS_Store
Thumbs.db

# Tests et docs
*.test.js
*.spec.js
coverage/
docs/
README.md
```

### Impact des multi-stage builds — ordre de grandeur

| Service | Image naive | Multi-stage | Reduction |
|---------|-------------|-------------|-----------|
| Next.js (frontend) | ~1.2 Go | ~250 Mo | ~80% |
| FastAPI (auth) | ~900 Mo | ~150 Mo | ~83% |
| NestJS (order) | ~1.1 Go | ~220 Mo | ~80% |

Ces chiffres varient selon le projet. Mesurer avec `docker images` avant et apres.

## Partie 3 — Tagging semantique des images

### Pourquoi le tag `latest` est insuffisant

Le tag `latest` est le tag par defaut de Docker. Il ne pointe sur aucune version precise — il designe simplement la derniere image poussee. En production :

- **Rollback impossible** : si `latest` est casse, on ne peut pas revenir a la version precedente sans avoir conserve une autre reference
- **Non-reproductibilite** : deux deploiements successifs avec `latest` peuvent utiliser des images differentes sans qu'on s'en apercoive
- **Tracabilite nulle** : impossible de savoir quelle version tourne en production

### Les strategies de tagging

**Tagging par SHA de commit** — reference de tracabilite maximale. Chaque image est taguee avec le hash court du commit Git qui l'a produite :

```bash
# En CI, $CI_COMMIT_SHORT_SHA est injecte automatiquement par GitLab
docker build -t registry.gitlab.com/user/project/frontend:$CI_COMMIT_SHORT_SHA .
```

```
registry.gitlab.com/user/project/frontend:a3f9c2d1  <- commit a3f9c2d1
registry.gitlab.com/user/project/frontend:b7e1a4f2  <- commit suivant
```

**Tagging par branche** — identifier rapidement l'environnement cible :

```bash
docker build -t registry.gitlab.com/user/project/frontend:develop .
docker build -t registry.gitlab.com/user/project/frontend:main .
```

**Tagging par version semantique (semver)** — releases stables, format MAJOR.MINOR.PATCH :

```bash
# Declenche par un tag Git (ex: v1.2.3)
docker build -t registry.gitlab.com/user/project/frontend:1.2.3 .
docker build -t registry.gitlab.com/user/project/frontend:1.2 .     # alias minor
docker build -t registry.gitlab.com/user/project/frontend:1 .       # alias major
docker build -t registry.gitlab.com/user/project/frontend:latest .  # alias latest
```

### Strategie combinee recommandee

```bash
# Sur chaque push : tag SHA pour la tracabilite
IMAGE_SHA=$CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHORT_SHA

# Sur develop : tag d'environnement
IMAGE_DEV=$CI_REGISTRY_IMAGE/frontend:develop

# Sur main : tag d'environnement + latest
IMAGE_PROD=$CI_REGISTRY_IMAGE/frontend:main
IMAGE_LATEST=$CI_REGISTRY_IMAGE/frontend:latest

# Sur un tag Git vX.Y.Z : tag semver
IMAGE_SEMVER=$CI_REGISTRY_IMAGE/frontend:${CI_COMMIT_TAG#v}   # strip le 'v'
```

## Partie 4 — Registries d'images

### GitLab Container Registry

Le GitLab Container Registry est integre nativement a chaque projet GitLab. Aucune configuration externe requise — active par defaut.

**Avantages :**
- Authentification automatique dans la CI avec les variables predefinies `$CI_REGISTRY_*`
- Visibilite et acces controles par les permissions du projet GitLab
- Nettoyage des images configurable (cleanup policies)
- Gratuit sur GitLab.com (dans les limites du stockage)

**URL de l'image :** `registry.gitlab.com/NAMESPACE/PROJECT/SERVICE:TAG`

```yaml
# Authentification en CI — aucune variable custom necessaire
build:push:frontend:
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHORT_SHA
```

**Consultation :** GitLab > votre projet > `Deploy > Container Registry`

Doc : https://docs.gitlab.com/ee/user/packages/container_registry/

### Docker Hub

Docker Hub est le registry public de reference de l'ecosysteme Docker. Utilise par defaut lorsqu'on fait `docker pull nginx` ou `FROM node:20`.

**Avantages :**
- Reference universelle de l'ecosysteme
- Images officielles maintenues par les editeurs
- Gratuit pour les images publiques
- Utile pour partager des images open source

**Limites (compte gratuit) :**
- 1 depot prive uniquement
- Rate limiting sur les pulls anonymes (100 pulls / 6h par IP)
- Pas d'integration native avec GitLab CI (necessite de creer des variables)

**Configuration dans GitLab CI :**

```yaml
# Variables a creer dans Settings > CI/CD > Variables
# DOCKERHUB_USERNAME : votre identifiant Docker Hub (non masque)
# DOCKERHUB_TOKEN    : Access Token Docker Hub (masque) — pas votre mot de passe

build:push:dockerhub:
  script:
    - docker login -u $DOCKERHUB_USERNAME -p $DOCKERHUB_TOKEN
    - docker build -t $DOCKERHUB_USERNAME/frontend:$CI_COMMIT_SHORT_SHA .
    - docker push $DOCKERHUB_USERNAME/frontend:$CI_COMMIT_SHORT_SHA
```

**Creer un Access Token Docker Hub :** https://hub.docker.com/settings/security

### Quelle strategie adopter ?

| Cas d'usage | Registry recommande |
|-------------|---------------------|
| CI/CD interne, images privees | GitLab Container Registry |
| Partage public, images open source | Docker Hub |
| Multi-cloud, entreprise | AWS ECR / GCP Artifact Registry / Azure ACR |

Dans ce module : GitLab Container Registry pour la CI/CD principale. Docker Hub presente comme alternative et pour la compatibilite avec des outils externes.

## Partie 5 — Supply Chain : SBOM et signatures d'images

### Le probleme de la supply chain logicielle

Un conteneur de production n'est pas qu'une application — c'est un assemblage de centaines de dependances : bibliotheques systeme, packages applicatifs, binaires. Chacune est un vecteur de vulnerabilite potentiel.

En 2021, l'attaque SolarWinds a montre qu'un acteur malveillant peut compromettre la chaine de distribution logicielle en injectant du code dans une dependance tierce, sans que les equipes de developpement s'en apercoivent.

Deux outils repondent a ce risque :
- Le **SBOM** (Software Bill of Materials) : l'inventaire exhaustif de ce qui compose votre image
- La **signature d'image** : la preuve cryptographique que l'image n'a pas ete alteree apres sa construction

### SBOM — Software Bill of Materials

Un SBOM est un fichier structure qui liste toutes les dependances d'une image Docker : packages systeme, bibliotheques applicatives, versions exactes, licences. C'est l'equivalent d'une liste d'ingredients pour un logiciel.

**A quoi ca sert :**
- Repondre en quelques secondes a "est-ce que notre application utilise log4j ?" lors d'une alerte de securite
- Produire un inventaire de conformite (licences, dependances open source)
- Alimenter les outils de scan de vulnerabilites (seance 4)

**Formats SBOM** — deux standards coexistent :
- **SPDX** (Software Package Data Exchange) — standard Linux Foundation
- **CycloneDX** — standard OWASP, le plus utilise en DevSecOps

### Syft — Generateur de SBOM

Syft est un outil open source d'Anchore qui genere des SBOM a partir d'images Docker, de systemes de fichiers ou de depots de code.

```bash
# Installation (Linux / macOS)
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Generer un SBOM au format CycloneDX JSON depuis une image
syft registry.gitlab.com/user/project/frontend:a3f9c2d1 -o cyclonedx-json > sbom-frontend.json

# Generer un SBOM depuis un dossier de code source
syft dir:./frontend -o spdx-json > sbom-frontend-src.json

# Formats disponibles
syft registry.gitlab.com/user/project/frontend:latest -o table          # lisible humain
syft registry.gitlab.com/user/project/frontend:latest -o json           # syft natif
syft registry.gitlab.com/user/project/frontend:latest -o cyclonedx-json
syft registry.gitlab.com/user/project/frontend:latest -o spdx-json
```

**Extrait d'un SBOM CycloneDX :**

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "components": [
    {
      "name": "next",
      "version": "14.2.3",
      "purl": "pkg:npm/next@14.2.3",
      "licenses": [{ "license": { "id": "MIT" } }]
    },
    {
      "name": "libc",
      "version": "2.38-r1",
      "purl": "pkg:apk/alpine/libc@2.38-r1"
    }
  ]
}
```

Doc Syft : https://github.com/anchore/syft

### Cosign — Signature d'images

Cosign est un outil de la CNCF (Cloud Native Computing Foundation) qui permet de signer cryptographiquement des images Docker. Une image signee garantit :
- **Authenticite** : l'image a ete produite par le pipeline CI officiel
- **Integrite** : l'image n'a pas ete modifiee entre sa construction et son deploiement

**Principe de fonctionnement :**

```
Pipeline CI                          Registry
    |                                   |
    |-- docker build + push ----------> image:sha
    |                                   |
    |-- cosign sign -----------------> image:sha + signature attachee
    |   (avec cle privee)               |
    |                                   |
Deploiement                             |
    |                                   |
    |-- cosign verify <----------------|
    |   (avec cle publique)             |
    |-- OK ou REJET (image invalide)
```

**Generation d'une paire de cles :**

```bash
# Genere cosign.key (privee) et cosign.pub (publique)
cosign generate-key-pair
```

**Signer une image :**

```bash
# La cle privee est passee via variable d'environnement en CI
cosign sign --key cosign.key registry.gitlab.com/user/project/frontend:a3f9c2d1
```

**Verifier une signature :**

```bash
cosign verify --key cosign.pub registry.gitlab.com/user/project/frontend:a3f9c2d1
```

**Keyless signing (sans gestion de cle)** : Cosign supporte la signature sans cle via OIDC (OpenID Connect). GitLab CI peut s'authentifier directement aupres de Sigstore/Fulcio pour signer sans stocker de cle privee. C'est l'approche la plus moderne mais necessite une configuration avancee.

Doc Cosign : https://docs.sigstore.dev/quickstart/quickstart-cosign/

## Partie 6 — Integration dans le pipeline CI/CD

### Architecture du job de build industriel

Un job de build complet en contexte professionnel enchaine :

```
1. Authentification au registry
2. Construction de l'image (multi-stage Dockerfile)
3. Push avec tags multiples (SHA, branche, semver si tag Git)
4. Generation du SBOM
5. Attachement du SBOM a l'image dans le registry (en artifact)
6. Signature de l'image (optionnel selon la politique)
```

### Docker-in-Docker (DinD) en GitLab CI

Pour builder des images Docker dans un pipeline GitLab, il faut que le job puisse acceder au daemon Docker. La solution standard est **Docker-in-Docker (DinD)** : un conteneur Docker qui tourne un daemon Docker.

```yaml
build:frontend:
  image: docker:24-cli          # client Docker
  services:
    - docker:24-dind            # daemon Docker (DinD)
  variables:
    DOCKER_DRIVER: overlay2
    DOCKER_TLS_CERTDIR: "/certs"
  script:
    - docker build ...
```

**Alternative a DinD : Kaniko** — outil de Google qui build des images sans daemon Docker. Plus securise (pas de socket Docker expose), recommande en production.

### Template de job build+push complet

```yaml
# .gitlab/ci/templates/build-push.yml
# Template reutilisable pour le build et push d'une image

.job:build-push:
  image: docker:24-cli
  services:
    - docker:24-dind
  variables:
    DOCKER_DRIVER: overlay2
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    # Authentification GitLab Container Registry
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    # Construction de l'image
    - |
      docker build \
        --tag $IMAGE_NAME:$CI_COMMIT_SHORT_SHA \
        --tag $IMAGE_NAME:$CI_COMMIT_REF_SLUG \
        --label "org.opencontainers.image.revision=$CI_COMMIT_SHA" \
        --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --label "org.opencontainers.image.source=$CI_PROJECT_URL" \
        $SERVICE_PATH
    # Push des deux tags
    - docker push $IMAGE_NAME:$CI_COMMIT_SHORT_SHA
    - docker push $IMAGE_NAME:$CI_COMMIT_REF_SLUG
    # Tag latest sur main uniquement
    - |
      if [ "$CI_COMMIT_BRANCH" = "main" ]; then
        docker tag $IMAGE_NAME:$CI_COMMIT_SHORT_SHA $IMAGE_NAME:latest
        docker push $IMAGE_NAME:latest
      fi
```

### Labels OCI — Metadonnees d'image standardisees

Les labels OCI (Open Container Initiative) sont des metadonnees standardisees attachees aux images Docker. Ils permettent a n'importe quel outil d'extraire des informations sur l'origine de l'image.

```dockerfile
# Dans le Dockerfile (valeurs statiques)
LABEL org.opencontainers.image.title="Auth Service"
LABEL org.opencontainers.image.description="Service d'authentification JWT"
LABEL org.opencontainers.image.licenses="MIT"

# En CI (valeurs dynamiques passees via --label ou ARG)
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.source=$CI_PROJECT_URL
```

Spec OCI : https://github.com/opencontainers/image-spec/blob/main/annotations.md

## Partie 7 — Bonnes pratiques

### Regles d'or pour les Dockerfiles en production

1. **Toujours utiliser des images de base Alpine ou Distroless** — `node:20-alpine` plutot que `node:20`, `python:3.12-slim` plutot que `python:3.12`
2. **Toujours utiliser des tags precis** — `node:20.11.1-alpine3.19` plutot que `node:20-alpine` (qui peut changer)
3. **Toujours avoir un `.dockerignore`** complet avant tout `COPY . .`
4. **Toujours utiliser un utilisateur non-root** dans le stage final
5. **Toujours separer l'installation des dependances du COPY du code** pour maximiser le cache
6. **Ne jamais embarquer de secrets** dans une couche Docker — meme si supprimes ensuite, ils restent dans l'historique des couches
7. **Generer le SBOM apres le push**, pas avant (l'image doit etre dans le registry pour etre analysee)

### Cleanup policy — Eviter l'accumulation d'images

Un registry qui recoit des images a chaque push peut rapidement devenir volumineux. GitLab Container Registry permet de configurer des politiques de nettoyage automatique.

**Configuration :** GitLab > projet > `Settings > Packages and registries > Container registry`

Exemple de politique raisonnable :
- Conserver les 10 dernieres images par tag
- Supprimer les images sans tag de plus de 7 jours
- Exclure les tags `latest`, `main`, `develop` de la suppression automatique

---
paths:
  - ".gitlab-ci.yml"
  - ".gitlab/ci/**/*"
  - ".gitlab/**/*"
---

# Seance 1 — CI/CD et Pipeline GitLab mono-repo

## Partie 1 — Le probleme que CI/CD resout

Sans CI/CD, chaque etape est manuelle : lancer les tests, construire l'image Docker, deployer en production. Chaque etape manuelle = source d'oubli, d'erreur, d'incoherence entre environnements.

- **CI (Continuous Integration)** : verifier automatiquement que le code fonctionne a chaque push (compiler, tester, analyser la qualite). Detecter les regressions dans les minutes suivant le `git push`. Principe fondateur (Martin Fowler, 2006) : "Integrate early, integrate often."
- **CD — Continuous Delivery** : pipeline prepare automatiquement une version prete a deployer. Le declenchement en prod reste une decision humaine.
- **CD — Continuous Deployment** : chaque commit valide est automatiquement deploye en production, sans intervention humaine.

Notre objectif : **Continuous Delivery** — pipeline complet, deploy staging auto, deploy prod sur validation manuelle.

```
Code  ->  CI  ->  CD  ->  Production
 |         |       |
git push  Tests   Deploy
          Build   Staging
          Scan    Rollback
          Quality
```

## Partie 2 — Anatomie d'un pipeline GitLab CI

### Le fichier .gitlab-ci.yml

Fichier YAML a la racine du depot, lu et execute par GitLab a chaque evenement Git (push, MR, tag). C'est de l'**Infrastructure as Code** appliquee a la CI.

### Structure fondamentale

Pipeline = **stages** (etapes sequentielles) contenant des **jobs** (taches paralleles dans un stage).

```yaml
stages:
  - build
  - test
  - deploy

build-image:
  stage: build
  script:
    - docker build -t mon-app .

run-tests:
  stage: test
  script:
    - npm test

deploy-staging:
  stage: deploy
  script:
    - ./deploy.sh
```

**Regles d'execution par defaut :**
- Les stages s'executent **dans l'ordre declare**
- Les jobs d'un meme stage s'executent **en parallele**
- Si un job echoue, les stages suivants **ne s'executent pas** (fail-fast)

### Composants essentiels

| Composant | Role |
|-----------|------|
| `image` | Image Docker dans laquelle le job s'execute. Ex: `node:20-alpine`. Peut etre defini par defaut via `default: image:` |
| `script` | Commandes shell executees sequentiellement. Si l'une echoue (code retour non nul), le job echoue |
| `variables` | Parametrage du pipeline, surchargeable par job |
| `artifacts` | Fichiers produits par un job, transmis aux jobs suivants ou telechargeables depuis l'interface GitLab |
| `cache` | Donnees reutilisees **entre pipelines** (node_modules, .venv). Cle par `$CI_COMMIT_REF_SLUG` |
| `rules` | Conditions de declenchement du job (`if`, `changes`, `when`) |
| `needs` | Dependances fines entre jobs, meme de stages differents (pipeline DAG) |
| `extends` | Heritage de configuration depuis un template |
| `include` | Decomposition du pipeline en fichiers (`local`, `remote`, `template`) |

### Cache vs Artifacts

- **Cache** : accelere les jobs en reutilisant des donnees **entre pipelines** (ex: `node_modules/`)
- **Artifacts** : transmet des fichiers produits **entre jobs d'un meme pipeline** (ex: `dist/`, `coverage/`)

```yaml
# Cache
default:
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - node_modules/
      - .npm/

# Artifacts
run-tests:
  artifacts:
    paths:
      - coverage/
    expire_in: 1 week
```

### Variables predefinies GitLab

| Variable | Valeur |
|----------|--------|
| `$CI_COMMIT_SHA` | Hash complet du commit |
| `$CI_COMMIT_SHORT_SHA` | Hash court (8 caracteres) |
| `$CI_COMMIT_BRANCH` | Nom de la branche (vide pour les pipelines MR) |
| `$CI_COMMIT_TAG` | Tag Git si applicable |
| `$CI_REGISTRY` | URL du GitLab Container Registry |
| `$CI_REGISTRY_IMAGE` | Chemin complet de l'image dans le registry |
| `$CI_REGISTRY_USER` | Utilisateur pour s'authentifier au registry |
| `$CI_REGISTRY_PASSWORD` | Token d'authentification au registry |
| `$CI_PIPELINE_SOURCE` | Source du declenchement (`push`, `merge_request_event`...) |

Doc complete : https://docs.gitlab.com/ee/ci/variables/predefined_variables.html

### Secrets et variables securisees

Les informations sensibles ne doivent **jamais** apparaitre dans `.gitlab-ci.yml`. Utiliser `Settings > CI/CD > Variables` :

| Type | Description | Usage |
|------|-------------|-------|
| Variable | Texte visible dans les logs | URLs, noms d'environnements |
| Variable (masked) | Valeur cachee dans les logs | Tokens, mots de passe |
| File | Contenu ecrit dans un fichier temporaire | Certificats, configs |

```yaml
# Les valeurs sont injectees par GitLab, jamais ecrites dans le YAML
build-and-push:
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:latest
```

## Partie 3 — Pipelines mono-repo multi-services

### Avantages du mono-repo

- Un seul depot a gerer, une seule CI
- Visibilite transversale sur l'etat de tous les services
- Facilite pour les changements qui touchent plusieurs services

### Contraintes specifiques a la CI

- Un push sur `frontend/` ne doit **pas** declencher le build de `auth-service`
- Le pipeline peut devenir tres long si tout s'execute a chaque push
- Structurer le `.gitlab-ci.yml` pour qu'il reste lisible et maintenable

### rules: changes — Jobs conditionnels par service

```yaml
build:frontend:
  stage: build
  rules:
    - changes:
        - frontend/**/*
        - .gitlab/ci/frontend.yml
        - .gitlab-ci.yml
  script:
    - cd frontend && npm ci && npm run build
```

### include — Decomposer le pipeline en fichiers

```yaml
# .gitlab-ci.yml — Point d'entree uniquement
include:
  - local: '.gitlab/ci/frontend.yml'
  - local: '.gitlab/ci/auth-service.yml'
  - local: '.gitlab/ci/order-service.yml'

stages:
  - lint
  - build
  - test
  - scan
  - deploy
```

```yaml
# .gitlab/ci/frontend.yml — Pipeline du frontend uniquement
.frontend:rules:
  rules:
    - changes:
        - frontend/**/*
        - .gitlab/ci/frontend.yml

lint:frontend:
  stage: lint
  image: node:20-alpine
  extends: .frontend:rules
  script:
    - cd frontend && npm ci && npm run lint
```

### CODEOWNERS — Revues obligatoires par service

Definit qui doit approuver les modifications par partie du depot. Avec la protection de branches, garantit une revue par le responsable du service.

```
/frontend/              @username-frontend
/auth-service/          @username-auth
/order-service/         @username-orders
/.gitlab-ci.yml         @username-frontend @username-auth @username-orders
```

Doc : https://docs.gitlab.com/ee/user/project/codeowners/

## Partie 4 — Strategie de branches

### Gitflow (Vincent Driessen, 2010)

5 types de branches :

| Branche | Duree de vie | Role |
|---------|-------------|------|
| `main` | Permanente | Code en production. Chaque commit = tag de release |
| `develop` | Permanente | Branche d'integration. Features terminees en attente de release |
| `feature/xxx` | Temporaire | Feature en dev. Creee depuis `develop`, mergee dans `develop` |
| `release/x.y.z` | Temporaire | Preparation de release. Creee depuis `develop`, mergee dans `main` ET `develop` |
| `hotfix/xxx` | Temporaire | Correction urgente prod. Creee depuis `main`, mergee dans `main` ET `develop` |

**Avantages** : clair, bien documente, adapte aux releases planifiees.
**Limites** : lourd pour les equipes qui deployent souvent, merges doubles, `develop` peut diverger de `main`.

### Trunk-based Development (TBD)

Adopte par Google, Meta, Netflix. Recommande par la recherche DORA (2023).

Une seule branche longue : `main`. Branches feature tres courtes (1-2 jours max). Code non termine masque par des **feature flags** (interrupteurs configurables a runtime).

```javascript
const features = {
  NEW_PAYMENT_FLOW: process.env.FEATURE_NEW_PAYMENT === 'true'
}
function renderCheckout() {
  if (features.NEW_PAYMENT_FLOW) {
    return <NewPaymentComponent />   // desactive en prod
  }
  return <LegacyPaymentComponent />  // comportement stable
}
```

| Critere | Gitflow | Trunk-based |
|---------|---------|-------------|
| Frequence d'integration | Faible | Tres elevee (plusieurs fois/jour) |
| Risque de conflits | Eleve | Tres faible |
| Temps entre ecriture et prod | Jours a semaines | Heures |
| Detection des bugs | Tard (fin de feature) | Tot (integration continue reelle) |
| Complexite Git | Elevee (5 types de branches) | Faible (1 branche principale) |
| Deploiement continu reel | Difficile | Natif |

Outillage feature flags : LaunchDarkly (SaaS), Unleash (open source), GrowthBook (open source).

### Notre strategie : Gitflow simplifie, evolutif vers TBD

Version simplifiee de Gitflow, peut evoluer vers TBD en supprimant `develop` + feature flags.

| Branche | Deploiement auto | Environnement |
|---------|------------------|---------------|
| `main` | Apres validation manuelle | Production |
| `develop` | Automatique | Staging / Dev |
| `feature/*` | Non — lint + tests uniquement | Local |
| `hotfix/*` | Non — lint + tests uniquement | Local |

Regles :
- `feature/*` -> `develop` via Merge Request
- `hotfix/*` -> `main` via MR + backport -> `develop`
- `develop` -> `main` via MR + validation manuelle
- Push direct interdit sur `main` et `develop` (branches protegees)
- Nommage : `feature/S1-setup-gitlab`, `hotfix/fix-auth-token`

## Partie 5 — Workflow CI/CD par branche

```
feature/* / hotfix/*  ->  lint + tests unitaires (rapide, feedback immediat)
develop               ->  lint + build + tests + push registry + deploy DEV (auto)
main                  ->  lint + build + tests + push registry + deploy PROD (manuel)
```

### Implementation avec rules et extends

```yaml
# Regles globales reutilisables
.rules:feature:
  rules:
    - if: '$CI_COMMIT_BRANCH =~ /^feature\//'
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix\//'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

.rules:develop:
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'

.rules:main:
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

.rules:any-protected:
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_BRANCH == "develop"'
    - if: '$CI_COMMIT_BRANCH =~ /^feature\//'
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix\//'
```

```yaml
# Lint : toutes les branches
lint:frontend:
  extends: .rules:any-protected
  script:
    - cd frontend && npm run lint

# Build : uniquement develop et main
build:frontend:
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'
    - if: '$CI_COMMIT_BRANCH == "main"'
  script:
    - cd frontend && npm ci && npm run build

# Deploy DEV : automatique sur develop
deploy:dev:
  extends: .rules:develop
  environment:
    name: dev
    url: https://dev-monapp.fly.dev

# Deploy PROD : manuel sur main
deploy:prod:
  extends: .rules:main
  when: manual
  environment:
    name: production
    url: https://monapp.fly.dev
```

### Visualisation du pipeline

```
Branch: feature/xxx
  -> lint:frontend  lint:auth  lint:order  (parallele, ~2 min)

Branch: develop
  -> lint:*  (parallele)
  -> build:*  (parallele, conditionnel par changes)
  -> test:*  (parallele)
  -> deploy:dev  (automatique)

Branch: main
  -> lint:*
  -> build:*
  -> test:*
  -> [bouton manuel]  deploy:prod
```

## Partie 6 — Conventional Commits et conventions de nommage

Un historique Git lisible permet de generer automatiquement un changelog, comprendre l'intention de chaque modif, et declencher des comportements CI (ex: `fix:` incremente le PATCH en semver).

Format : `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalite |
| `fix` | Correction de bug |
| `chore` | Maintenance (deps, config, CI) |
| `docs` | Documentation uniquement |
| `test` | Ajout/modification de tests |
| `refactor` | Refactoring sans changement de comportement |
| `perf` | Amelioration de performance |
| `ci` | Modifications du pipeline CI/CD |

Exemples :
```
feat(auth): add JWT refresh token rotation
fix(frontend): correct login redirect on 401
chore(ci): update Node.js image to 20-alpine
ci(pipeline): add rules for mono-repo conditional builds
```

Spec complete : https://www.conventionalcommits.org/

### Nommage des branches

```
feature/S1-setup-gitlab-pipeline
feature/auth-refresh-token
feature/order-service-pagination
fix/order-service-null-pointer
hotfix/prod-auth-crash
```

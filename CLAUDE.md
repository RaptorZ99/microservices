# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Outils & Skills — OBLIGATOIRE

### MCP GitLab (`glab`) — TOUJOURS utiliser
Tu as accès au MCP GitLab via `glab mcp serve`. Utilise SYSTÉMATIQUEMENT les outils `mcp__GitLab__*` pour toute opération GitLab : repos, issues, merge requests, pipelines, CI/CD variables, runners, labels, releases, etc. Ne jamais faire ces opérations manuellement ou via curl quand le MCP est disponible.

### Skill `/git-workflow` — TOUJOURS invoquer
Pour TOUT ce qui touche à Git : commits, branches, merge requests, revues de code, résolution de conflits, merges, cherry-picks, rebases, conventions de nommage, Conventional Commits. Tu DOIS invoquer `/git-workflow` AVANT de faire quoi que ce soit lié à Git. Ne jamais commiter, créer une branche ou une MR sans passer par ce skill.

### MCP Context7 — TOUJOURS consulter
Pour TOUTE question sur une librairie ou un framework (Next.js, NestJS, Prisma, FastAPI, Tailwind, React, etc.), tu DOIS d'abord consulter la documentation via `mcp__plugin_context7_context7__resolve-library-id` puis `mcp__plugin_context7_context7__query-docs`. Ne jamais se fier uniquement à tes connaissances internes quand Context7 peut fournir la doc à jour.

### Skill `/gitlab-ci-cd` — Pipeline CI/CD
**Quand :** Modification de `.gitlab-ci.yml` ou des fichiers dans `.gitlab/ci/`. Création, optimisation ou debug de pipelines, configuration de stages, runners, rules mono-repo, security scanning, stratégies de déploiement.
**Pourquoi :** Fournit l'architecture DAG (`needs`), l'optimisation (cache, artifacts, parallélisme), les rules mono-repo, les patterns de security scanning (SAST/DAST), et les stratégies de déploiement (blue-green, canary, rolling).

### Rules `.claude/rules/` — Cours et référentiels
Les fichiers dans `.claude/rules/` contiennent les cours du module DevOps (CI/CD, Docker, etc.) synthétisés et structurés. Ils sont chargés automatiquement selon les fichiers touchés (frontmatter `paths:`). TOUJOURS s'y référer quand tu travailles sur un sujet couvert par un cours (pipeline, Dockerfile, registry, etc.) pour respecter les patterns et bonnes pratiques enseignés.

### Skills de test — Invocation obligatoire selon le contexte

Chaque skill ci-dessous DOIT être invoqué AVANT d'écrire ou modifier du code de test dans le domaine correspondant. Ne jamais écrire de tests "de tête" quand un skill dédié existe.

#### `/jest-testing` — Tests unitaires & intégration TypeScript/JavaScript
**Quand :** Écriture ou modification de fichiers `*.spec.ts` / `*.test.ts` dans `order-service/`, `book-service/` ou `frontend/`. Dès que tu utilises `describe`, `it`, `expect`, `jest.fn()`, `jest.mock()` ou `jest.spyOn()`.
**Pourquoi :** Fournit les 9 règles de mock design, les patterns async, les matchers avancés, la gestion des timers, et l'optimisation CI pour Jest 29+/30+.
**Services concernés :** order-service, book-service (NestJS) pour les tests unitaires ; frontend (Next.js) pour les tests unitaires ET d'intégration (test des route handlers, composants avec mocks de fetch, etc.).

#### `/python-testing` — Tests unitaires & intégration Python
**Quand :** Écriture ou modification de fichiers `test_*.py` dans `auth-service/`. Dès que tu configures pytest, écris des fixtures, ou fais du mocking Python. Aussi pour les tests d'intégration Python (TestClient FastAPI, fixtures de BDD, isolation par transaction).
**Pourquoi :** Fournit les patterns pytest (AAA, fixtures, parametrize, pytest-mock, pytest-asyncio), les seuils de couverture (80% min), et le workflow TDD. Couvre AUSSI les tests d'intégration : test des endpoints FastAPI avec `TestClient`, fixtures de base de données, isolation entre tests.
**Service concerné :** auth-service (FastAPI) — unitaires ET intégration.

#### `/supertest` — Tests d'intégration HTTP (NestJS)
**Quand :** Écriture ou modification de fichiers `*.e2e-spec.ts`. Tests de flux complets via HTTP : auth flows, CRUD, pagination, validation, autorisation.
**Pourquoi :** Fournit les patterns Supertest + NestJS pour tester des endpoints réels avec base de données de test, setup/teardown, et assertions sur les réponses HTTP complètes.
**Services concernés :** order-service, book-service.

#### `/pact-testing` — Tests de contrat (Consumer-Driven)
**Quand :** Écriture ou modification de fichiers `*.pact.spec.ts`, `*.contract.spec.ts`, ou tout fichier dans un dossier `pact/`. Vérification des interfaces entre services (frontend → auth, frontend → order, frontend → book).
**Pourquoi :** Fournit les patterns PactV3/V4 avec matchers (`like`, `eachLike`, `integer`, `string`), provider states, vérification provider, et intégration CI via artifacts GitLab (pas de Pact Broker dans notre mono-repo).
**Services concernés :** Tous — le frontend est consumer, les 3 backends sont providers.

#### `/stryker` — Tests de mutation NestJS (TypeScript)
**Quand :** Configuration ou exécution de StrykerJS, analyse de mutants survivants, amélioration du score de mutation sur les services NestJS uniquement.
**Pourquoi :** Fournit la config StrykerJS (mutators, reporters, thresholds high/low/break), le mode incrémental pour CI, les patterns NestJS, et les techniques de désactivation de mutants (commentaires `// Stryker disable`).
**Services concernés :** order-service, book-service (NestJS uniquement). Ne PAS utiliser pour le frontend ou l'auth-service.

#### `/cosmic-ray` — Tests de mutation Python (auth-service uniquement)
**Quand :** Configuration ou exécution de Cosmic Ray, analyse de mutants survivants, amélioration du score de mutation sur le auth-service uniquement.
**Pourquoi :** Fournit la config TOML, les opérateurs de mutation (binary/comparison/boolean/unary), les filtres (pragma, git diff), l'exécution distribuée, et le reporting (console/HTML).
**Service concerné :** auth-service (Python uniquement). Ne PAS utiliser pour les services NestJS → utiliser `/stryker` à la place.

#### `/playwright-skill` — Tests E2E
**Quand :** Écriture ou modification de tests E2E Playwright. Tests de flux utilisateur complets via le navigateur : login, navigation, CRUD via l'UI, vérifications visuelles.
**Pourquoi :** Fournit les locators sémantiques (`getByRole`, `getByLabel`), l'auto-waiting, les fixtures d'isolation, le Page Object Model, le network mocking, les configs CI GitLab, et les patterns d'accessibilité.
**Service concerné :** frontend (teste l'application complète via le navigateur).

#### `/k6-performance` — Tests de performance
**Quand :** Écriture ou modification de scripts k6. Tests de charge (load), stress, spike, soak, ou smoke sur les endpoints API.
**Pourquoi :** Fournit les scénarios k6 (ramping-vus, constant-arrival-rate), les thresholds (`http_req_duration`, `http_req_failed`), les custom metrics (Trend, Rate, Counter, Gauge), l'authentification dans les tests, et l'analyse des résultats.
**Services concernés :** Tous les endpoints — auth (`/health`, `/login`), order, book, frontend API routes.

### Ordre d'invocation recommandé (multi-skill)

Quand tu travailles sur plusieurs types de tests à la fois, invoque les skills dans cet ordre :
1. **Unitaires** (`/jest-testing` pour NestJS/Next.js, `/python-testing` pour FastAPI) — base de la pyramide
2. **Intégration** (`/supertest` pour NestJS, `/jest-testing` pour Next.js, `/python-testing` pour FastAPI) — vérifie les couches ensemble
3. **Contrat** (`/pact-testing`) — vérifie les interfaces entre services
4. **Mutation** (`/stryker` pour NestJS, `/cosmic-ray` pour Python) — évalue la qualité des tests écrits
5. **Performance** (`/k6-performance`) — comportement sous charge
6. **E2E** (`/playwright-skill`) — flux utilisateur complets

## Projet

**"I Want it"** — Plateforme microservices avec 4 services conteneurisés, orchestrés via Docker Compose et Kubernetes.

## Architecture

```
User → Next.js (port 3000, gateway + UI)
         ├── auth-service  (FastAPI, port 8000, SQLite)
         ├── order-service (NestJS, port 4000, SQLite/Prisma)
         └── book-service  (NestJS, port 9000, SQLite/Prisma)
```

Le **frontend Next.js** fait office d'API gateway : il proxy les requêtes vers les services backend via des route handlers (`/app/api/`), en injectant le Bearer token JWT extrait des cookies httpOnly.

## Stack par service

| Service | Lang | Framework | ORM/DB | Port |
|---------|------|-----------|--------|------|
| auth-service | Python 3.12 | FastAPI | SQLModel / SQLite | 8000 |
| order-service | TypeScript | NestJS 11 | Prisma 7 / SQLite | 4000 |
| book-service | TypeScript | NestJS 11 | Prisma 7 / SQLite | 9000 |
| frontend | TypeScript | Next.js 16 (App Router) + React 19 + Tailwind 4 | — | 3000 |

## Authentification

- JWT HS256 avec secret partagé (`JWT_SECRET` identique sur tous les services)
- Access token : 60 min, refresh token : 30 jours
- Le frontend stocke les tokens en cookies httpOnly et les relaie en header `Authorization: Bearer`
- Middleware Next.js protège `/order/*` et `/book/*`
- Compte seedé par défaut : `admin` / `admin`
- Les NestJS services valident le JWT via `JwtAuthGuard` ; toutes les données sont scopées par `user.sub`

## Health checks

- Auth : `GET http://localhost:8000/health`
- Order : `GET http://localhost:4000/health`
- Book : `GET http://localhost:9000/health`
- Frontend : `GET http://localhost:3000/api/health`

## Kubernetes

Manifests dans `k8s/`, namespace `microservices`. Structure :

```
k8s/
├── namespace.yaml
├── auth/       # deployment + service + PVC (/app/db)
├── order/      # deployment + service + PVC (/app/data)
├── book/       # deployment + service + PVC (/app/data)
├── frontend/   # deployment + service
└── ingress/    # ingress.yaml → route devops.local → frontend:3000
```

- Images : `louisscrf/{service}:latest`
- Probes liveness/readiness sur `/health` pour chaque service
- PVC pour persister les BDD SQLite (auth, order, book)
- Minikube avec addon ingress, accès via `devops.local`

## GitLab

**Repo** : https://gitlab.com/loulou.scarfone/microservices

Gitflow simplifié : `feature/*` → `develop` → `main` via Merge Requests. Branches `main` et `develop` protégées (push = No one). Pipeline CI mono-repo dans `.gitlab-ci.yml` + `.gitlab/ci/`.

### Conventional Commits

Format : `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Maintenance (deps, config, CI) |
| `docs` | Documentation uniquement |
| `test` | Ajout/modification de tests |
| `refactor` | Refactoring sans changement de comportement |
| `perf` | Amélioration de performance |
| `ci` | Modifications du pipeline CI/CD |

Exemples :
```
feat(auth): add JWT refresh token rotation
fix(frontend): correct login redirect on 401
ci(pipeline): add rules for mono-repo conditional builds
```

## Points critiques

- **JWT_SECRET** doit être identique sur auth, order, book et frontend
- **Prisma migrations** s'exécutent au démarrage des conteneurs NestJS (`npx prisma migrate deploy`)
- **OpenLibrary** : le book-service appelle l'API publique OpenLibrary ; seuls les `workId` sont stockés localement
- **SQLite** : les BDD sont persistées dans des volumes Docker (`auth_db_data`, `order_db_data`, `book_db_data`)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Outils & Skills — OBLIGATOIRE

### MCP GitLab (`glab`) — TOUJOURS utiliser
Tu as accès au MCP GitLab via `glab mcp serve`. Utilise SYSTÉMATIQUEMENT les outils `mcp__GitLab__*` pour toute opération GitLab : repos, issues, merge requests, pipelines, CI/CD variables, runners, labels, releases, etc. Ne jamais faire ces opérations manuellement ou via curl quand le MCP est disponible.

### Skill `/git-workflow` — TOUJOURS invoquer
Pour TOUT ce qui touche à Git : commits, branches, merge requests, revues de code, résolution de conflits, merges, cherry-picks, rebases, conventions de nommage, Conventional Commits. Tu DOIS invoquer `/git-workflow` AVANT de faire quoi que ce soit lié à Git. Ne jamais commiter, créer une branche ou une MR sans passer par ce skill.

### MCP Context7 — TOUJOURS consulter
Pour TOUTE question sur une librairie ou un framework (Next.js, NestJS, Prisma, FastAPI, Tailwind, React, etc.), tu DOIS d'abord consulter la documentation via `mcp__plugin_context7_context7__resolve-library-id` puis `mcp__plugin_context7_context7__query-docs`. Ne jamais se fier uniquement à tes connaissances internes quand Context7 peut fournir la doc à jour.

### Rules `.claude/rules/` — Cours et référentiels
Les fichiers dans `.claude/rules/` contiennent les cours du module DevOps (CI/CD, Docker, etc.) synthétisés et structurés. Ils sont chargés automatiquement selon les fichiers touchés (frontmatter `paths:`). TOUJOURS s'y référer quand tu travailles sur un sujet couvert par un cours (pipeline, Dockerfile, registry, etc.) pour respecter les patterns et bonnes pratiques enseignés.

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

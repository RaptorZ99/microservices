# TP 02 - Frontend + API Gateway (Next.js) - TD

# Partie 1 — Préparer le terrain (toutes stacks / tous systèmes d’exploitation)

## Prérequis outillés

**Les environnements suivants doivent être installés :**

- **Node.js 20+ :** indispensable pour exécuter Next.js et les outils associés.
  Documentation : [https://nodejs.org/en/docs](https://nodejs.org/en/docs)
- **Python 3.12+ :** utilisé par le service d’authentification basé sur FastAPI.
  Documentation : [https://www.python.org/doc/](https://www.python.org/doc/)
- **Docker & Docker Compose :** nécessaires pour les travaux ultérieurs (conteneurisation, orchestration locale).
  Documentation : [https://docs.docker.com/](https://docs.docker.com/)
- **Git :** gestion de versions, workflows CI/CD, reproductibilité du code.
  Documentation : [https://git-scm.com/doc](https://git-scm.com/doc)

**Vérification rapide des versions installées :**

```bash
node -v
python --version
docker --version
git --version
```

---

## Structure des dépôts

**Organisation proposée à la racine du poste local :**

```bash
mkdir microservices
cd microservices
```

**Arborescence cible :**

```plain text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # page de login
│   ├── dashboard/page.tsx     # zone protégée
│   └── api/                   # petite passerelle API côté serveur
│        ├── auth-login.ts     # POST → auth-service
│        └── refresh.ts        # POST → refresh-token
├── proxy.ts                   # garde d’auth SSR
├── lib/
│   ├── api.ts                 # client API basé sur fetch
│   └── auth.ts                # helpers cookies/JWT
├── .env
└── .env.example
```

**Chaque service possède :**

- son propre dépôt Git ou son propre dossier (selon usage monorepo/multi-repo),
- sa configuration,
- ses dépendances,
- sa logique métier.

---

---

## Vision UX de bout en bout

**Le fonctionnement attendu en environnement local est le suivant :**

1. L’utilisateur accède à une **page de connexion** via le frontend Next.js.
1. Le frontend envoie les identifiants au **service d’authentification** (FastAPI).
1. Le service Auth renvoie :
  - un access token (JWT),
  - un refresh token, placé dans un cookie httpOnly.
1. Le frontend stocke ces tokens côté serveur (jamais exposés au navigateur).
1. Le middleware SSR de Next.js vérifie la présence et la validité du JWT avant d’autoriser l’accès à `/dashboard`.
1. Les appels vers les services internes sont réalisés via l’API Gateway Next :
  - `/api/auth-login` → Auth Service
  - `/api/orders` → Order Service
1. Le navigateur n’a jamais accès au JWT en clair.

Cette approche garantit un contrôle strict du flux de données sensibles, en conformité avec les bonnes pratiques de sécurité (separation of concerns, cookies httpOnly, SSR secure routing).

# Partie 2 — Frontend / API Gateway (Next.js + Middleware SSR)

## Afficher une page de Login et une page Dashboard

**1. Créer un projet Next.js en TypeScript**

La commande suivante initialise un projet utilisant le routeur App de Next.js (recommandé dans les versions 13+) :

```bash
npx create-next-app@latest frontend --typescript --eslint
cd frontend
```

Next.js crée automatiquement une structure contenant le dossier `app/`, où seront placées les pages.

**2. Installer les dépendances nécessaires**

Deux bibliothèques seront utilisées dès cette étape :

- **zod** : validation de schémas (utile pour les formulaires et les étapes suivantes).
- **cookie** : manipulation des cookies dans les API Routes (nécessaire plus tard pour l’API Gateway).

```bash
npm install zod
npm install cookie
```

**3. Créer la page de login (route **`**/**`**)**

Cette page est une page **client-side** (`'use client'`) car elle contient des interactions utilisateur (formulaire, états React).

Elle doit :

- afficher un formulaire de connexion,
- envoyer les données à une route interne (`/api/auth-login`) qui sera mise en place dans une étape ultérieure,
- rediriger vers `/dashboard` en cas de succès.

**4. Créer la page Dashboard (route **`**/dashboard**`**)**

Le Dashboard est une page **rendered server-side**.

Elle doit :

- être accessible uniquement pour les utilisateurs authentifiés (le middleware d’étape 2 gérera cela),
- effectuer un appel interne à l’API Gateway pour récupérer des données (par exemple une liste de commandes).
- ne pas utiliser `'use client'`.

À ce stade, si aucune API n’est encore opérationnelle, la page peut afficher une structure minimale (appel API entouré d’un bloc `try/catch`).

**5. Vérifier que les routes locales sont correctement détectées par Next.js**

Un simple :

```bash
npm run dev
```

permet d’ouvrir `http://localhost:3000/` et d’afficher la page de login, ainsi que `http://localhost:3000/dashboard`(qui sera pour l’instant en échec, en attendant la gestion des fichiers lib).

---

**Structure nécéssaire du dossier **`**app/**`** après cette étape :**

```plain text
app/
├── page.tsx               # page de login
└── dashboard/
    └── page.tsx           # page dashboard (SSR)
```

---

### `app/page.tsx` (Login)

```typescript
'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [loading, setL] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setL(true)
    setErr('')

    // Appel à l’API Gateway (sera implémenté dans une étape ultérieure)
    const res = await fetch('/api/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    setL(false)
    if (res.ok) {
      window.location.href = '/dashboard'
    } else {
      const j = await res.json().catch(() => ({ detail: 'Erreur' }))
      setErr(j.detail || 'Échec de connexion')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800">
          Connexion
        </h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom d’utilisateur
            </label>
            <input type="text"
              value={username}
              onChange={(e) => setU(e.target.value)}
              placeholder="john.doe"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input type="password"
              value={password}
              onChange={(e) => setP(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg
            font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

---

### `app/dashboard/page.tsx` (Dashboard SSR)

```typescript
import { serverApi } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

export default async function Dashboard() {
  const api = serverApi()
  const token = getAccessToken()

  let orders: any[] = []
  try {
    orders = await api.get('/orders', {
      headers: {
        'x-ssr': '1',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    })
  } catch {
    orders = []
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Dashboard</h1>
      <p>Contenu préliminaire. Les données réelles seront disponibles lorsque l’Order Service sera branché.</p>
      <pre>{JSON.stringify(orders, null, 2)}</pre>
    </main>
  )
}
```

## Créer un proxy middleware

**1. Créer un proxy SSR dédié à l’authentification.**

Le proxy :

- lit les cookies transmis dans la requête,
- détecte la présence du cookie `access_token`,
- autorise ou interdit l’accès en fonction de cette présence,
- dans le cas d’une absence, redirige vers `/` avec un paramètre explicatif.

Documentation officielle :

[https://nextjs.org/docs/app/building-your-application/routing/middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

L'implémentation est isolée dans `proxy.ts` pour séparer la logique métier de la configuration du middleware.

---

**2. Ajouter un client API serveur (**`**lib/api.ts**`**).**

Ce module fournit une abstraction minimale et centralisée autour de `fetch`.

Il permet :

- de définir un `baseURL`,
- d’uniformiser les méthodes GET et POST,
- de réduire la duplication dans les pages SSR et dans les routes API internes.

Cela renforce la cohérence de l’API Gateway.

---

**3. Ajouter un module de gestion des tokens JWT côté serveur (**`**lib/auth.ts**`**).**

Ce module encapsule la manipulation des cookies JWT via l’API `cookies()` de Next.js :

- lecture du token (`getAccessToken`),
- écriture du token (`setTokens`),
- suppression du token (`clearTokens`).

Il s’exécute exclusivement côté serveur et n’est jamais envoyé au client.

---

Structure attendue à la fin de cette étape :

```plain text
frontend/
├── app/
│   └── ...
├── proxy.ts
└── lib/
    ├── api.ts
    └── auth.ts
```

---

### `proxy.ts`

```typescript
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Déclare explicitement quelles routes doivent passer par ce proxy.
// Ici : toutes les routes de /dashboard et sous-routes.
export const config = {
  matcher: ['/dashboard/:path*'],
}

/**
 * Proxy SSR chargé de contrôler l'accès aux zones protégées.
 *
 * - Vérifie la présence du cookie `access_token`
 * - En cas d’absence : redirige vers la page de login
 * - Sinon : laisse passer la requête
 */
export function proxy(request: NextRequest) {
  // Extraction du token côté serveur via les cookies de la requête
  const access = request.cookies.get('access_token')?.value

  // Absence du token → redirection vers '/'
  if (!access) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('reason', 'auth-required') // paramètre informatif
    return NextResponse.redirect(loginUrl)
  }

  // Token présent → accès autorisé
  return NextResponse.next()
}


```

---

### `lib/api.ts`

```typescript
/**
 * Client interne basé sur fetch, destiné au SSR et aux API Routes.
 *
 * - Fournit un baseURL configurable
 * - Normalise les méthodes GET et POST
 * - Lance une erreur explicite si la réponse n’est pas OK
 */
export function serverApi(baseURL?: string) {
  const root =
    baseURL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    'http://localhost:3000/api' // fallback local

  return {
    /**
     * Requête GET standardisée
     */
    async get(path: string, options?: RequestInit) {
      const res = await fetch(`${root}${path}`, {
        ...options,
        method: 'GET',
      })

      if (!res.ok) {
        throw new Error(`GET ${path} → ${res.status}`)
      }

      return res.json()
    },

    /**
     * Requête POST standardisée
     */
    async post(path: string, body?: any, options?: RequestInit) {
      const res = await fetch(`${root}${path}`, {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        body: JSON.stringify(body ?? {}),
      })

      if (!res.ok) {
        throw new Error(`POST ${path} → ${res.status}`)
      }

      return res.json()
    },
  }
}
```

---

### `lib/auth.ts`

```typescript
'use server'

import { cookies } from 'next/headers'

/**
 * Lecture du token d'accès depuis les cookies.
 * Utilisé dans les pages SSR ou les actions serveur.
 */
export async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value
}

/**
 * Dépôt des tokens côté serveur dans des cookies httpOnly.
 * Ces cookies ne sont jamais accessibles au JavaScript du navigateur.
 */
export async function setTokens({
  access,
  refresh,
}: {
  access: string
  refresh?: string
}) {
  const cookieStore = await cookies()

  // Cookie du token d'accès
  cookieStore.set({
    name: 'access_token',
    value: access,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 heure
  })

  // Cookie du refresh token, si fourni
  if (refresh) {
    cookieStore.set({
      name: 'refresh_token',
      value: refresh,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    })
  }
}

/**
 * Suppression sécurisée des cookies JWT côté serveur.
 */
export async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}
```

---

**À ce stade, l’accès à **`**/dashboard**`** doit être strictement bloqué si aucun token valide n’est présent dans les cookies.**

## Monter l’API Gateway

**1. Utiliser l’App Router pour déclarer les routes API (**`**app/api/**/route.ts**`**).**

Documentation officielle :

[https://nextjs.org/docs/app/building-your-application/routing/route-handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

Les route handlers :

- s’exécutent uniquement côté serveur,
- peuvent manipuler les cookies HTTP via `cookies()` (API stable),
- reçoivent un `Request` standard Web,
- retournent une `Response` Web standard.

---

**2. Créer la route **`**/api/auth-login**`** dans :**

```plain text
app/api/auth-login/route.ts
```

Fonctionnement :

- reçoit `username` + `password`,
- délègue la validation au Auth Service,
- récupère `access_token`, `refresh_token`, `expires_in`,
- dépose les cookies httpOnly,
- renvoie `{ ok: true }`.

---

**3. Créer la route **`**/api/refresh**`** dans :**

```plain text
app/api/refresh/route.ts
```

Fonctionnement :

- lit le `refresh_token` dans les cookies,
- l’envoie au Auth Service,
- reçoit un nouveau `access_token`,
- met à jour ce token dans un cookie httpOnly,
- renvoie `{ ok: true }`.

---

Arborescence obtenue :

```plain text
frontend/
└── app/
    └── api/
        ├── auth-login/
        │   └── route.ts
        └── refresh/
            └── route.ts
```

---

### `app/api/refresh/route.ts`

```typescript
import { cookies } from 'next/headers'

/**
 * Renouvelle le token d'accès à partir du refresh token stocké
 * dans un cookie httpOnly.
 *
 * Utilise l'API cookies() (asynchrone) :
 *   const cookieStore = await cookies()
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()

  // Lecture du refresh_token dans les cookies
  const refresh = cookieStore.get('refresh_token')?.value

  if (!refresh) {
    return Response.json({ detail: 'missing refresh token' }, { status: 401 })
  }

  try {
    // Appel au Auth Service
    const r = await fetch(
      `${process.env.AUTH_SERVICE_URL || 'http://localhost:8000'}/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: refresh }),
      }
    )

    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      return Response.json(
        { detail: err.detail || 'refresh failed' },
        { status: r.status }
      )
    }

    const { access_token } = await r.json()

    // Mise à jour du cookie access_token via cookieStore.set
    cookieStore.set({
      name: 'access_token',
      value: access_token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600, // 1 heure
    })

    return Response.json({ ok: true })
  } catch {
    return Response.json({ detail: 'refresh failed' }, { status: 500 })
  }
}
```

---

`app/api/auth-login/route.ts`

```typescript
import { cookies } from 'next/headers'

/**
 * Authentification initiale.
 * Reçoit username/password, appelle le Auth Service,
 * et écrit access_token + refresh_token via cookies().
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()

  try {
    const body = await request.json()
    const { username, password } = body

    const r = await fetch(
      `${process.env.AUTH_SERVICE_URL || 'http://localhost:8000'}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }
    )

    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      return Response.json(
        { detail: err.detail || 'login failed' },
        { status: r.status }
      )
    }

    const { access_token, refresh_token, expires_in } = await r.json()

    // Dépôt du access_token en httpOnly
    cookieStore.set({
      name: 'access_token',
      value: access_token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: expires_in || 3600, // 1 heure par défaut
    })

    // Dépôt du refresh_token si présent
    if (refresh_token) {
      cookieStore.set({
        name: 'refresh_token',
        value: refresh_token,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 jours
      })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ detail: 'login failed' }, { status: 500 })
  }
}
```

---

- *À ce stade :
- `/api/auth-login` authentifie l’utilisateur, écrit les cookies.
- `/api/refresh` renouvelle l’`access_token`.
- `/dashboard` reste bloqué par le middleware tant que le login n’a pas produit de cookies valides.**

## Gestion des tokens JWT

### Rappel de l’architecture déjà en place

L’architecture de gestion des JWT repose sur plusieurs briques, toutes déjà implémentées :

```plain text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                   # Formulaire de login (public)
│   ├── dashboard/page.tsx         # Page protégée (SSR)
│   └── api/                       # API Gateway interne
│        ├── auth-login/route.ts   # POST → Auth Service (login)
│        └── refresh/route.ts      # POST → Auth Service (refresh)
├── proxy.ts                       # Middleware SSR (contrôle d'accès)
├── lib/
│   ├── api.ts                     # Client interne basé sur fetch
│   └── auth.ts                    # Helpers cookies/JWT (server-only)
└── .env.example
```

---

### Processus complet d’authentification et gestion des JWT

**Connexion initiale (login)**

1. L’utilisateur soumet le formulaire de login via la page :
  `app/page.tsx`
1. Le frontend appelle internalement :
  `POST /api/auth-login`
1. La route `auth-login` :
  - transmet les identifiants au **Auth Service** (`/auth/login`),
  - récupère :
    - `access_token`,
    - `refresh_token`,
    - `expires_in`.
1. Elle dépose ces tokens dans des cookies **httpOnly**, grâce à :

```typescript
const cookieStore = await cookies()
cookieStore.set({ name: 'access_token', value: access_token, ... })
cookieStore.set({ name: 'refresh_token', value: refresh_token, ... })
```

1. Le navigateur est redirigé vers `/dashboard` où l’accès est enfin autorisé.

**Ce token n’est jamais visible ni accessible côté client.**

---

**Protection d’accès (middleware SSR)**

Le middleware `proxy.ts` est appliqué à toutes les routes protégées (`/dashboard/**`).

Rôle :

- lire le cookie `access_token`,
- autoriser l’accès si le token existe,
- sinon rediriger vers `/`.

Extrait :

```typescript
const access = request.cookies.get('access_token')?.value
if (!access) return NextResponse.redirect(...)
```

Il agit ainsi comme un **firewall d’accès** pour toutes les pages SSR protégées.

---

**Lecture du token côté serveur (SSR)**

Toutes les pages Next.js exécutées côté serveur peuvent accéder au token via :

```typescript
import { getAccessToken } from '@/lib/auth'

const access = await getAccessToken()
```

Ce mécanisme permet :

- l’appel direct aux micro-services depuis le backend Next.js,
- sans jamais exposer le token au navigateur.

Il est utilisé dans : *app/dashboard/page.tsx*

---

**Rafraîchissement du token (refresh flow)**

Lorsqu’un service renvoie `401 Unauthorized` :

1. Le frontend appelle la route :
  `POST /api/refresh`
1. Cette route lit le cookie `refresh_token` :

```typescript
const refresh = cookieStore.get('refresh_token')?.value
```

1. Elle contacte ensuite le **Auth Service** (`/auth/refresh`),
1. Elle reçoit un **nouveau access_token**,
1. Elle met à jour le cookie httpOnly :

```typescript
cookieStore.set({ name: 'access_token', value: access_token, ... })
```

1. Le nouvel appel peut être réémis de manière transparente.

**Ce cycle permet des sessions longues, même si les access tokens ont une durée de vie courte.**

---

**Résumé du flux JWT**

Voici une représentation synthétique du processus :

A. Authentification initiale

```plain text
Formulaire (client)
  → POST /api/auth-login (gateway)
      → Auth Service (/auth/login)
          → JWTs (access + refresh)
  → Cookies httpOnly définis
  → Redirection vers /dashboard
```

B. Contrôle d'accès SSR

```plain text
middleware(proxy)
  → lecture access_token
  → autorisation ou redirection
```

C. Appels sécurisés aux micro-services (SSR)

```plain text
Page SSR / server component
  → getAccessToken()
  → serverApi().get('/orders', { Authorization: Bearer ... })
```

D. Rafraîchissement du token

```plain text
401 Unauthorized
  → POST /api/refresh (gateway)
      → Auth Service (/auth/refresh)
          → nouveau access_token
  → mise à jour du cookie httpOnly
  → reprise du flux normal
```

---

## Ouvrir une route /health (sans vérification JWT)

Cette route doit être accessible sans JWT, sans cookie, et sans middleware, afin de servir de point de contrôle pour :

- la supervision locale,
- des probes de conteneurs (readiness / liveness),
- la vérification simple du fonctionnement du serveur Next.js.

---

**1. Créer la route **`**/api/health**`

L’App Router permet de créer des route handlers extrêmement simples.

Ici, aucun cookie n’est lu, aucun token n’est exigé, aucune logique d’authentification n’est appliquée.

Il s’agit d’une route publique.

Arborescence :

```plain text
frontend/
└── app/
    └── api/
        └── health/
            └── route.ts
```

---

**2. Retourner un état minimal et canonique**

La convention la plus répandue dans les architectures distribuées consiste à renvoyer :

- un statut HTTP **200**,
- un corps JSON très simple, ex. `{ status: "ok" }`,
- éventuellement des métadonnées (timestamps, version, environnement).

L'objectif n’est pas d’exposer la configuration interne, mais de fournir un *signal minimal*.

---

**3. Exclure explicitement la route **`**/health**`** du middleware**

Le middleware `proxy.ts` ne doit protéger que certaines routes (comme `/dashboard`).

La configuration actuelle utilise déjà :

```typescript
export const config = {
  matcher: ['/dashboard/:path*'],
}
```

Cela signifie que rien n’est à modifier :

`/api/health` sera automatiquement exclue du proxy.

Il s'agit d’un design souhaité : toutes les routes publiques restent accessibles.

---

### `app/api/health/route.ts`

```typescript
/**
 * Route publique de diagnostic.
 * Ne nécessite aucun token, ne passe par aucun middleware.
 * Renvoie uniquement un statut opérationnel minimal.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'frontend-gateway',
  })
}
```

---

### Résultat attendu

À l’issue de cette étape :

- la route `/api/health` est accessible publiquement,
- aucune authentification n’est requise,
- elle peut être interrogée depuis un navigateur, un script, ou un orchestrateur,
- elle fournit un signal fiable pour confirmer que le service Next.js tourne correctement.

Exemple d'appel :

```bash
curl http://localhost:3000/api/health
```

Réponse :

```json
{
  "status": "ok",
  "timestamp": "2025-01-20T14:12:03.712Z",
  "service": "frontend-gateway"
}
```

## Préparation à la gestion des commandes (orders)

Dans cette étape, nous introduisons trois routes internes :

1. `GET /api/orders` → récupérer la liste des commandes
1. `POST /api/orders` → créer une commande
1. `DELETE /api/orders/:id` → supprimer une commande

Ces routes :

- s’exécutent exclusivement côté serveur,
- utilisent les cookies httpOnly pour récupérer le JWT,
- transmettent le token au Order Service,
- jouent le rôle d’API Gateway.

Aucune UI n’est modifiée ici ; cette étape prépare les endpoints nécessaires pour les TP suivants.

**1. Création de la route **`**/api/orders**`** (GET & POST)**

Cette route sera localisée dans :

```plain text
app/api/orders/route.ts
```

Elle doit :

- lire le `access_token` depuis les cookies,
- contacter le Order Service (`http://localhost:4000/orders`),
- transmettre le token dans l’en-tête Authorization,
- retourner une réponse JSON normalisée.

---

**2. Création de la route **`**/api/orders/[id]**`** (DELETE)**

Cette route sera localisée dans :

```plain text
app/api/orders/[id]/route.ts
```

Elle doit :

- lire l'id dans le paramètre dynamique,
- lire le `access_token`,
- appeler le Order Service via :
  `DELETE http://localhost:4000/orders/:id`,
- renvoyer la réponse standard.

---

Arborescence obtenue :

```plain text
frontend/
└── app/
    └── api/
        ├── orders/
        │   └── route.ts            # GET / POST
        └── orders/
            └── [id]/
                └── route.ts        # DELETE
```

---

### `app/api/orders/route.ts`

(GET — liste / POST — création)

```typescript
import { cookies } from 'next/headers'

/**
 * API Gateway – Orders
 * - GET : récupère les commandes depuis le Order Service
 * - POST : crée une commande
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }

  try {
    const r = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const json = await r.json().catch(() => ({}))
    return Response.json(json, { status: r.status })
  } catch {
    return Response.json({ detail: 'order service unreachable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const r = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    )

    const json = await r.json().catch(() => ({}))
    return Response.json(json, { status: r.status })
  } catch {
    return Response.json({ detail: 'order creation failed' }, { status: 500 })
  }
}


```

---

### `app/api/orders/[id]/route.ts`

(DELETE — suppression)

```typescript
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/orders/[id]
 *
 * Cette route App Router agit comme un *proxy* :
 * → elle reçoit une requête du navigateur
 * → récupère le JWT stocké en cookie (access_token)
 * → transmet la requête au microservice OrderService (NestJS)
 * → renvoie le résultat au frontend
 */
export async function DELETE(req: NextRequest, context: any) {
  /**
   * Extraction du JWT :
   * Les cookies côté Next.js (App Router) sont accessibles via req.cookies.
   * Les cookies httpOnly sont lisibles côté serveur uniquement (sécurisé).
   */
  const access = req.cookies.get('access_token')?.value
  if (!access) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  /**
   * Récupération du paramètre dynamique [id].
   *
   * ⚠️ Dans l’App Router, context.params est désormais ASYNCHRONE.
   * On doit donc utiliser : await context.params
   *
   * Exemple d’URL :
   *   DELETE /api/orders/42
   *   → id = "42"
   */
  const { id } = await context.params

  /**
   * Proxy vers le microservice NestJS :
   *   /orders/:id  (DELETE)
   *
   * Le JWT est transmis dans le header Authorization,
   * conformément au format standard : "Bearer <token>".
   */
  try {
    const response = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${access}`,
        },
      }
    )

    /**
     * On transmet simplement au navigateur :
     * - le body JSON renvoyé par le service Orders
     * - et le même statut HTTP (204, 404, 401, etc.)
     */
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    /**
     * Gestion d'erreurs réseau ou internes.
     * Ici, cela signifie que la communication entre Next.js et
     * OrderService a échoué (service down, mauvaise URL, etc.).
     */
    return NextResponse.json({ detail: 'delete failed' }, { status: 500 })
  }
}
```

---

### Résultat attendu

À la fin de cette étape :

- Le frontend expose une **API Gateway complète pour les commandes** :
  - `GET /api/orders`
  - `POST /api/orders`
  - `DELETE /api/orders/:id`
- La gestion du JWT est entièrement centralisée côté serveur.
- Le middleware protège l’accès à `/dashboard`, mais **les routes API utilisent les cookies directement**.
- Le frontend est maintenant prêt à interagir avec le Order Service du TP suivant.

## Étape 7 — Tester

Les tests se feront de manière simple et progressive, en utilisant :

- un navigateur web,
- la console du navigateur,
- `curl` (ou un outil équivalent),
- les logs de Next.js.

## Vérifier le comportement du middleware

1. Démarrer le frontend :
  ```bash
  npm run dev
  ```
1. Accéder à :
  ```plain text
  http://localhost:3000/dashboard
  ```

Comportement attendu :

- Redirection automatique vers `/` (page de login),
- Ajout dans l’URL de :

```plain text
/?reason=auth-required
```

**Conclusion** : le proxy SSR fonctionne.

---

## Vérifier la route `/api/health`

1. Exécuter dans un terminal :

```bash
curl http://localhost:3000/api/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "frontend-gateway"
}
```

**Conclusion** : Next.js fonctionne, API Router opérationnel.

---

## Tester l’API Gateway sans être connecté

### `GET /api/orders`

```bash
curl -i http://localhost:3000/api/orders
```

Réponse attendue :

```plain text
401 Unauthorized


```

Car aucun cookie `access_token` n’est présent.

---

### `POST /api/orders`

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"product":"demo"}'
```

Réponse attendue :

```plain text
401 Unauthorized
```

**Conclusion** : les routes API sont sécurisées même sans middleware.

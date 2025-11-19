# TP 04 - Order Service (NestJS API + SQLite) - TD

# Partie 1 — Socle Nest.js

## Installation du CLI Nest.js

**Le CLI officiel Nest.js fournit un environnement de développement complet : génération de modules, services, contrôleurs, gestionnaires, pipelines de validation et configuration du projet.**

**L’installation globale permet d’utiliser la commande **`**nest**`** directement en ligne de commande :**

```bash
npm install -g @nestjs/cli
```

**L’outil générera ensuite l’ossature complète du service.**

---

## Création du projet `order-service`

**Nest.js propose une structure modulaire, composées de :**

- un module racine (`app.module.ts`),
- des modules fonctionnels (`orders`, `auth`, `prisma`, etc.),
- un point d’entrée unique (`main.ts`),
- des contrôleurs exposant des routes REST,
- des services encapsulant la logique métier.

**La création du projet se réalise via la commande suivante :**

```bash
nest new order-service
cd order-service
```

L’outil demande de sélectionner un gestionnaire de paquets (`npm`, `yarn` ou `pnpm`).

Une fois la génération achevée, l’arborescence minimale contient :

```plain text
order-service/
├── src/
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── test/
├── package.json
└── tsconfig.json
```

**Cette structure respecte l’architecture modulaire propre à Nest.js et constitue la base à partir de laquelle les futurs modules (Prisma, AuthGuard, Orders) seront construits.**

---

## Premier démarrage du serveur Nest.js

**Nest.js est livré avec un serveur HTTP intégré (Fastify ou Express selon configuration) et un mode développement accompagnant les rechargements automatiques.**

Le serveur peut être démarré immédiatement :

```bash
npm run start:dev
```

Cela lance l’application sur :

```plain text
http://localhost:3000
```

# Partie 2 — Socle Prisma / SQLite

## Installation de Prisma et initialisation du projet ORM

**Prisma nécessite deux composants :**

- une dépendance de développement (`prisma`) contenant le CLI et l’outil de migration,
- la dépendance runtime (`@prisma/client`) générée automatiquement après les migrations.

L’installation s’effectue ainsi :

```bash
npm install -D prisma
npm install @prisma/client
npx prisma init
```

**Le dossier **`**prisma/**`** est alors créé**, contenant le fichier de définition du schéma :

```plain text
prisma.config.ts
prisma/
  schema.prisma
.env
```

### `prisma.config.ts`

Il nous faut ajouter: `import "dotenv/config";`

```dart
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

L’environnement local (`.env`) est automatiquement configuré avec une URL SQLite par défaut, qu’il faut modifier avec celui-ci :

### `.env`

```plain text
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-me"
PORT=4000
```

---

## Définition du schéma Prisma pour les commandes

**Le fichier **`**schema.prisma**`** formalise la structure de la base : types, contraintes, relations, index et options de persistance.**

Dans le cadre du service de commandes, le modèle retenu est minimal, volontairement simple et non relationnel :

### `**schema.prisma**`

```plain text
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Order {
  id        Int      @id @default(autoincrement())   // Identifiant unique
  user      String                                 // Identifiant utilisateur (extrait du JWT)
  item      String                                 // Nom du produit / SKU
  createdAt DateTime @default(now())                // Horodatage automatique
}
```

**Caractéristiques importantes du modèle :**

- `@id @default(autoincrement())` : gestion automatique de la clé primaire,
- `createdAt @default(now())` : timestamp généré côté base,
- stockage de l’utilisateur par son identifiant (`sub` du JWT),
- absence de relations : isolation stricte par micro-service.

Ce schéma est cohérent avec les bonnes pratiques des architectures distribuées, dans lesquelles chaque service reste autonome et propriétaire de son modèle de données.

**Ajout du service Prisma dans Nest**

Prisma doit être encapsulé dans un service Nest pour être injectable dans les modules.

### `src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service global pour gérer la connexion Prisma (ORM SQLite)
 * - Initialise et connecte Prisma au démarrage
 * - Fournit PrismaClient à l'ensemble des modules Nest
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

➡️ Ce service sera ensuite injecté dans le module `OrdersModule`.

---

## Création de la base et génération du client Prisma

**Lancer la génération de la base de données:**

```dart
npx prisma generate
```

---

**Prisma applique la définition du schéma via un système de migrations versionnées**, permettant de maintenir un historique des changements.

**Lancer la première migration :**

```bash
npx prisma migrate dev --name init
```

Ces commande :

- crée physiquement le fichier `dev.db` dans `prisma/`,
- génère une migration SQL stockée dans `prisma/migrations/`,
- compile et génère le client TypeScript dans `node_modules/@prisma/client`.

Il devient alors possible d’explorer la base, par exemple via :

```bash
npx prisma studio
```

Prisma Studio fournit une interface graphique interactive permettant d’inspecter le contenu de la table `Order` et de vérifier la cohérence du schéma.

# Partie 3 — Sécurité (JWT)

L’objectif : empêcher tout accès sans token valide et attacher automatiquement l’utilisateur connecté (`sub`) aux requêtes.

---

## Installation des dépendances JWT

**NestJS n’a pas besoin d’une grosse surcouche pour ce TP.**

On utilise directement **jsonwebtoken**, identique à FastAPI côté Python.

```bash
npm install jsonwebtoken
```

---

## Guard d’authentification JWT

**Le guard vérifie :**

- la présence d’un header `Authorization: Bearer <token>`
- la validité du token (signature + expiration)
- le payload décodé (`sub`, `exp`, …)
- stocke `req.user = payload` pour les contrôleurs

### `src/auth/jwt-auth.guard.ts `

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Vérifie la présence et la validité du token JWT.
 * Le token est signé par auth-service FastAPI avec un secret partagé.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];

    if (!auth || !auth.startsWith('Bearer '))
      throw new UnauthorizedException('Missing or malformed token');

    const token = auth.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'change-me';

    try {
      // Vérifie signature + expiration
      const payload = jwt.verify(token, secret);

      // Injecte le payload dans la requête
      (req as any).user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}


```

---

## Décorateur @User() pour extraire le payload

Ce décorateur permet :

- de récupérer le contenu du JWT dans les contrôleurs
- sans répéter le code dans chaque handler

`src/auth/user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Expose req.user dans les méthodes des contrôleurs.
 * Usage :  create(@User() user)
 */
export const User = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
```

---

À partir de maintenant :

- toute route Nest protégée par `@UseGuards(JwtAuthGuard)`
- les contrôles d’accès sont garantis
- l’isolation des données par utilisateur devient possible

---

# Partie 4 — Module Order

Cette partie construit l’ensemble du **CRUD Order** :

- génération du module,
- DTO pour la validation,
- service métier,
- contrôleur REST,
- câblage avec Prisma,
- protection JWT.

Structure obtenue :

```plain text
src/
 └── orders/
      ├── orders.module.ts
      ├── orders.controller.ts
      ├── orders.service.ts
      └── dto/
           └── create-order.dto.ts
```

---

## Génération du module + controller + service

```bash
nest g module orders
nest g controller orders
nest g service orders
```

Ces commandes créent les fichiers de base sans logique.

---

## DTO de création d’une commande

Ce DTO valide la donnée envoyée par le client.

Ici : un simple champ `item` obligatoire.

### `src/orders/dto/create-order.dto.ts`

```dart
npm install class-validator
```

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Schéma d'entrée pour créer une commande.
 */
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  item: string;
}
```

---

## Service Orders (logique métier)

Le service interagit avec Prisma et applique l’isolation par utilisateur :

- `create()` associe le `user.sub` issu du JWT
- `findAll()` liste uniquement les commandes du user
- `findOne()` retourne une commande du user
- `remove()` supprime uniquement si la commande lui appartient

### `src/orders/orders.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * Service métier pour la gestion des commandes.
 */
@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  create(user: string, data: CreateOrderDto) {
    return this.prisma.order.create({
      data: { user, item: data.item },
    });
  }

  findAll(user: string) {
    return this.prisma.order.findMany({
      where: { user },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number, user: string) {
    return this.prisma.order.findFirst({
      where: { id, user },
    });
  }

  remove(id: number, user: string) {
    return this.prisma.order.deleteMany({
      where: { id, user },
    });
  }
}


```

---

## Contrôleur Orders (REST API)

Toutes les routes sont protégées par JWT grâce à :

```typescript
@UseGuards(JwtAuthGuard)
```

Le décorateur :

```typescript
@User()
```

permet de récupérer automatiquement `user.sub` dans le payload JWT.

### `src/orders/orders.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../auth/user.decorator';

/**
 * Contrôleur REST pour les commandes utilisateur.
 * Toutes les routes nécessitent un JWT valide.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@User() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Get()
  findAll(@User() user: any) {
    return this.ordersService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersService.findOne(id, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersService.remove(id, user.sub);
  }
}


```

---

## Module Orders

Le module rassemble controller + service

et fournit PrismaService localement au module.

### `src/orders/orders.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class OrdersModule {}
```

---

## Résultat

À la fin de cette partie, l’API Order expose :

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| POST | `/orders` | Créer une commande | ✔ JWT |
| GET | `/orders` | Lister les commandes | ✔ JWT |
| GET | `/orders/:id` | Voir une commande | ✔ JWT |
| DELETE | `/orders/:id` | Supprimer une commande | ✔ JWT |

Les commandes sont **propres à chaque utilisateur** (filtrage par `user=sub` dans Prisma).

# Partie 5 — Module principal et bootstrap

## Déclaration du module principal

**Le module principal assemble tous les modules fonctionnels du service.
Ici, il importe le module **`**OrdersModule**`** et enregistre le **`**PrismaService**`** comme provider global.**

```dart
npm install class-transformer
```

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [OrdersModule],        // Chargement du module Orders
  providers: [PrismaService],     // Service Prisma exposé à toute l'app
})
export class AppModule {}
```

---

## Bootstrap NestJS

**Le fichier **`**main.ts**`** initialise l’application, active la validation automatique des DTO, configure CORS et démarre le serveur HTTP.
CORS est activé pour permettre l’accès depuis le frontend (Next.js).**

### `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Instanciation de l'application Nest
  const app = await NestFactory.create(AppModule);

  // Validation globale (DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,      // Retire les champs non attendus
      forbidNonWhitelisted: false,
    }),
  );

  // Activation CORS (nécessaire pour les appels front)
  app.enableCors({
    origin: true,          // Accepte l'origine envoyée par le client
    credentials: true,     // Autorise cookies / headers
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 Order Service running at http://localhost:${port}`);
}

bootstrap();
```

---

# Partie 6 — Ouverture route `/health`

## Ajouter une route publique de vérification

**La route **`**/health**`** permet de vérifier que le service fonctionne sans nécessiter d’authentification.
Elle renvoie un simple objet JSON indiquant l’état du service.**

### `src/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'order-service',
      timestamp: new Date().toISOString(),
    };
  }
}
```

---

## Déclarer le HealthController dans l'app

**Le contrôleur doit être ajouté au module principal pour être exposé.**

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health.controller';

@Module({
  imports: [OrdersModule],
  providers: [PrismaService],
  controllers: [HealthController],   // Ajout du contrôleur health
})
export class AppModule {}


```

---

## Vérifier l’accès à la route

Une fois le serveur démarré :

```bash
curl http://localhost:4000/health
```

Résultat attendu :

```json
{
  "status": "ok",
  "service": "order-service",
  "timestamp": "2025-11-14T12:00:00.000Z"
}
```

# Partie 7 — Tests complets

**Cette étape permet de valider l’ensemble du service :
JWT → OrderService → SQLite → CRUD complet.**

Tous les tests se font en local avec `curl`.

---

## Lancer le serveur NestJS

Depuis `order-service/` :

```bash
npm run start:dev
```

👉 Le service doit annoncer :

```plain text
OrderService running at http://localhost:4000
```

---

## Récupérer un JWT via AuthService

Depuis le service d’authentification (FastAPI) déjà opérationnel :

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

Résultat attendu (exemple) :

```json
{
  "access_token": "<TOKEN>",
  "refresh_token": "<TOKEN>",
  "token_type": "bearer",
  "expires_in": 3600
}
```

➡️ **Copier **`**access_token**` : toutes les requêtes NestJS en dépendent.

---

## Créer une commande

```bash
curl -X POST http://localhost:4000/orders \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"item": "keyboard-200"}'

// Exemple:

curl -X POST http://localhost:4000/orders \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc2MzE2ODc5NSwidHlwZSI6ImFjY2VzcyJ9.EWmpwTFURljBXi9f-fbBk3BDI1_PznCrzt_JUcU6HQ4" \
  -H "Content-Type: application/json" \
  -d '{"item": "keyboard-200"}'

```

Résultat attendu :

```json
{
  "id": 1,
  "user": "admin",
  "item": "keyboard-200",
  "createdAt": "2025-11-14T12:45:00.000Z"
}

```

---

## Lister toutes les commandes de l’utilisateur connecté

```bash
curl http://localhost:4000/orders \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

```

➡️ **Seulement les commandes associées au **`**sub**`** du JWT doivent apparaître.**

---

## Récupérer une commande spécifique

```bash
curl http://localhost:4000/orders/1 \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Supprimer une commande

```bash
curl -X DELETE http://localhost:4000/orders/1 \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Vérification route `/health` (publique)

```bash
curl http://localhost:4000/health
```

Résultat :

```json
{
  "status": "ok",
  "service": "order-service",
  "timestamp": "2025-11-14T12:50:00.000Z"
}
```

---

## Vérification du stockage local SQLite

Ouvrir Prisma Studio :

```bash
npx prisma studio
```

Ou un viewer SQLite :

- VS Code + SQLite Viewer
- DBeaver
- TablePlus

Tables visibles :

- `Order` avec colonnes : `id`, `user`, `item`, `createdAt`

---

## Mise à jour du Dashboard pour interagir avec le Order Service

**Le Dashboard devient interactif : il liste, crée et supprime des commandes en appelant les API Routes Next.js (**`**/api/orders**`** et **`**/api/orders/[id]**`**).
Les API Routes ajoutent automatiquement le header **`**Authorization: Bearer <access_token>**`** extrait du cookie httpOnly.
L’utilisateur connecté visualise donc uniquement ses propres commandes (logique d’isolation appliquée dans le Order Service).**

---

## Nouveau Dashboard — `app/dashboard/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: number
  user: string
  item: string
  createdAt: string
}

/**
 * Dashboard utilisateur interactif :
 * - récupère les commandes
 * - permet de créer une commande
 * - permet de supprimer une commande
 */
export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Charger les commandes de l'utilisateur
  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setOrders(data)
      setLoading(false)
    } catch {
      setError('Impossible de charger les commandes')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Créer une commande
  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    setCreating(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: newItem }),
    })
    setCreating(false)

    if (res.ok) {
      setNewItem('')
      loadOrders()
    } else {
      alert('Erreur lors de la création')
    }
  }

  // Supprimer une commande
  const deleteOrder = async (id: number) => {
    if (!confirm('Supprimer cette commande ?')) return

    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    if (res.ok) loadOrders()
    else alert('Erreur de suppression')
  }

  if (loading) return <p className="p-6 text-gray-600">Chargement…</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>

  return (
    <main className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold mb-6">📦 Mes commandes</h1>

      {/* Formulaire de création */}
      <form onSubmit={createOrder} className="flex items-center gap-2 mb-8">
        <input type="text"
          placeholder="Nom du produit…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit"
          disabled={creating}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <p className="text-gray-500">Aucune commande pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}
              className="flex justify-between items-center border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-800">{o.item}</p>
                <p className="text-sm text-gray-500">
                  Commandé le {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => deleteOrder(o.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

---

## Résultat attendu

Sur `/dashboard` :

- La liste des commandes se charge automatiquement via `/api/orders`.
- Le champ d’ajout permet de créer une commande liée au user (`sub`).
- Chaque ligne possède un bouton “Supprimer”.
- Tout est sécurisé :
  - cookies httpOnly → Next.js lit le JWT côté serveur ;
  - API Routes insèrent `Authorization: Bearer …`;
  - Order Service applique `JwtAuthGuard`.

---

# Provider States Reference

Provider states allow you to set up preconditions on the provider before verifying an interaction.

## How It Works

1. **Consumer** declares a state with `.given('state description')`
2. **Provider** implements a `stateHandler` that matches the exact string
3. Before each interaction, Pact calls the matching handler to seed/configure data
4. After verification, optional teardown cleans up

## State Handlers (JavaScript)

### Basic setup

```typescript
import { Verifier } from '@pact-foundation/pact';

const verifier = new Verifier({
  providerBaseUrl: 'http://localhost:4000',
  pactUrls: ['./pacts/consumer-provider.json'],

  stateHandlers: {
    'user admin exists': async () => {
      await db.user.create({
        data: { username: 'admin', password: hashSync('admin', 10) },
      });
    },

    'user has 3 orders': async () => {
      const user = await db.user.create({
        data: { username: 'testuser', password: hashSync('pass', 10) },
      });
      await db.order.createMany({
        data: [
          { userId: user.id, bookId: 'OL1W', status: 'pending' },
          { userId: user.id, bookId: 'OL2W', status: 'completed' },
          { userId: user.id, bookId: 'OL3W', status: 'pending' },
        ],
      });
    },

    'no orders exist': async () => {
      await db.order.deleteMany({});
    },
  },
});
```

### With setup AND teardown

```typescript
stateHandlers: {
  'user admin exists': {
    setup: async () => {
      await db.user.create({
        data: { username: 'admin', password: hashSync('admin', 10) },
      });
    },
    teardown: async () => {
      await db.user.deleteMany({ where: { username: 'admin' } });
    },
  },
},
```

### With parameters (V3+)

Consumer:
```typescript
provider
  .given('user exists', { userId: '123', username: 'admin' })
  .uponReceiving('a request for user profile')
  // ...
```

Provider:
```typescript
stateHandlers: {
  'user exists': async (params) => {
    await db.user.create({
      data: {
        id: params.userId,
        username: params.username,
        password: hashSync('password', 10),
      },
    });
  },
},
```

## State Handler via HTTP Endpoint (Python / FastAPI)

When using the Verifier with `providerStatesSetupUrl`, Pact sends a POST request to your app.

```python
# FastAPI provider state endpoint
from fastapi import FastAPI, Request
from app.database import get_db

app = FastAPI()

@app.post("/_pact/states")
async def provider_states(request: Request):
    body = await request.json()
    state = body.get("state")
    action = body.get("action")  # "setup" or "teardown"

    db = get_db()

    if action == "setup":
        if state == "user admin exists":
            db.execute(
                "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
                ("admin", hash_password("admin")),
            )
        elif state == "no users exist":
            db.execute("DELETE FROM users")
        db.commit()

    elif action == "teardown":
        db.execute("DELETE FROM users WHERE username = 'admin'")
        db.commit()

    return {"status": "ok"}
```

Provider verification:
```python
verifier = Verifier(
    provider='auth-service',
    provider_base_url='http://localhost:8000',
)
verifier.verify_pacts(
    './pacts/frontend-auth-service.json',
    provider_states_setup_url='http://localhost:8000/_pact/states',
)
```

## NestJS Provider States with Prisma

```typescript
// test/pact/state-handlers.ts
import { PrismaService } from '../src/prisma/prisma.service';

export function createStateHandlers(prisma: PrismaService) {
  return {
    'user has books': async () => {
      // Clean slate
      await prisma.book.deleteMany();
      await prisma.user.deleteMany();

      // Seed
      const user = await prisma.user.create({
        data: { id: 1, username: 'testuser' },
      });
      await prisma.book.createMany({
        data: [
          { userId: user.id, workId: '/works/OL1W', status: 'to-read' },
          { userId: user.id, workId: '/works/OL2W', status: 'reading' },
        ],
      });
    },

    'no books exist': async () => {
      await prisma.book.deleteMany();
    },
  };
}

// test/pact/provider.pact.spec.ts
import { Verifier } from '@pact-foundation/pact';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createStateHandlers } from './state-handlers';

describe('Provider verification', () => {
  let app;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies contracts', async () => {
    const port = app.getHttpServer().address().port;
    await new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: ['./pacts/frontend-book-service.json'],
      stateHandlers: createStateHandlers(prisma),
    }).verifyProvider();
  });
});
```

## Best Practices

- **State names are contracts** — changing a state name is a breaking change. Agree on naming conventions
- **Keep states minimal** — seed only what the interaction needs, nothing more
- **Clean before seeding** — always delete then insert, don't assume empty DB
- **Use descriptive names** — `user with 3 pending orders` > `some data`
- **Group related states** — if multiple interactions need the same state, reuse the exact string
- **Teardown is optional but recommended** — especially for shared test databases
- **Never use production data** — always create synthetic test data

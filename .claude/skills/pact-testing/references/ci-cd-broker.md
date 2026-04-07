# CI/CD & Pact Broker Reference

## Pact Broker

The Pact Broker is a central repository for pact contracts. It enables:
- Sharing pacts between consumer and provider CI pipelines
- Versioning contracts by git commit/branch
- `can-i-deploy` safety checks before deployment
- Webhooks to trigger provider verification when a new pact is published

### Self-hosted vs PactFlow

| | Self-hosted | PactFlow (SaaS) |
|---|---|---|
| Setup | Docker image `pactfoundation/pact-broker` | Managed |
| Auth | Basic auth / reverse proxy | Token-based |
| Features | Core broker | + Bi-directional, OAS support |
| Cost | Free (infra cost) | Free tier + paid |

### Docker Compose (self-hosted)

```yaml
services:
  pact-broker:
    image: pactfoundation/pact-broker:latest
    ports:
      - "9292:9292"
    environment:
      PACT_BROKER_DATABASE_URL: sqlite:////tmp/pact_broker.sqlite
      PACT_BROKER_BASIC_AUTH_USERNAME: pact
      PACT_BROKER_BASIC_AUTH_PASSWORD: pact
```

## Publishing Pacts

After consumer tests pass, publish the generated pact files.

### CLI

```bash
npx pact-broker publish ./pacts \
  --consumer-app-version=$(git rev-parse HEAD) \
  --branch=$(git branch --show-current) \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN
```

### Programmatic (in test)

```typescript
import { Publisher } from '@pact-foundation/pact';

new Publisher({
  pactFilesOrDirs: ['./pacts'],
  pactBroker: process.env.PACT_BROKER_URL,
  pactBrokerToken: process.env.PACT_BROKER_TOKEN,
  consumerVersion: process.env.CI_COMMIT_SHA,
  branch: process.env.CI_COMMIT_BRANCH,
}).publishPacts();
```

## Provider Verification from Broker

```typescript
const verifier = new Verifier({
  providerBaseUrl: 'http://localhost:4000',
  provider: 'book-service',

  // Fetch pacts from broker
  pactBrokerUrl: process.env.PACT_BROKER_URL,
  pactBrokerToken: process.env.PACT_BROKER_TOKEN,

  // Which consumer versions to verify against
  consumerVersionSelectors: [
    { mainBranch: true },           // Latest from main
    { deployedOrReleased: true },   // Currently deployed versions
    { branch: 'develop' },          // Latest from develop
  ],

  // Publish results back to broker
  publishVerificationResult: process.env.CI === 'true',
  providerVersion: process.env.CI_COMMIT_SHA,
  providerVersionBranch: process.env.CI_COMMIT_BRANCH,

  stateHandlers: { /* ... */ },
});
```

### Consumer Version Selectors

| Selector | Purpose |
|----------|---------|
| `{ mainBranch: true }` | Latest pact from the main branch |
| `{ deployedOrReleased: true }` | All currently deployed/released versions |
| `{ branch: 'feature/x' }` | Latest from a specific branch |
| `{ latest: true, tag: 'production' }` | Latest with a specific tag |
| `{ consumer: 'frontend', latest: true }` | Latest from a specific consumer |

## Can I Deploy?

The safety gate: checks if this version is compatible with everything in the target environment.

### CLI

```bash
# Before deploying a consumer
npx pact-broker can-i-deploy \
  --pacticipant=frontend \
  --version=$(git rev-parse HEAD) \
  --to-environment=production \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN

# Before deploying a provider
npx pact-broker can-i-deploy \
  --pacticipant=book-service \
  --version=$(git rev-parse HEAD) \
  --to-environment=production \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Safe to deploy |
| 1 | Not safe — incompatible contracts |

### Record deployment

After successful deploy, record it so future `can-i-deploy` checks are accurate:

```bash
npx pact-broker record-deployment \
  --pacticipant=book-service \
  --version=$(git rev-parse HEAD) \
  --environment=production \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN
```

## GitLab CI/CD Integration

```yaml
variables:
  PACT_BROKER_URL: $PACT_BROKER_URL
  PACT_BROKER_TOKEN: $PACT_BROKER_TOKEN

stages:
  - test
  - pact
  - deploy

# --- Consumer pipeline ---

test:consumer:
  stage: test
  script:
    - cd frontend
    - npm ci
    - npm run test:pact:consumer
  artifacts:
    paths:
      - frontend/pacts/

publish:pacts:
  stage: pact
  needs: [test:consumer]
  script:
    - npx pact-broker publish frontend/pacts
        --consumer-app-version=$CI_COMMIT_SHA
        --branch=$CI_COMMIT_BRANCH
        --broker-base-url=$PACT_BROKER_URL
        --broker-token=$PACT_BROKER_TOKEN
  rules:
    - if: $CI_COMMIT_BRANCH

can-i-deploy:consumer:
  stage: deploy
  needs: [publish:pacts]
  script:
    - npx pact-broker can-i-deploy
        --pacticipant=frontend
        --version=$CI_COMMIT_SHA
        --to-environment=production
        --broker-base-url=$PACT_BROKER_URL
        --broker-token=$PACT_BROKER_TOKEN
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# --- Provider pipeline ---

verify:provider:
  stage: pact
  script:
    - cd book-service
    - npm ci
    - npm run test:pact:provider
  variables:
    GIT_COMMIT: $CI_COMMIT_SHA
    GIT_BRANCH: $CI_COMMIT_BRANCH
    CI: "true"

can-i-deploy:provider:
  stage: deploy
  needs: [verify:provider]
  script:
    - npx pact-broker can-i-deploy
        --pacticipant=book-service
        --version=$CI_COMMIT_SHA
        --to-environment=production
        --broker-base-url=$PACT_BROKER_URL
        --broker-token=$PACT_BROKER_TOKEN
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

## Webhooks

Trigger provider verification automatically when a consumer publishes a new pact.

```bash
npx pact-broker create-webhook \
  'https://gitlab.com/api/v4/projects/PROJECT_ID/trigger/pipeline' \
  --request=POST \
  --header='Content-Type: application/json' \
  --data='{"ref":"main","token":"TRIGGER_TOKEN","variables[PACT_CONSUMER_BRANCH]":"${pactbroker.consumerVersionBranch}"}' \
  --provider=book-service \
  --contract-content-changed \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PACT_BROKER_URL` | Broker base URL |
| `PACT_BROKER_TOKEN` | Authentication token |
| `PACT_BROKER_USERNAME` | Basic auth username (alternative) |
| `PACT_BROKER_PASSWORD` | Basic auth password (alternative) |
| `CI_COMMIT_SHA` | Git commit hash (consumer/provider version) |
| `CI_COMMIT_BRANCH` | Git branch name |

## Best Practices

- **Publish on every consumer CI run** — not just main, so branches can be verified
- **Always use `can-i-deploy`** — it's the whole point of contract testing in CI
- **Record deployments** — keeps the broker's environment model accurate
- **Use `consumerVersionSelectors`** — not `pactUrls` — for provider verification from broker
- **Set `publishVerificationResult: true` only in CI** — not locally
- **Webhook triggers** — automate provider verification on new pact publication

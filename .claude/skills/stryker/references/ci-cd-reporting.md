# CI/CD & Reporting Reference

## Reporters

### Clear-text (console)

```javascript
reporters: ['clear-text'],
```

Output:
```
All files
  Mutation score: 82.35%
  Mutants:
    Killed:      56
    Survived:    8
    NoCoverage:  4
    Timeout:     2
    CompileError: 5

src/order/order.service.ts
  Mutation score: 75.00%
  Survived:
    [Line 42] ArithmeticOperator: a + b → a - b
    [Line 58] EqualityOperator: x === 0 → x !== 0
```

### HTML report

```javascript
reporters: ['html'],
htmlReporter: {
  fileName: 'reports/mutation/mutation.html',
},
```

Interactive file: click into each source file, see inline diffs color-coded by status.

### JSON report

```javascript
reporters: ['json'],
jsonReporter: {
  fileName: 'reports/mutation/mutation.json',
},
```

Useful for programmatic processing in CI scripts.

### Dashboard (stryker-mutator.io)

```javascript
reporters: ['dashboard'],
dashboard: {
  project: 'gitlab.com/loulou.scarfone/microservices',
  version: process.env.CI_COMMIT_BRANCH || 'main',
  module: 'order-service',
  baseUrl: 'https://dashboard.stryker-mutator.io/api/reports',
},
```

Requires `STRYKER_DASHBOARD_API_KEY` set as CI variable.

---

## GitLab CI/CD Integration

### Per-service mutation testing

```yaml
variables:
  NODE_OPTIONS: "--max-old-space-size=4096"

# --- Order Service ---
mutation:order:
  stage: test
  image: node:20-slim
  before_script:
    - cd order-service
    - npm ci
  script:
    - npx stryker run
  artifacts:
    paths:
      - order-service/reports/mutation.html
    when: always
  cache:
    key: stryker-order-$CI_PROJECT_ID
    paths:
      - order-service/reports/stryker-incremental.json
  rules:
    - if: $CI_MERGE_REQUEST_IID
      changes:
        - order-service/src/**/*.ts

# --- Book Service ---
mutation:book:
  stage: test
  image: node:20-slim
  before_script:
    - cd book-service
    - npm ci
  script:
    - npx stryker run
  artifacts:
    paths:
      - book-service/reports/mutation.html
    when: always
  cache:
    key: stryker-book-$CI_PROJECT_ID
    paths:
      - book-service/reports/stryker-incremental.json
  rules:
    - if: $CI_MERGE_REQUEST_IID
      changes:
        - book-service/src/**/*.ts
```

### With quality gate (`break` threshold)

```javascript
// stryker.config.mjs
export default {
  // ...
  thresholds: {
    high: 80,
    low: 60,
    break: 70,  // Pipeline fails if score < 70%
  },
};
```

Stryker exits with code 1 if the score is below `break`. GitLab CI detects this as a failure.

### Scheduled full run (nightly)

```yaml
mutation:full:
  stage: test
  image: node:20-slim
  parallel:
    matrix:
      - SERVICE: [order-service, book-service]
  before_script:
    - cd $SERVICE
    - npm ci
  script:
    - npx stryker run --incremental false  # Force full run
  artifacts:
    paths:
      - $SERVICE/reports/mutation.html
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

### MR-scoped (mutate only changed files)

StrykerJS doesn't have a built-in git-diff filter like Cosmic Ray, but you can dynamically build the `mutate` glob:

```yaml
mutation:mr:
  stage: test
  script:
    - cd order-service
    - npm ci
    # Get changed TS files in this MR
    - |
      CHANGED=$(git diff --name-only origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME...HEAD \
        -- 'src/**/*.ts' ':!src/**/*.spec.ts' | tr '\n' ',' | sed 's/,$//')
    - |
      if [ -z "$CHANGED" ]; then
        echo "No source files changed, skipping mutation testing"
        exit 0
      fi
    - echo "Mutating changed files: $CHANGED"
    - npx stryker run --mutate "$CHANGED"
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

---

## Incremental Mode in CI

### Setup

```javascript
// stryker.config.mjs
export default {
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};
```

### GitLab cache

```yaml
mutation:service:
  cache:
    key: stryker-${SERVICE}-$CI_PROJECT_ID
    paths:
      - ${SERVICE}/reports/stryker-incremental.json
    policy: pull-push
```

### First run vs subsequent runs

| Run | Behavior | Time |
|-----|----------|------|
| First (no cache) | Full mutation testing | ~5-30 min |
| Subsequent (cache hit) | Only re-tests changed mutants | ~30s-5 min |

---

## Parsing JSON Report Programmatically

```javascript
// scripts/mutation-gate.mjs
import { readFileSync } from 'fs';

const report = JSON.parse(readFileSync('reports/mutation/mutation.json', 'utf-8'));

const files = report.files;
let killed = 0, survived = 0, noCoverage = 0, timeout = 0;

for (const [filePath, fileData] of Object.entries(files)) {
  for (const mutant of fileData.mutants) {
    switch (mutant.status) {
      case 'Killed': killed++; break;
      case 'Survived': survived++; break;
      case 'NoCoverage': noCoverage++; break;
      case 'Timeout': timeout++; break;
    }
  }
}

const total = killed + survived + noCoverage;
const score = total > 0 ? (killed / total * 100) : 100;

console.log(`Mutation score: ${score.toFixed(1)}%`);
console.log(`Killed: ${killed}, Survived: ${survived}, NoCoverage: ${noCoverage}, Timeout: ${timeout}`);

if (score < 70) {
  console.error('FAIL: Mutation score below 70% threshold');
  process.exit(1);
}
```

```yaml
# In GitLab CI
script:
  - npx stryker run
  - node scripts/mutation-gate.mjs
```

---

## Combining with Coverage

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:mutation": "stryker run"
  }
}
```

| Metric | Question It Answers |
|--------|-------------------|
| Line coverage | Was this code executed during tests? |
| Branch coverage | Were both branches of `if` hit? |
| **Mutation score** | Would the tests fail if this code was wrong? |

Coverage tells you **what ran**. Mutation testing tells you **what was tested**.

A file can have 100% line coverage and 50% mutation score — meaning the tests execute the code but don't actually verify its behavior.

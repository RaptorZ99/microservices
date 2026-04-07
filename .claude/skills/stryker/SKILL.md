---
name: stryker
description: "Mutation testing for JavaScript/TypeScript with StrykerJS: configuration, mutators, reporters, incremental mode, Jest/NestJS integration, disabling mutants, thresholds, dashboard, CI/CD, and surviving mutant analysis."
globs: "**/*stryker*,**/*.conf.mjs,**/*.spec.ts,**/*.test.ts"
alwaysApply: false
---

# StrykerJS — Mutation Testing for JavaScript & TypeScript

StrykerJS introduces small changes (mutants) into your source code and runs the test suite for each. If a test fails, the mutant is **killed** (good). If all tests pass, the mutant **survived** (bad — your tests missed something).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Configuration](#configuration)
4. [Mutators](#mutators)
5. [Reporters](#reporters)
6. [Disabling Mutants](#disabling-mutants)
7. [Incremental Mode](#incremental-mode)
8. [NestJS Integration](#nestjs-integration)
9. [Thresholds & Quality Gates](#thresholds--quality-gates)
10. [CI/CD Integration](#cicd-integration)
11. [Surviving Mutant Analysis](#surviving-mutant-analysis)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Troubleshooting](#troubleshooting)

## Modules

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Mutators reference | `references/mutators.md` | Understanding mutation types, filtering, killing strategies |
| CI/CD & reporting | `references/ci-cd-reporting.md` | Pipeline integration, dashboard, quality gates, incremental |

---

## Quick Start

### Install

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/typescript-checker
```

### Init (interactive wizard)

```bash
npx stryker init
```

### Minimal config (`stryker.config.mjs`)

```javascript
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.module.ts',
  ],
  testRunner: 'jest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['progress', 'clear-text', 'html'],
  thresholds: { high: 80, low: 60, break: 0 },
  concurrency: 4,
};
```

### Run

```bash
npx stryker run

# With specific config
npx stryker run stryker.config.mjs
```

---

## Core Concepts

### Mutant States

| State | Meaning | Quality Signal |
|-------|---------|----------------|
| **Killed** | At least one test failed for this mutant | Good — tests are effective |
| **Survived** | All tests passed despite the mutation | Bad — test gap detected |
| **NoCoverage** | No test covers the mutated code | Bad — untested code |
| **Timeout** | Test run exceeded timeout | Likely killed (slow test) |
| **CompileError** | Mutant caused a compile/type error | Neutral — filtered by checker |
| **RuntimeError** | Mutant caused a runtime crash | Neutral |
| **Ignored** | Excluded by config or comment | Neutral |

### Mutation Score

```
mutation_score = killed / (killed + survived + noCoverage)
```

- **> 80%** — solid test suite
- **> 90%** — excellent
- **< 60%** — significant test gaps

### How StrykerJS Works

1. **Instrument** — Stryker inserts all mutations into the code at once (code instrumentation)
2. **Dry run** — Runs the full test suite to measure coverage per test
3. **Mutation testing** — For each mutant, activates it and runs only covering tests
4. **Report** — Generates results with score, survivors, and diffs

This is much faster than running the full suite per mutant (like older tools do).

---

## Configuration

### Full `stryker.config.mjs` reference

```javascript
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // Files to mutate (glob patterns, ! = exclude)
  mutate: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],

  // Test runner: 'jest' | 'karma' | 'vitest' | 'tap' | 'command'
  testRunner: 'jest',

  // Jest-specific config
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.ts',
    enableFindRelatedTests: true,  // Speed: only run tests related to mutated file
  },

  // Type checker: prevents type-error mutants from running
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  // Disable type checks for files where Stryker's instrumentation causes issues
  disableTypeChecks: 'src/**/*.{js,ts,jsx,tsx}',

  // Mutator config
  mutator: {
    // Exclude specific mutation types globally
    excludedMutations: [
      // 'StringLiteral',   // Uncomment to skip string mutations
      // 'ObjectLiteral',   // Uncomment to skip object mutations
    ],
  },

  // Reporters
  reporters: ['progress', 'clear-text', 'html', 'json'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },

  // Score thresholds
  thresholds: {
    high: 80,    // Green
    low: 60,     // Yellow/Orange
    break: 0,    // Exit code 1 if score below this (0 = disabled)
  },

  // Performance
  concurrency: 4,            // Parallel test workers
  timeoutMS: 60000,          // Timeout per mutant (ms)
  timeoutFactor: 1.5,        // Timeout multiplier over initial test run

  // Incremental mode (reuse previous results)
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',

  // Temp directory for instrumented files
  tempDirName: '.stryker-tmp',

  // Log level: 'off' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  logLevel: 'info',
};
```

### JSON config alternative (`stryker.conf.json`)

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "mutate": ["src/**/*.ts", "!src/**/*.spec.ts"],
  "testRunner": "jest",
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "reporters": ["progress", "clear-text", "html"],
  "thresholds": { "high": 80, "low": 60, "break": 0 }
}
```

The `$schema` key enables autocompletion in IDEs.

---

## Mutators

StrykerJS ships with these mutator categories. See `references/mutators.md` for full details.

| Mutator | What It Does | Example |
|---------|-------------|---------|
| **ArithmeticOperator** | Swaps `+` `-` `*` `/` `%` | `a + b` → `a - b` |
| **EqualityOperator** | Swaps `===` `!==` `<` `>` `<=` `>=` | `a === b` → `a !== b` |
| **ConditionalExpression** | Replaces conditions with `true`/`false` | `if (x > 0)` → `if (true)` |
| **LogicalOperator** | Swaps `&&` `\|\|` `??` | `a && b` → `a \|\| b` |
| **BooleanLiteral** | Flips `true`/`false`, negates `!` | `true` → `false` |
| **StringLiteral** | Empties strings, mutates template literals | `"hello"` → `""` |
| **ArrayDeclaration** | Empties array literals | `[1, 2, 3]` → `[]` |
| **ObjectLiteral** | Empties object literals | `{ a: 1 }` → `{}` |
| **BlockStatement** | Removes block content | `{ return x; }` → `{}` |
| **UnaryOperator** | Removes/swaps `+` `-` `~` `!` | `-x` → `+x` |
| **UpdateOperator** | Swaps `++`/`--`, pre/post | `i++` → `i--` |
| **AssignmentOperator** | Swaps `+=` `-=` `*=` etc. | `x += 1` → `x -= 1` |
| **MethodExpression** | Mutates array methods | `.filter()` → `.filter(() => true)` |
| **OptionalChaining** | Removes `?.` | `obj?.prop` → `obj.prop` |
| **Regex** | Mutates regex patterns | `/\d+/` → `/\D+/` |

### Excluding mutators

```javascript
mutator: {
  excludedMutations: ['StringLiteral', 'ObjectLiteral'],
},
```

---

## Reporters

| Reporter | Output | Use Case |
|----------|--------|----------|
| `progress` | Terminal progress bar | During execution |
| `clear-text` | Console summary + survivors | Quick review |
| `html` | Interactive HTML file | Detailed analysis |
| `json` | JSON mutation report | CI/CD processing |
| `dashboard` | Stryker Dashboard (stryker-mutator.io) | Team tracking |
| `dots` | Minimal dot output | CI logs |

### HTML report

```javascript
reporters: ['html'],
htmlReporter: {
  fileName: 'reports/mutation/mutation.html',
},
```

The HTML report shows each file with inline diffs, color-coded by status (killed/survived/no coverage).

### Dashboard reporter

```javascript
reporters: ['dashboard'],
dashboard: {
  project: 'github.com/your-org/your-repo',
  version: process.env.GIT_BRANCH || 'main',
  module: 'order-service',  // For monorepos
  baseUrl: 'https://dashboard.stryker-mutator.io/api/reports',
},
```

Requires `STRYKER_DASHBOARD_API_KEY` environment variable.

---

## Disabling Mutants

### Comment directives

```typescript
// Stryker disable next-line all: reason
const MAGIC_NUMBER = 42;

// Stryker disable next-line EqualityOperator,ConditionalExpression: equivalent mutant
if (items.length === 0) return [];

// Stryker disable all: generated code below
export const ROUTES = [/* ... */];
// Stryker restore all
```

### Syntax

```
// Stryker [disable|restore] [next-line] mutatorList[: reason]
```

| Directive | Scope |
|-----------|-------|
| `disable next-line all` | Next line, all mutators |
| `disable next-line EqualityOperator` | Next line, specific mutator |
| `disable all` | All subsequent lines until restore |
| `restore all` | Re-enable mutations |
| `disable EqualityOperator: boundary case` | Specific mutator with reason |

### Global exclusion (config)

```javascript
mutator: {
  excludedMutations: ['StringLiteral'],
},
```

---

## Incremental Mode

Reuses previous mutation results for unchanged code. Massive speedup for CI.

```javascript
export default {
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
};
```

### How it works

1. First run: full mutation testing, saves results to `incrementalFile`
2. Subsequent runs: only re-tests mutants in changed files
3. Unchanged mutants retain their previous status

### CI usage

Cache `stryker-incremental.json` between pipeline runs:

```yaml
cache:
  key: stryker-$CI_PROJECT_ID
  paths:
    - reports/mutation/stryker-incremental.json
```

---

## NestJS Integration

### Install

```bash
npm install --save-dev \
  @stryker-mutator/core \
  @stryker-mutator/jest-runner \
  @stryker-mutator/typescript-checker
```

### Config for NestJS service

```javascript
// stryker.config.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.module.ts',     // NestJS modules are wiring, not logic
    '!src/**/*.dto.ts',        // DTOs are declarations
    '!src/**/*.entity.ts',     // Entities are declarations
    '!src/**/index.ts',        // Re-exports
    '!src/main.ts',            // Bootstrap
    '!src/prisma/**',          // Generated Prisma client
  ],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.ts',
    enableFindRelatedTests: true,
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: { fileName: 'reports/mutation.html' },
  thresholds: { high: 80, low: 60, break: 0 },
  concurrency: 2,
  timeoutMS: 30000,
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};
```

### What to exclude in NestJS

| Exclude Pattern | Reason |
|----------------|--------|
| `*.module.ts` | DI wiring, no logic to mutate |
| `*.dto.ts` | Class declarations / validation decorators |
| `*.entity.ts` | TypeORM/Prisma entity definitions |
| `main.ts` | Bootstrap, not testable via unit tests |
| `prisma/**` | Generated code |
| `index.ts` | Re-exports |
| `*.guard.ts` | Only if trivial (just calls `canActivate`) |

### What to mutate (focus here)

| Include Pattern | Why |
|----------------|-----|
| `*.service.ts` | Business logic lives here |
| `*.controller.ts` | Request handling, validation |
| `*.interceptor.ts` | Response transformation logic |
| `*.pipe.ts` | Custom validation pipes |
| `*.util.ts` / `*.helper.ts` | Shared utility functions |

### package.json scripts

```json
{
  "scripts": {
    "test:mutation": "stryker run",
    "test:mutation:incremental": "stryker run --incremental"
  }
}
```

---

## Thresholds & Quality Gates

```javascript
thresholds: {
  high: 80,   // >= 80% = green (excellent)
  low: 60,    // >= 60% = yellow (warning)
  break: 70,  // < 70% = exit code 1 (pipeline fails)
},
```

| Score Range | Color | Meaning |
|-------------|-------|---------|
| `>= high` | Green | Excellent test quality |
| `>= low && < high` | Yellow | Adequate but room to improve |
| `< low` | Red | Significant test gaps |
| `< break` | Exit 1 | Pipeline fails |

Set `break: 0` to disable the quality gate (report only).

### Recommended thresholds per context

| Context | `high` | `low` | `break` |
|---------|--------|-------|---------|
| New service | 80 | 60 | 70 |
| Mature service | 85 | 70 | 75 |
| Critical service (auth) | 90 | 80 | 80 |
| Legacy code | 70 | 50 | 0 |

---

## CI/CD Integration

See `references/ci-cd-reporting.md` for full pipeline examples.

### GitLab CI

```yaml
mutation-testing:
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
    key: stryker-$CI_PROJECT_ID-order
    paths:
      - order-service/reports/stryker-incremental.json
  rules:
    - if: $CI_MERGE_REQUEST_IID
      changes:
        - order-service/src/**/*.ts
```

### npm scripts

```json
{
  "scripts": {
    "test:mutation": "stryker run",
    "test:mutation:ci": "stryker run --reporters progress clear-text json html"
  }
}
```

---

## Surviving Mutant Analysis

When a mutant survives, follow this process:

### 1. Identify the gap

Open the HTML report or read `clear-text` output. Look for **Survived** and **NoCoverage** mutants.

### 2. Categorize the survivor

| Category | Example Mutation | Action |
|----------|-----------------|--------|
| **Missing assertion** | `return a + b` → `return a - b` | Add test checking the computed value |
| **Missing boundary test** | `if (x > 0)` → `if (x >= 0)` | Add test for `x = 0` |
| **NoCoverage** | Block mutated but no test imports it | Write a test for this code path |
| **Dead code** | Mutation in unreachable branch | Delete the dead code |
| **Equivalent mutant** | `x * 1` → `x / 1` (same result) | Disable with comment + reason |
| **Weak assertion** | Test uses `toBeDefined()` | Strengthen to `toBe(expected)` |

### 3. Write the killing test

```typescript
// Survivor: order.service.ts line 42
// Mutation: totalPrice + shippingCost → totalPrice - shippingCost

it('should add shipping cost to total price', () => {
  const order = service.calculateTotal({ items: [{ price: 100 }], shipping: 15 });
  expect(order.total).toBe(115); // Exact value kills ArithmeticOperator mutant
});
```

### 4. Re-run incrementally

```bash
npx stryker run --incremental
```

---

## Best Practices

### Configuration

- **Use TypeScript checker** — filters out compile-error mutants, saves time
- **Enable `enableFindRelatedTests`** — only runs relevant tests per mutant
- **Use incremental mode in CI** — 10x faster after first run
- **Exclude non-logic files** — modules, DTOs, entities, main.ts, generated code
- **Set `break` threshold** — enforce quality gate in CI

### Test Quality

- **Kill survivors by writing better tests, not by disabling mutants**
- **Use `// Stryker disable` sparingly** — only for true equivalent mutants, always include reason
- **Prefer specific assertions** — `toBe(42)` over `toBeDefined()`
- **Test boundary conditions** — kills comparison operator mutations
- **Test both branches** — kills conditional expression mutations
- **Test error paths** — kills block statement removals

### Performance

- **Incremental mode** — reuse results for unchanged files
- **`concurrency`** — match to CPU cores (leave 1-2 for OS)
- **TypeScript checker** — eliminates type-error mutants before test execution
- **`enableFindRelatedTests`** — Jest only runs covering tests
- **Filter to changed files in CI** — mutate only `src/` not `node_modules/`

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Disabling all survivors with comments | Hides test gaps | Write tests to kill them |
| No `break` threshold in CI | Score silently degrades | Set `break: 70` or higher |
| Mutating DTOs/entities/modules | No logic, inflates score | Exclude in `mutate` globs |
| Running without TypeScript checker | Wastes time on compile-error mutants | Add `checkers: ['typescript']` |
| No incremental in CI | Full run every time (~slow) | Enable incremental + cache |
| Targeting 100% mutation score | Equivalent mutants make this impossible | Aim for 80-90% |
| Mutating generated code (Prisma) | Meaningless mutations | Exclude `prisma/` in mutate |
| Only using `toBeDefined()` assertions | Most mutants survive weak assertions | Use `toBe()`, `toEqual()`, `toStrictEqual()` |

---

## Troubleshooting

### "Initial test run failed"

- Run `npx jest` standalone first — ensure tests pass
- Check `tsconfigFile` points to correct tsconfig
- Try `disableTypeChecks: 'src/**/*.{js,ts}'` if type errors appear

### Very slow execution

- Enable `incremental: true` and cache the incremental file
- Enable `enableFindRelatedTests` in Jest config
- Add `checkers: ['typescript']` to filter compile-error mutants early
- Reduce `concurrency` if running out of memory
- Exclude test files, generated files, declarations from `mutate`

### "Out of memory"

```bash
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096 npx stryker run
```

Or reduce `concurrency` to 1-2.

### High number of surviving mutants

- Check the HTML report — sort by file to find the worst areas
- Look for `NoCoverage` mutants — these need tests, not better assertions
- Look for `Survived` with weak assertions (`toBeDefined`, `toBeTruthy`)
- Run `cr-report` with `--surviving-only` to focus

### TypeScript checker issues

- Ensure `@stryker-mutator/typescript-checker` is installed
- `tsconfigFile` must exist and be valid
- For monorepos, point to the service's tsconfig, not the root

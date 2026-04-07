---
name: cosmic-ray
description: "Mutation testing for Python with Cosmic Ray: configuration, operators, sessions, reporting, filters, distributed execution, CI/CD integration, and surviving mutant analysis."
globs: "**/*cosmic*.toml,**/cosmic-ray*,**/*.py"
alwaysApply: false
---

# Cosmic Ray — Mutation Testing for Python

Mutation testing introduces small changes (mutants) into source code, then runs the test suite for each. If a test fails, the mutant is **killed** (good). If all tests pass, the mutant **survived** (bad — your tests missed something).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Configuration](#configuration)
4. [Workflow](#workflow)
5. [Operators](#operators)
6. [Reporting & Analysis](#reporting--analysis)
7. [Filters](#filters)
8. [Distributed Execution](#distributed-execution)
9. [CI/CD Integration](#cicd-integration)
10. [Surviving Mutant Analysis](#surviving-mutant-analysis)
11. [Best Practices](#best-practices)
12. [Anti-Patterns](#anti-patterns)
13. [Troubleshooting](#troubleshooting)

## Modules

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Operators reference | `references/operators.md` | Understanding mutation types, filtering operators |
| CI/CD & reporting | `references/ci-cd-reporting.md` | Pipeline integration, HTML reports, quality gates |

---

## Quick Start

### Install

```bash
pip install cosmic-ray

# With HTML reporting
pip install cosmic-ray[html]
```

### Minimal config (`cosmic-ray.toml`)

```toml
[cosmic-ray]
module-path = "src/auth"
timeout = 30
excluded-modules = []
test-command = "python -m pytest tests/ -x -q"
distributor.name = "local"
```

### Run

```bash
# 1. Initialize session (creates SQLite DB)
cosmic-ray init cosmic-ray.toml session.sqlite

# 2. Execute mutations
cosmic-ray exec cosmic-ray.toml session.sqlite

# 3. Report results
cr-report session.sqlite

# 4. HTML report (optional)
cr-html session.sqlite > report.html
```

---

## Core Concepts

### Session

A session is a SQLite database (`session.sqlite`) that stores:
- All planned mutations (one per mutant)
- Execution status of each (pending, killed, survived, incompetent, timeout)
- Worker outcomes and test output

### Mutant

A single modification to the source code. Example: replacing `+` with `-`, `True` with `False`, `>=` with `<`.

### Outcomes

| Outcome | Meaning | Quality Signal |
|---------|---------|----------------|
| **Killed** | Test suite caught the mutation (at least one test failed) | Good — tests are effective |
| **Survived** | All tests passed despite the mutation | Bad — test gap detected |
| **Incompetent** | Mutation caused a syntax/import error (not a valid mutation) | Neutral — skip in analysis |
| **Timeout** | Test suite exceeded the timeout | Likely killed but slow |

### Mutation Score

```
mutation_score = killed / (killed + survived)
```

- **> 80%** — solid test suite
- **> 90%** — excellent
- **< 60%** — significant test gaps

---

## Configuration

### Full `cosmic-ray.toml` reference

```toml
[cosmic-ray]
# Path to the module(s) to mutate (required)
module-path = "src/auth"

# Timeout per mutant test run in seconds (required)
# Set to ~10x your normal test suite duration
timeout = 30

# Modules to exclude from mutation (list of dotted module names)
excluded-modules = [
    "src.auth.migrations",
    "src.auth.config",
    "src.auth.__main__",
]

# Command to run the test suite (required)
# Use -x (fail fast) for speed — we only need one failure per mutant
test-command = "python -m pytest tests/ -x -q --no-header --tb=no"

# Execution engine
[cosmic-ray.distributor]
name = "local"  # "local" for single machine, "celery4" for distributed
```

### Key configuration tips

- **`module-path`** — point to the package directory, not individual files
- **`timeout`** — too low = false timeouts; too high = slow runs. Start with 10x normal test time
- **`test-command`** — use `-x` (exit on first failure) and `-q` (quiet) for speed
- **`excluded-modules`** — exclude migrations, configs, `__main__`, auto-generated code

### Per-service config (microservices)

```
auth-service/
  cosmic-ray.toml       # module-path = "app"
  session.sqlite

order-service/
  cosmic-ray.toml       # module-path = "src"
  session.sqlite
```

---

## Workflow

### Standard workflow

```bash
# Step 1: Initialize — scans source code, creates all mutation jobs
cosmic-ray init cosmic-ray.toml session.sqlite

# Step 2: Execute — runs test suite for each mutant
cosmic-ray exec cosmic-ray.toml session.sqlite

# Step 3: Report — summary of results
cr-report session.sqlite

# Step 4: Analyze survivors — find test gaps
cr-report session.sqlite --surviving-only --show-diff

# Step 5: Write tests to kill survivors, then re-run
cosmic-ray exec cosmic-ray.toml session.sqlite
```

### Incremental workflow (re-run after adding tests)

```bash
# Re-execute only pending/surviving mutants (no need to re-init)
cosmic-ray exec cosmic-ray.toml session.sqlite
```

### Reset and re-run from scratch

```bash
rm session.sqlite
cosmic-ray init cosmic-ray.toml session.sqlite
cosmic-ray exec cosmic-ray.toml session.sqlite
```

---

## Operators

Cosmic Ray ships with the following mutation operator categories. See `references/operators.md` for full details.

### Operator Categories

| Category | What It Does | Examples |
|----------|-------------|----------|
| **Binary Operator Replacement** | Swaps arithmetic/bitwise operators | `+` → `-`, `*` → `/`, `&` → `\|` |
| **Comparison Operator Replacement** | Swaps comparison operators | `==` → `!=`, `<` → `>=`, `is` → `is not` |
| **Boolean Operator Replacement** | Swaps boolean operators/literals | `and` → `or`, `True` → `False` |
| **Unary Operator Replacement** | Modifies unary operators | `+x` → `-x`, `not x` → `x` |
| **Break/Continue Replacement** | Swaps loop control | `continue` → `break` |
| **Number Replacement** | Changes numeric constants | `0` → `1`, `1` → `0` |
| **Exception Replacement** | Swaps exception types | `ValueError` → `Exception` |

### Listing available operators

```bash
cosmic-ray operators
```

---

## Reporting & Analysis

### Console report

```bash
# Full summary
cr-report session.sqlite

# Output example:
# total jobs: 150
# complete: 150 (100.00%)
# surviving mutants: 12 (8.00%)
```

### Surviving mutants only (with diffs)

```bash
cr-report session.sqlite --surviving-only --show-diff
```

Output:
```
[job-id] abc123
app/auth.py core/ReplaceBinaryOperator_Add_Sub 0
worker outcome: normal, test outcome: survived
--- a/app/auth.py
+++ b/app/auth.py
@@ -42,1 +42,1 @@
-    return expires_at + timedelta(minutes=60)
+    return expires_at - timedelta(minutes=60)
```

This tells you: **no test checks that the expiration is computed with addition, not subtraction**.

### Surviving mutants with test output

```bash
cr-report session.sqlite --surviving-only --show-output
```

### HTML report

```bash
cr-html session.sqlite > mutation-report.html

# With filters
cr-html session.sqlite --only-completed --skip-success > mutation-report.html
```

### Programmatic access (Python)

```python
from cosmic_ray.work_db import WorkDB
from cosmic_ray.work_item import TestOutcome

with WorkDB(session_path) as db:
    results = list(db.completed_work_items)

    killed = sum(1 for r in results if r.test_outcome == TestOutcome.KILLED)
    survived = sum(1 for r in results if r.test_outcome == TestOutcome.SURVIVED)
    total = killed + survived

    score = (killed / total * 100) if total > 0 else 0
    print(f"Mutation score: {score:.1f}%")
    print(f"Killed: {killed}, Survived: {survived}, Total: {total}")
```

---

## Filters

Filters reduce the number of mutations to run, speeding up execution.

### Operator filter

Run only specific operator types:

```bash
# Filter to only comparison and boolean operators
cr-filter-operators session.sqlite \
  --operators ReplaceComparisonOperator_Eq_NotEq \
  --operators ReplaceTrueWithFalse \
  --operators ReplaceFalseWithTrue
```

### Pragma filter (skip lines with `# pragma: no mutate`)

```python
# This line won't be mutated
x = critical_constant  # pragma: no mutate
```

```bash
cr-filter-pragma session.sqlite
```

### Git diff filter (only mutate changed files)

```bash
cr-filter-git session.sqlite --branch main
```

This is extremely useful in CI: only test mutations in code that changed in the PR.

### Custom filter (Python)

```python
# filter_mine.py
from cosmic_ray.tools.filters.filter_app import FilterApp

class MyFilter(FilterApp):
    def filter(self, source_file, line_number, function_name, mutation_description):
        # Skip test files
        if "test_" in source_file:
            return True  # Filter out
        # Skip __init__ files
        if "__init__" in source_file:
            return True
        return False  # Keep
```

---

## Distributed Execution

For large codebases, use Celery to distribute mutations across workers.

### Install

```bash
pip install cosmic-ray[celery4]
```

### Config

```toml
[cosmic-ray]
module-path = "src"
timeout = 60
test-command = "python -m pytest tests/ -x -q"

[cosmic-ray.distributor]
name = "celery4"

[cosmic-ray.distributor.celery4]
broker_url = "redis://localhost:6379/0"
```

### Run workers

```bash
# Terminal 1: Start Celery workers
celery -A cosmic_ray.distributed.celery4.worker worker -l info -c 4

# Terminal 2: Execute mutations
cosmic-ray exec cosmic-ray.toml session.sqlite
```

---

## CI/CD Integration

### GitLab CI example

```yaml
mutation-testing:
  stage: test
  image: python:3.12-slim
  before_script:
    - cd auth-service
    - pip install -r requirements.txt
    - pip install cosmic-ray
  script:
    # Init and run
    - cosmic-ray init cosmic-ray.toml session.sqlite
    - cosmic-ray exec cosmic-ray.toml session.sqlite

    # Generate report
    - cr-report session.sqlite
    - cr-html session.sqlite > mutation-report.html

    # Quality gate — fail if mutation score < 80%
    - |
      python3 -c "
      from cosmic_ray.work_db import WorkDB
      from cosmic_ray.work_item import TestOutcome
      with WorkDB('session.sqlite') as db:
          results = list(db.completed_work_items)
          killed = sum(1 for r in results if r.test_outcome == TestOutcome.KILLED)
          survived = sum(1 for r in results if r.test_outcome == TestOutcome.SURVIVED)
          total = killed + survived
          score = (killed / total * 100) if total > 0 else 100
          print(f'Mutation score: {score:.1f}% ({killed}/{total})')
          if score < 80:
              print('FAIL: Mutation score below 80% threshold')
              exit(1)
      "
  artifacts:
    paths:
      - auth-service/mutation-report.html
    when: always
  rules:
    - if: $CI_MERGE_REQUEST_IID
      changes:
        - auth-service/**/*.py
```

### PR-scoped mutation testing (git diff filter)

```yaml
mutation-testing:mr:
  stage: test
  script:
    - cosmic-ray init cosmic-ray.toml session.sqlite
    - cr-filter-git session.sqlite --branch origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - cosmic-ray exec cosmic-ray.toml session.sqlite
    - cr-report session.sqlite --surviving-only --show-diff
```

---

## Surviving Mutant Analysis

When a mutant survives, follow this process:

### 1. Identify the gap

```bash
cr-report session.sqlite --surviving-only --show-diff
```

### 2. Categorize the survivor

| Category | Example Mutation | Action |
|----------|-----------------|--------|
| **Missing assertion** | `return x + 1` → `return x - 1` | Add a test that checks the computed value |
| **Missing edge case** | `if x > 0` → `if x >= 0` | Add test for boundary value (`x = 0`) |
| **Dead code** | Mutating unreachable branch | Delete the dead code |
| **Equivalent mutant** | `x * 1` → `x * -1` but x is always 0 | Mark with `# pragma: no mutate` |
| **Weak assertion** | Test uses `assert result is not None` | Strengthen to `assert result == expected` |

### 3. Write the killing test

```python
# Survivor: app/auth.py line 42
# Mutation: expires_at + timedelta(minutes=60) → expires_at - timedelta(minutes=60)

def test_token_expiry_is_in_future():
    """Kill mutant: ensures expiry uses addition, not subtraction."""
    now = datetime.utcnow()
    token = create_access_token(user_id=1)
    decoded = decode_token(token)
    assert decoded["exp"] > now.timestamp()
    assert decoded["exp"] < (now + timedelta(hours=2)).timestamp()
```

### 4. Re-run to confirm the kill

```bash
cosmic-ray exec cosmic-ray.toml session.sqlite
cr-report session.sqlite --surviving-only
```

---

## Best Practices

### Configuration

- **Use `-x` in test-command** — exit on first failure; you only need one test to kill a mutant
- **Use `-q --no-header --tb=no`** — minimize output, speed up execution
- **Set timeout to 10x normal** — too tight causes false timeouts
- **Exclude non-logic code** — migrations, configs, `__init__.py`, auto-generated files
- **One config per service** — each microservice gets its own `cosmic-ray.toml`

### Workflow

- **Run locally before CI** — catch low mutation scores early
- **Start with critical modules** — don't mutate everything at once
- **Use git diff filter in PRs** — only test mutations in changed code
- **Track mutation score over time** — it should trend upward
- **Add `session.sqlite` to `.gitignore`** — it's generated, not source

### Test Quality

- **Kill survivors by writing better tests, not by excluding mutants**
- **Use `# pragma: no mutate` sparingly** — only for true equivalent mutants
- **Prefer specific assertions** — `assert result == 42` over `assert result is not None`
- **Test boundary conditions** — these kill comparison operator mutations
- **Test both branches of conditionals** — these kill boolean mutations

### Performance

- **Parallelize with `--jobs`** or Celery for large codebases
- **Filter to changed files in CI** — `cr-filter-git`
- **Exclude slow test markers** — `test-command = "pytest -x -q -m 'not slow'"`

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Excluding all survivors with pragma | Hides test gaps | Write tests to kill them |
| Running without `-x` flag | 10x slower — runs full suite per mutant | Always use `-x` (fail fast) |
| Setting timeout too low | False timeouts inflate kill count | Set to 10x normal test time |
| Mutating test files | Tests testing tests — meaningless | Exclude test directories |
| Targeting 100% mutation score | Equivalent mutants make this impossible | Aim for 80-90% |
| Running on entire codebase in CI | Too slow for every commit | Use git diff filter for PRs |
| Ignoring incompetent mutants | May indicate code quality issues | Investigate if count is high |
| No quality gate in CI | Mutation score silently degrades | Fail pipeline below threshold |

---

## Troubleshooting

### "No mutations found"

- Verify `module-path` points to a Python package with `.py` files
- Check `excluded-modules` isn't too broad
- Run `cosmic-ray init` and inspect `session.sqlite`

### Mutations are very slow

- Add `-x` to `test-command` (exit on first failure)
- Add `--tb=no -q` to reduce pytest output overhead
- Reduce `timeout` if it's too generous
- Use `cr-filter-git` to scope to changed files
- Consider distributed execution with Celery

### High number of surviving mutants

- Check if tests are assertion-light (`assert True`, `assert result is not None`)
- Check for untested branches / edge cases
- Run `cr-report --surviving-only --show-diff` to see what was mutated

### "ModuleNotFoundError" during execution

- Ensure the project is installed in editable mode: `pip install -e .`
- Or add the source directory to `PYTHONPATH`
- Check that `test-command` runs successfully standalone first

### Session database locked

- Only one `cosmic-ray exec` process can use a session at a time (unless distributed)
- Delete `session.sqlite` and re-init if corrupted

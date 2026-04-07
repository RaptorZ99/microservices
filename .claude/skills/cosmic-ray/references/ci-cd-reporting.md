# CI/CD & Reporting Reference

## Report Commands

### `cr-report` — Console report

```bash
# Full summary
cr-report session.sqlite

# Surviving mutants only
cr-report session.sqlite --surviving-only

# With source code diffs
cr-report session.sqlite --surviving-only --show-diff

# With test output
cr-report session.sqlite --surviving-only --show-output

# Show pending (not yet executed)
cr-report session.sqlite --show-pending
```

#### Output format

```
[job-id] abc123def456
app/auth.py core/ReplaceBinaryOperator_Add_Sub 0
worker outcome: normal, test outcome: survived
--- a/app/auth.py
+++ b/app/auth.py
@@ -42,1 +42,1 @@
-    expires = now + timedelta(minutes=60)
+    expires = now - timedelta(minutes=60)

total jobs: 150
complete: 150 (100.00%)
surviving mutants: 12 (8.00%)
```

### `cr-html` — HTML report

```bash
# Full HTML report
cr-html session.sqlite > report.html

# Only completed mutations
cr-html session.sqlite --only-completed > report.html

# Skip successful kills (show only survivors)
cr-html session.sqlite --skip-success > report.html

# Combined
cr-html session.sqlite --only-completed --skip-success > survivors.html
```

## Programmatic Analysis

### Mutation score calculation

```python
#!/usr/bin/env python3
"""Calculate mutation score and enforce quality gate."""

import sys
from cosmic_ray.work_db import WorkDB
from cosmic_ray.work_item import TestOutcome

def analyze_session(session_path: str, threshold: float = 80.0) -> bool:
    """Analyze a Cosmic Ray session and return pass/fail."""
    with WorkDB(session_path) as db:
        results = list(db.completed_work_items)

    killed = sum(1 for r in results if r.test_outcome == TestOutcome.KILLED)
    survived = sum(1 for r in results if r.test_outcome == TestOutcome.SURVIVED)
    incompetent = sum(1 for r in results if r.test_outcome == TestOutcome.INCOMPETENT)
    timeout = sum(1 for r in results if r.test_outcome == TestOutcome.TIMEOUT)

    total_valid = killed + survived
    score = (killed / total_valid * 100) if total_valid > 0 else 100.0

    print(f"=== Mutation Testing Results ===")
    print(f"Total mutations:  {len(results)}")
    print(f"Killed:           {killed}")
    print(f"Survived:         {survived}")
    print(f"Incompetent:      {incompetent}")
    print(f"Timeout:          {timeout}")
    print(f"Mutation score:   {score:.1f}%")
    print(f"Threshold:        {threshold:.1f}%")

    if score >= threshold:
        print(f"PASS")
        return True
    else:
        print(f"FAIL: mutation score {score:.1f}% < {threshold:.1f}%")
        return False

if __name__ == "__main__":
    session = sys.argv[1] if len(sys.argv) > 1 else "session.sqlite"
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 80.0
    success = analyze_session(session, threshold)
    sys.exit(0 if success else 1)
```

Usage:
```bash
python mutation_gate.py session.sqlite 80
```

### Detailed survivor report

```python
"""Generate a detailed report of surviving mutants."""

from cosmic_ray.work_db import WorkDB
from cosmic_ray.work_item import TestOutcome

def report_survivors(session_path: str):
    with WorkDB(session_path) as db:
        survivors = [
            item for item in db.completed_work_items
            if item.test_outcome == TestOutcome.SURVIVED
        ]

    # Group by file
    by_file = {}
    for item in survivors:
        path = item.module_path
        by_file.setdefault(path, []).append(item)

    for file_path, items in sorted(by_file.items()):
        print(f"\n{'='*60}")
        print(f"File: {file_path} ({len(items)} survivors)")
        print(f"{'='*60}")
        for item in items:
            print(f"  Line {item.start_pos[0]}: {item.operator_name}")
            print(f"  Job ID: {item.job_id}")
            print()
```

## GitLab CI/CD Integration

### Basic pipeline stage

```yaml
mutation-testing:
  stage: test
  image: python:3.12-slim
  before_script:
    - cd auth-service
    - pip install -r requirements.txt
    - pip install "cosmic-ray[html]"
  script:
    - cosmic-ray init cosmic-ray.toml session.sqlite
    - cosmic-ray exec cosmic-ray.toml session.sqlite
    - cr-report session.sqlite
    - cr-html session.sqlite > mutation-report.html
    - python scripts/mutation_gate.py session.sqlite 80
  artifacts:
    paths:
      - auth-service/mutation-report.html
    reports:
      # Attach as CI artifact for review
      junit: auth-service/mutation-report.html
    when: always
  rules:
    - if: $CI_MERGE_REQUEST_IID
      changes:
        - auth-service/**/*.py
```

### PR-scoped (only changed files)

```yaml
mutation-testing:mr:
  stage: test
  script:
    - cd auth-service
    - pip install -r requirements.txt
    - pip install cosmic-ray
    - cosmic-ray init cosmic-ray.toml session.sqlite
    # Filter to only files changed in this MR
    - cr-filter-git session.sqlite --branch origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - cosmic-ray exec cosmic-ray.toml session.sqlite
    - cr-report session.sqlite --surviving-only --show-diff
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
          print(f'Mutation score: {score:.1f}%')
          if score < 80:
              exit(1)
      "
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

### Scheduled full run (nightly)

```yaml
mutation-testing:full:
  stage: test
  script:
    - cd auth-service
    - pip install -r requirements.txt
    - pip install "cosmic-ray[html]"
    - cosmic-ray init cosmic-ray.toml session.sqlite
    - cosmic-ray exec cosmic-ray.toml session.sqlite
    - cr-html session.sqlite > mutation-report.html
    - python scripts/mutation_gate.py session.sqlite 80
  artifacts:
    paths:
      - auth-service/mutation-report.html
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

## Quality Gate Thresholds

| Context | Recommended Threshold | Rationale |
|---------|----------------------|-----------|
| New code (PR) | 90% | New code should have thorough tests |
| Existing codebase | 70-80% | Legacy code may have test debt |
| Critical modules (auth, payments) | 90%+ | High risk, high coverage needed |
| Utility/helper code | 70% | Lower risk |
| Nightly full run | 80% | Track overall health |

## Combining with Coverage

Mutation testing complements line/branch coverage. Use both:

```yaml
test:
  script:
    - pytest --cov=app --cov-report=term --cov-fail-under=80
    # Coverage passes, but are the tests actually catching bugs?
    - cosmic-ray init cosmic-ray.toml session.sqlite
    - cosmic-ray exec cosmic-ray.toml session.sqlite
    # Mutation testing answers that question
```

Coverage tells you **what code ran**. Mutation testing tells you **what code was tested**.

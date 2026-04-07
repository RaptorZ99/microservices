# Pipeline Optimization Reference

Expert-level guide to optimizing GitLab CI/CD pipelines for speed, cost, and reliability.

## Table of Contents

1. [Caching Strategies](#1-caching-strategies)
2. [Artifact Management](#2-artifact-management)
3. [Parallelism and Job Splitting](#3-parallelism-and-job-splitting)
4. [Docker Optimization](#4-docker-optimization)
5. [Runner Selection and Tags](#5-runner-selection-and-tags)
6. [Job-Level Optimizations](#6-job-level-optimizations)
7. [Pipeline-Level Optimizations](#7-pipeline-level-optimizations)
8. [Measuring Pipeline Performance](#8-measuring-pipeline-performance)

---

## 1. Caching Strategies

### Cache Key Patterns

```yaml
# Static key — shared across all branches (rarely correct)
cache:
  key: global-cache
  paths:
    - .cache/

# Branch-scoped key — isolated per branch
cache:
  key: $CI_COMMIT_REF_SLUG
  paths:
    - node_modules/

# Lock file-based key — invalidates only when dependencies change (recommended)
cache:
  key:
    files:
      - package-lock.json
  paths:
    - node_modules/
    - .npm/

# Prefix + lock file — unique per job but still dependency-aware
cache:
  key:
    files:
      - package-lock.json
    prefix: $CI_JOB_NAME
  paths:
    - node_modules/
```

### Cache Policy

| Policy | Behavior | Use Case |
|---|---|---|
| `pull-push` | Download at start, upload at end (default) | Install/setup jobs |
| `pull` | Download only, never upload | Consumer jobs (test, lint, build) |
| `push` | Upload only, never download | Dedicated cache-warming jobs |

```yaml
# Split pattern: one job warms the cache, others consume it
install:
  stage: .pre
  script:
    - npm ci
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
      - .npm/
    policy: push

test:
  stage: test
  script:
    - npm test
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
      - .npm/
    policy: pull

lint:
  stage: test
  script:
    - npm run lint
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
      - .npm/
    policy: pull
```

### Fallback Keys

```yaml
cache:
  key:
    files:
      - Gemfile.lock
    prefix: ruby
  paths:
    - vendor/bundle/
  fallback_keys:
    - ruby-$CI_DEFAULT_BRANCH
    - ruby-main
```

When the primary key misses, GitLab tries each fallback in order. This gives partial cache hits when a lock file changes on a feature branch but the default branch still has a recent cache.

### Per-Language Cache Patterns

```yaml
# Node.js
.cache-node:
  cache:
    key:
      files:
        - package-lock.json
      prefix: node
    paths:
      - node_modules/
      - .npm/

# Python (pip)
.cache-python:
  cache:
    key:
      files:
        - requirements.txt
        - poetry.lock
      prefix: python
    paths:
      - .venv/
      - .cache/pip/

# Go
.cache-go:
  cache:
    key:
      files:
        - go.sum
      prefix: go
    paths:
      - .go/pkg/mod/
  variables:
    GOPATH: $CI_PROJECT_DIR/.go

# Ruby (Bundler)
.cache-ruby:
  cache:
    key:
      files:
        - Gemfile.lock
      prefix: ruby
    paths:
      - vendor/bundle/
  variables:
    BUNDLE_PATH: vendor/bundle

# Java (Maven)
.cache-maven:
  cache:
    key:
      files:
        - pom.xml
      prefix: maven
    paths:
      - .m2/repository/
  variables:
    MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"

# Java (Gradle)
.cache-gradle:
  cache:
    key:
      files:
        - build.gradle
        - gradle.properties
      prefix: gradle
    paths:
      - .gradle/caches/
      - .gradle/wrapper/

# PHP (Composer)
.cache-composer:
  cache:
    key:
      files:
        - composer.lock
      prefix: composer
    paths:
      - vendor/

# Rust
.cache-rust:
  cache:
    key:
      files:
        - Cargo.lock
      prefix: rust
    paths:
      - target/
      - $CARGO_HOME/registry/
```

### Distributed Cache with S3/GCS

Configure in `config.toml` on the runner (not in `.gitlab-ci.yml`):

```toml
# Runner config.toml — S3 distributed cache
[runners.cache]
  Type = "s3"
  Shared = true
  [runners.cache.s3]
    ServerAddress = "s3.amazonaws.com"
    BucketName = "my-ci-cache"
    BucketLocation = "us-east-1"
    AuthenticationType = "iam"
```

Distributed cache is essential when runners are ephemeral (autoscaled) or span multiple machines.

### Cache vs Artifacts Decision Matrix

| Factor | Cache | Artifacts |
|---|---|---|
| Purpose | Speed up installs | Pass files between jobs/stages |
| Reliability | Best-effort (may miss) | Guaranteed delivery |
| Scope | Per-runner or distributed | Per-pipeline |
| Retention | LRU eviction | `expire_in` controlled |
| Use for | Dependencies, compiled packages | Build outputs, test reports |
| Cross-pipeline | Yes | No (unless `artifacts:public`) |

### Anti-Patterns

- Caching `node_modules/` without a lock-file key -- stale dependencies cause flaky builds.
- Caching build outputs (e.g., `dist/`) -- use artifacts instead; caches are not guaranteed.
- Using `pull-push` on every job -- wastes time re-uploading an unchanged cache.
- Caching large directories (>1 GB) without a distributed backend -- slows down every job.

---

## 2. Artifact Management

### Keep Artifacts Minimal

```yaml
build:
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
    exclude:
      - dist/**/*.map      # drop source maps
      - dist/**/*.LICENSE   # drop license files
    expire_in: 1 hour
```

### Expiration Rules

Always set `expire_in`. Uncapped artifacts fill storage fast.

```yaml
artifacts:
  expire_in: 30 minutes   # ephemeral (test results)
  expire_in: 1 hour       # short-lived build outputs
  expire_in: 1 week       # deploy artifacts on main
  expire_in: never         # compliance/audit artifacts only
```

### Artifact Reports

```yaml
test:
  script:
    - npm test -- --coverage --reporters=default --reporters=jest-junit
  artifacts:
    when: always
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 7 days

sast:
  script:
    - semgrep --config auto --json -o semgrep.json .
  artifacts:
    reports:
      sast: semgrep.json
```

### Controlling Artifact Downloads with `dependencies`

```yaml
stages:
  - build
  - test
  - deploy

build-frontend:
  stage: build
  script: npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

build-backend:
  stage: build
  script: go build -o app .
  artifacts:
    paths:
      - app
    expire_in: 1 hour

test-frontend:
  stage: test
  dependencies:
    - build-frontend     # only downloads dist/, not app binary
  script: npm run test:e2e

deploy:
  stage: deploy
  dependencies:
    - build-frontend
    - build-backend
  script: ./deploy.sh
```

Without `dependencies`, every job in a later stage downloads every artifact from every earlier job. On large pipelines this wastes minutes.

### `artifacts:when`

```yaml
test:
  script: npm test
  artifacts:
    when: on_failure     # capture logs only when tests fail
    paths:
      - test-results/
      - screenshots/
    expire_in: 3 days
```

- `on_success` (default) -- upload only when the job succeeds.
- `on_failure` -- upload only when the job fails (ideal for debug artifacts).
- `always` -- upload regardless of outcome (needed for `reports:junit` to show in MR).

---

## 3. Parallelism and Job Splitting

### Basic `parallel` Keyword

```yaml
test:
  stage: test
  parallel: 5
  script:
    - echo "Running shard $CI_NODE_INDEX of $CI_NODE_TOTAL"
    - ./bin/split-tests --index $CI_NODE_INDEX --total $CI_NODE_TOTAL | xargs npm test
```

GitLab creates 5 copies of the job. Each receives `CI_NODE_INDEX` (1-5) and `CI_NODE_TOTAL` (5).

### Test Framework Integration

```yaml
# Jest with shard flag (Jest 28+)
test:
  parallel: 4
  script:
    - npx jest --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL

# pytest with pytest-split
test:
  parallel: 4
  script:
    - pytest --splits $CI_NODE_TOTAL --group $CI_NODE_INDEX

# RSpec with knapsack
test:
  parallel: 6
  script:
    - bundle exec rake "knapsack:rspec[--format progress]"
  artifacts:
    reports:
      junit: rspec.xml
```

### `parallel:matrix` for Multi-Dimensional Builds

```yaml
test:
  stage: test
  image: $IMAGE
  parallel:
    matrix:
      - IMAGE: ["node:18", "node:20", "node:22"]
        DB: ["postgres", "mysql"]
  services:
    - name: $DB
  script:
    - npm test

# Creates 6 jobs: node:18/postgres, node:18/mysql, node:20/postgres, ...
```

```yaml
# Cross-platform native builds
build:
  stage: build
  parallel:
    matrix:
      - OS: [linux, macos, windows]
        ARCH: [amd64, arm64]
  tags:
    - ${OS}-${ARCH}
  script:
    - make build GOOS=$OS GOARCH=$ARCH
```

### When Parallelism Helps vs Hurts

**Helps:** Test suites >5 minutes, independent test files, evenly-sized test groups.

**Hurts:** Short suites (<2 min) where runner spin-up overhead dominates, unevenly split tests where one shard takes 10x longer, jobs with heavy setup that cannot be cached.

---

## 4. Docker Optimization

### Multi-Stage Builds in CI

```yaml
build:
  stage: build
  script:
    - docker build
        --target production
        --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
        .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

### Docker Layer Caching with `--cache-from`

```yaml
build:
  stage: build
  script:
    - docker pull $CI_REGISTRY_IMAGE:latest || true
    - docker build
        --cache-from $CI_REGISTRY_IMAGE:latest
        --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
        --tag $CI_REGISTRY_IMAGE:latest
        .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
```

### Kaniko for Rootless Builds

```yaml
build:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.23.0-debug
    entrypoint: [""]
  script:
    - >-
      /kaniko/executor
      --context $CI_PROJECT_DIR
      --dockerfile $CI_PROJECT_DIR/Dockerfile
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --cache=true
      --cache-repo=$CI_REGISTRY_IMAGE/cache
```

Kaniko builds without Docker daemon access. Use it when DinD is not available or when security policy prohibits privileged containers.

### Buildx with Remote Cache

```yaml
build:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  variables:
    DOCKER_BUILDKIT: "1"
  before_script:
    - docker buildx create --use
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker buildx build
        --cache-from type=registry,ref=$CI_REGISTRY_IMAGE:buildcache
        --cache-to type=registry,ref=$CI_REGISTRY_IMAGE:buildcache,mode=max
        --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
        --push
        .
```

### Pre-Built Base Images

```yaml
# Scheduled job rebuilds the base image weekly
build-base:
  stage: .pre
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - docker build -f Dockerfile.base -t $CI_REGISTRY_IMAGE/base:latest .
    - docker push $CI_REGISTRY_IMAGE/base:latest

# Application Dockerfile uses pre-built base
# FROM $CI_REGISTRY_IMAGE/base:latest
# COPY . .
# RUN npm run build
```

### DinD vs Socket Binding vs Kaniko

| Method | Privileged | Speed | Security | Setup |
|---|---|---|---|---|
| Docker-in-Docker | Yes | Slow (no layer cache by default) | Isolated | Simple |
| Socket binding | No (mount host socket) | Fast (host cache) | Host-shared (risky) | Minimal |
| Kaniko | No | Medium (registry cache) | Good (unprivileged) | Moderate |

**Recommendation:** Kaniko for most CI workloads. DinD only when you need `docker compose` or multi-container builds. Avoid socket binding in shared-runner environments.

---

## 5. Runner Selection and Tags

### Matching Jobs to Runners

```yaml
build:
  tags:
    - docker
    - large        # runner with 8+ CPU, 16+ GB RAM
  script:
    - make build

test:unit:
  tags:
    - docker
    - medium
  script:
    - make test

deploy:
  tags:
    - deploy
    - production
  script:
    - ./deploy.sh
```

### Runner Types

| Type | Scope | Best For |
|---|---|---|
| Shared (instance) | All projects | General CI, small jobs |
| Group runners | All projects in a group | Team-specific tooling |
| Project runners | Single project | Sensitive deploys, specialized hardware |

### Autoscaling Runners

Use the GitLab Runner autoscaler with cloud instances for elastic capacity:

- Set `IdleCount` to keep warm runners for immediate pickup.
- Set `MaxInstances` to cap cost.
- Use preemptible/spot instances for test jobs (cost savings of 60-80%).
- Keep non-interruptible deploy jobs on on-demand instances.

### Resource Sizing Guidelines

- **Lint/static analysis:** 1-2 CPU, 2 GB RAM
- **Unit tests:** 2-4 CPU, 4 GB RAM
- **Integration tests:** 4+ CPU, 8+ GB RAM
- **Docker builds:** 4+ CPU, 8+ GB RAM, fast SSD
- **Large monorepo builds:** 8+ CPU, 16+ GB RAM

---

## 6. Job-Level Optimizations

### Interruptible Jobs

```yaml
test:
  interruptible: true    # auto-cancel if a newer pipeline starts
  script:
    - npm test
```

Pair with the auto-cancel setting under Settings > CI/CD > General pipelines.

### Retry with Conditions

```yaml
test:
  script:
    - npm test
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
      - scheduler_failure
```

Never use bare `retry: 2` -- it retries on script failures too, masking real bugs.

### Timeout

```yaml
test:
  timeout: 10 minutes    # fail fast instead of using the project default (60 min)
  script:
    - npm test

build:
  timeout: 30 minutes
  script:
    - docker build .
```

### Resource Groups

```yaml
deploy-staging:
  resource_group: staging    # only one deploy to staging at a time
  script:
    - ./deploy.sh staging

deploy-production:
  resource_group: production
  script:
    - ./deploy.sh production
```

Prevents concurrent deployments to the same environment.

### Allow Failure with Exit Codes

```yaml
test:experimental:
  script:
    - npm run test:experimental
  allow_failure:
    exit_codes:
      - 42    # known flaky exit code, don't block pipeline
```

### Shallow Clone and Git Strategy

```yaml
variables:
  GIT_DEPTH: 20              # fetch only last 20 commits (default is full clone)
  GIT_STRATEGY: fetch        # reuse existing checkout, pull changes

# For jobs that don't need source code at all
deploy:
  variables:
    GIT_STRATEGY: none       # skip clone entirely, rely on artifacts
  dependencies:
    - build
  script:
    - ./deploy.sh
```

| `GIT_STRATEGY` | Behavior | Use Case |
|---|---|---|
| `clone` | Fresh clone every time | Clean builds, reproducibility |
| `fetch` | Reuse working dir, `git fetch` | Faster on persistent runners |
| `none` | No git operation | Deploy jobs using only artifacts |

### Skip Jobs with `rules:changes`

```yaml
test-frontend:
  rules:
    - changes:
        - "frontend/**/*"
        - "package-lock.json"
  script:
    - npm test

test-backend:
  rules:
    - changes:
        - "backend/**/*"
        - "go.sum"
  script:
    - go test ./...

docs:
  rules:
    - changes:
        - "docs/**/*"
  script:
    - mkdocs build
```

---

## 7. Pipeline-Level Optimizations

### Merge Request Pipelines

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
```

This prevents duplicate pipelines (branch + MR) and limits pipeline execution to only the contexts that matter.

### Preventing Unnecessary Pipelines

```yaml
workflow:
  rules:
    # Skip pipelines for draft MRs (optional)
    - if: $CI_MERGE_REQUEST_TITLE =~ /^Draft:/
      when: never
    # Run on MR events
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    # Run on default branch
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    # Run on tags
    - if: $CI_COMMIT_TAG
    # Skip everything else
    - when: never
```

### `[skip ci]` in Commit Messages

Any commit message containing `[skip ci]` or `[ci skip]` prevents pipeline creation. Useful for documentation-only commits, but prefer `rules:changes` for automated control.

### MR-Specific File Change Detection

```yaml
test-frontend:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        compare_to: refs/heads/main    # compare against main, not previous commit
        paths:
          - "frontend/**/*"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - npm test
```

`compare_to` prevents false positives when a feature branch is rebased. Without it, `changes` compares to the previous commit, which can miss or incorrectly detect changes.

### Auto-Cancel Redundant Pipelines

```yaml
# In .gitlab-ci.yml — mark jobs as interruptible
stages:
  - build
  - test
  - deploy

build:
  interruptible: true
  script: make build

test:
  interruptible: true
  script: make test

deploy:
  interruptible: false    # never auto-cancel deploys
  script: make deploy
```

Enable under **Settings > CI/CD > General pipelines > Auto-cancel redundant pipelines**. When a new commit is pushed to the same branch, running interruptible jobs in the older pipeline are cancelled automatically.

### DAG for Optimal Stage Ordering

```yaml
# Traditional stages — test waits for ALL builds
# DAG — test-frontend starts as soon as build-frontend finishes

build-frontend:
  stage: build
  script: npm run build
  artifacts:
    paths: [dist/]

build-backend:
  stage: build
  script: go build -o app .
  artifacts:
    paths: [app]

test-frontend:
  stage: test
  needs: [build-frontend]    # starts immediately after build-frontend
  script: npm test

test-backend:
  stage: test
  needs: [build-backend]     # does not wait for build-frontend
  script: go test ./...

deploy:
  stage: deploy
  needs: [test-frontend, test-backend]
  script: ./deploy.sh
```

`needs` creates a directed acyclic graph, allowing jobs to start as soon as their specific dependencies complete rather than waiting for the entire previous stage.

---

## 8. Measuring Pipeline Performance

### Pipeline Duration Analytics

Navigate to **Analyze > CI/CD Analytics** in your project to see:

- Pipeline success rate over time
- Average pipeline duration trends
- Pipeline duration percentiles (p50, p95)

### Job-Level Timing Analysis

```yaml
# Add timing to scripts for granular visibility
test:
  script:
    - echo "TIMING_START=$(date +%s)" >> timing.env
    - npm test
    - echo "TIMING_END=$(date +%s)" >> timing.env
    - |
      source timing.env
      echo "Test duration: $((TIMING_END - TIMING_START)) seconds"
```

For more structured data, use the GitLab API:

```bash
# Fetch job-level timing for the last pipeline
curl --header "PRIVATE-TOKEN: $TOKEN" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/pipelines/latest/jobs" \
  | jq '.[] | {name, duration, queued_duration}'
```

### Identifying Bottlenecks with DAG Visualization

1. Open any pipeline and click the **Needs** tab to see the DAG view.
2. Look for long sequential chains -- these are candidates for `needs`-based parallelization.
3. Check `queued_duration` vs `duration` -- high queue times indicate runner capacity issues.
4. Find the critical path: the longest chain of dependent jobs determines total pipeline time.

### Setting Performance Budgets

```yaml
# Fail the pipeline if it exceeds a time budget
check-pipeline-budget:
  stage: .post
  script:
    - |
      PIPELINE_DURATION=$(curl -s --header "PRIVATE-TOKEN: $PIPELINE_TOKEN" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/pipelines/$CI_PIPELINE_ID" \
        | jq '.duration')
      BUDGET=1800  # 30 minutes
      if [ "$PIPELINE_DURATION" -gt "$BUDGET" ]; then
        echo "Pipeline exceeded budget: ${PIPELINE_DURATION}s > ${BUDGET}s"
        exit 1
      fi
  allow_failure: true   # warn, don't block
```

### Optimization Checklist

- [ ] All cache keys use lock-file-based `key:files`
- [ ] Consumer jobs use `cache:policy: pull`
- [ ] `GIT_DEPTH` is set (20-50 for most projects)
- [ ] `GIT_STRATEGY: none` on jobs that only need artifacts
- [ ] `expire_in` set on every `artifacts` block
- [ ] `dependencies` limits artifact downloads to what each job needs
- [ ] `needs` keyword used where DAG parallelism is possible
- [ ] `interruptible: true` on build and test jobs
- [ ] `rules:changes` skips jobs when relevant files are untouched
- [ ] `workflow:rules` prevents duplicate branch+MR pipelines
- [ ] `timeout` set per job to fail fast
- [ ] `retry:when` limited to infrastructure failures only
- [ ] Docker builds use `--cache-from` or Kaniko `--cache=true`
- [ ] Heavy jobs are tagged to appropriately sized runners

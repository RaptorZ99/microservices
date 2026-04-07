# GitLab CI/CD Troubleshooting Reference

## Table of Contents

1. [Common YAML Errors](#1-common-yaml-errors)
2. [Pipeline Not Running](#2-pipeline-not-running)
3. [Job Failures](#3-job-failures)
4. [Cache Problems](#4-cache-problems)
5. [Artifact Issues](#5-artifact-issues)
6. [Docker and Container Issues](#6-docker-and-container-issues)
7. [Variable and Secret Problems](#7-variable-and-secret-problems)
8. [Runner Issues](#8-runner-issues)
9. [Merge Request Pipeline Issues](#9-merge-request-pipeline-issues)
10. [Performance Diagnosis](#10-performance-diagnosis)
11. [Debugging Techniques](#11-debugging-techniques)
12. [Common Anti-Patterns](#12-common-anti-patterns)

---

## 1. Common YAML Errors

### Tabs vs Spaces

YAML forbids tabs for indentation. Use 2 spaces consistently.

```yaml
# WRONG — tab character before "script"
build:
	script: echo "hello"

# CORRECT — 2 spaces
build:
  script: echo "hello"
```

### Missing `script` or `trigger` Keyword

Every job must have `script:` or `trigger:`. Omitting it produces:
`jobs:name config should implement a script: or a trigger: keyword`

```yaml
# WRONG — no script
test:
  image: node:20
  tags:
    - docker

# CORRECT
test:
  image: node:20
  tags:
    - docker
  script:
    - npm test
```

### Unknown Keyword Errors (Typos)

```yaml
# WRONG — "state" is not a keyword
deploy:
  state: production
  script: ./deploy.sh

# CORRECT
deploy:
  stage: production
  script: ./deploy.sh
```

### Mixing `only/except` with `rules`

A job cannot use both `only/except` and `rules`. GitLab rejects this outright.

```yaml
# WRONG — cannot combine
test:
  only:
    - main
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npm test

# CORRECT — use rules exclusively
test:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npm test
```

### YAML Anchors Not Available Across Included Files

Anchors (`&anchor` / `*anchor`) are a YAML-level feature resolved before GitLab processes includes. An anchor defined in one file cannot be referenced in another included file. Use `extends:` or `!reference` instead.

```yaml
# Instead of anchors across files, use extends:
.shared_config:
  retry:
    max: 2
    when: runner_system_failure

test:
  extends: .shared_config
  script: npm test

# Or use !reference for specific keys
deploy:
  retry: !reference [.shared_config, retry]
  script: ./deploy.sh
```

### Validating `.gitlab-ci.yml`

```bash
# Using glab CLI (recommended for local development)
glab ci lint .gitlab-ci.yml

# With included files resolved
glab ci lint .gitlab-ci.yml --include-jobs

# Using the CI Lint API directly
curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"content": "'"$(cat .gitlab-ci.yml | jq -Rs .)"'"}' \
  "https://gitlab.example.com/api/v4/ci/lint"

# Pipeline editor: navigate to CI/CD > Editor in the GitLab UI
# It validates in real time and shows a merged YAML preview.
```

---

## 2. Pipeline Not Running

### No `workflow:rules` Match

If `workflow:rules` is defined and no rule matches, the entire pipeline is silently skipped.

```yaml
# Problem: pipelines only run for main — feature branches get nothing
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# Fix: add a fallback rule
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_TAG
    - when: never  # explicit deny for everything else
```

### Duplicate Pipelines (Branch + MR)

A push to a branch with an open MR can create two pipelines: one for the branch, one for the MR event. Solve with `workflow:rules`:

```yaml
workflow:
  rules:
    # Run MR pipelines for merge requests
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    # Run branch pipelines only for branches without an open MR
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    # Run branch pipelines for default branch and tags
    - if: $CI_COMMIT_BRANCH
    - if: $CI_COMMIT_TAG
```

### `[skip ci]` in Commit Message

Adding `[skip ci]` or `[ci skip]` anywhere in the commit message prevents pipeline creation. Check your commit message if a pipeline is unexpectedly absent.

### Pipeline Creation Permissions

- Users with at least Developer role can trigger pipelines.
- Protected branches may restrict who can push/trigger.
- Pipeline triggers/webhooks require a valid trigger token.

### Detached Merge Request Pipelines

Detached MR pipelines run on the MR source branch ref, not on the target branch merge result. If you need merge-result pipelines, enable **Merge Pipelines** in project settings under CI/CD.

### Protected Branch Restrictions

Jobs referencing protected variables or protected runners only run on protected branches/tags. If a job silently does nothing on a feature branch, check whether the runner or variables are protected.

---

## 3. Job Failures

### Runner Not Found

`This job is stuck because the project doesn't have any runners online assigned to it.`

```yaml
# Check that tags match an available runner
test:
  tags:
    - docker        # Must match a registered runner's tags exactly
    - linux
  script: npm test
```

Fix: verify runner tags with `glab runner list`, or remove `tags:` to use any shared runner.

### Image Pull Failures

```yaml
# Private registry — authenticate first
test:
  image: registry.example.com/my-team/node:20
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login $CI_REGISTRY -u $CI_REGISTRY_USER --password-stdin
  script: npm test

# Or use CI_REGISTRY built-in auth (GitLab Container Registry)
test:
  image: $CI_REGISTRY_IMAGE/node:20
  script: npm test
```

### Script Errors and Exit Codes

GitLab runs scripts with `set -e` by default in Bash. Any non-zero exit code fails the job.

```yaml
test:
  script:
    # This fails the job if grep finds nothing (exit code 1)
    - grep "pattern" file.txt
    # Fix: allow grep to return non-zero
    - grep "pattern" file.txt || true
    # Or check explicitly
    - |
      if grep -q "pattern" file.txt; then
        echo "Found"
      else
        echo "Not found — but not an error"
      fi
```

### `before_script` Failures Block `script`

If `before_script` fails, `script` never runs. Keep `before_script` minimal and idempotent.

```yaml
test:
  before_script:
    - apt-get update && apt-get install -y curl  # if this fails, script is skipped
  script:
    - curl https://api.example.com/health
```

### `allow_failure` Not Working as Expected

`allow_failure: true` marks a failed job as a warning but does not prevent downstream `needs:` jobs from running. It does **not** change the exit code or retry behavior.

```yaml
lint:
  allow_failure: true          # pipeline stays green even if lint fails
  script: npm run lint

# allow_failure with exit codes (GitLab 15.0+)
test:
  allow_failure:
    exit_codes:
      - 42                     # only exit code 42 is treated as acceptable failure
  script: npm test
```

### Smart Retry for Transient Failures

```yaml
job:
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
      - api_failure
      - scheduler_failure
  script: ./run-tests.sh
```

---

## 4. Cache Problems

### Cache Miss — Key Mismatch

```yaml
# WRONG — cache key changes every pipeline, causing constant misses
test:
  cache:
    key: $CI_PIPELINE_ID
    paths:
      - node_modules/

# CORRECT — cache key tied to lockfile content
test:
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
```

### Cache Not Shared Between Branches

```yaml
# Use prefix + fallback keys so feature branches can read main's cache
test:
  cache:
    key:
      prefix: npm
      files:
        - package-lock.json
    paths:
      - node_modules/
    fallback_keys:
      - npm-default         # falls back if no exact match
    policy: pull-push        # default: read and write
```

### Cache Too Large

Runner storage has limits (varies by runner config). Reduce cache size:

```yaml
test:
  cache:
    key: deps
    paths:
      - .npm/               # cache the npm cache dir, not node_modules
  script:
    - npm ci --cache .npm
```

### Distributed Cache (S3/GCS)

When using autoscaling runners, local disk cache is lost between jobs. Configure distributed cache in the runner's `config.toml`:

```toml
# Runner config.toml — not .gitlab-ci.yml
[runners.cache]
  Type = "s3"
  Shared = true
  [runners.cache.s3]
    ServerAddress = "s3.amazonaws.com"
    BucketName = "gitlab-runner-cache"
    BucketLocation = "us-east-1"
```

### Debugging Cache

Check job logs for `Checking cache for <key>...` and `No URL provided, cache is not downloaded` messages. If the cache is never restored, confirm the key matches and the runner has access.

---

## 5. Artifact Issues

### `artifacts:paths` Not Matching Files

Paths are relative to the project root. Globs must match actual file structure.

```yaml
# WRONG — directory doesn't exist or path is wrong
test:
  script: npm test
  artifacts:
    paths:
      - /tmp/results/        # absolute paths don't work
      - tests/output/*.xml   # glob may not match if files are in subdirs

# CORRECT
test:
  script: npm test -- --outputDir=results
  artifacts:
    paths:
      - results/             # relative to project root
      - "**/*.xml"           # recursive glob
```

### Artifacts Too Large

```yaml
build:
  script: npm run build
  artifacts:
    paths:
      - dist/
    exclude:
      - dist/**/*.map        # exclude source maps to reduce size
    expire_in: 1 week        # always set expiry to avoid filling storage
```

### Artifacts Not Available in Downstream Jobs

With `needs:`, artifacts are only fetched from listed jobs. Without `needs:`, artifacts from all prior-stage jobs are fetched.

```yaml
build:
  stage: build
  script: npm run build
  artifacts:
    paths:
      - dist/

test:
  stage: test
  needs:
    - job: build
      artifacts: true        # explicit — default is true
  script: npm test

deploy:
  stage: deploy
  needs:
    - job: build
      artifacts: true
    - job: test
      artifacts: false       # don't need test artifacts, only build
  script: ./deploy.sh
```

### Artifacts Expired

```yaml
# Default expiry is 30 days (configurable at instance level)
# Set explicit expiry per job
build:
  artifacts:
    paths:
      - dist/
    expire_in: 3 months      # options: 30 mins, 1 day, 1 week, never, etc.
```

---

## 6. Docker and Container Issues

### Docker-in-Docker (DinD) — Correct Setup

```yaml
build-image:
  image: docker:24
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: "/certs"
    DOCKER_TLS_VERIFY: 1
    DOCKER_CERT_PATH: "$DOCKER_TLS_CERTDIR/client"
  before_script:
    - docker info              # verify daemon connectivity
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

The runner must have `privileged = true` in its `config.toml` for DinD to work.

### `Cannot connect to the Docker daemon`

Common causes:
- Missing `docker:dind` service
- `DOCKER_HOST` not set or pointing to wrong address
- Runner not configured with `privileged: true`
- TLS configuration mismatch between client and daemon

```yaml
# Quick fix — disable TLS (less secure, use only for testing)
build-image:
  image: docker:24
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2375
    DOCKER_TLS_CERTDIR: ""
  script:
    - docker build .
```

### Registry Authentication

```yaml
build:
  before_script:
    # GitLab Container Registry (built-in credentials)
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    # External registries — use CI/CD variables for credentials
    - echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USER" --password-stdin
  script:
    - docker pull $CI_REGISTRY_IMAGE:latest || true
    - docker build --cache-from $CI_REGISTRY_IMAGE:latest -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

### Kaniko (Rootless Alternative to DinD)

```yaml
build-kaniko:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.23.0-debug
    entrypoint: [""]
  script:
    - /kaniko/executor
      --context $CI_PROJECT_DIR
      --dockerfile $CI_PROJECT_DIR/Dockerfile
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --cache=true
      --cache-repo=$CI_REGISTRY_IMAGE/cache
  # No privileged runner needed — Kaniko runs in userspace
```

### Multi-Platform Build Issues

```yaml
build-multiarch:
  image: docker:24
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker buildx create --use --driver docker-container
  script:
    - docker buildx build
      --platform linux/amd64,linux/arm64
      --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --push .
```

---

## 7. Variable and Secret Problems

### Variable Not Available

Check these in order:
1. **Scope**: variable may be scoped to a specific environment.
2. **Protected**: variable only available on protected branches/tags.
3. **Masked**: masked variables must be at least 8 characters and match `[a-zA-Z0-9+/=@:.~-]+`.
4. **Pipeline source**: some variables only exist in specific pipeline types.

### Variable Precedence Order (Highest to Lowest)

1. Job-level `variables:`
2. Global `.gitlab-ci.yml` `variables:`
3. Project CI/CD variables
4. Group CI/CD variables
5. Instance CI/CD variables
6. Inherited variables from trigger/parent pipeline

```yaml
variables:
  LOG_LEVEL: "info"          # global default

test:
  variables:
    LOG_LEVEL: "debug"       # job-level overrides global
  script:
    - echo $LOG_LEVEL        # prints "debug"
```

### Protected Variables Not Visible

```yaml
# This job runs on a feature branch — protected vars are NOT injected
deploy:
  script:
    - echo $PROD_API_KEY     # empty on non-protected branches!
  rules:
    - if: $CI_COMMIT_BRANCH == "main"  # main is protected, so vars work here
```

### File-Type Variables

File variables are written to a temporary file; the variable holds the **path**, not the content.

```yaml
deploy:
  script:
    # $KUBECONFIG is a file-type variable — it's a path
    - kubectl --kubeconfig=$KUBECONFIG get pods
    # WRONG — this prints a file path, not file contents
    - echo $KUBECONFIG
    # CORRECT — read the file
    - cat $KUBECONFIG
```

### Debugging Variables Safely

```yaml
debug-vars:
  script:
    # Print non-secret variables
    - echo "CI_COMMIT_BRANCH=$CI_COMMIT_BRANCH"
    - echo "CI_PIPELINE_SOURCE=$CI_PIPELINE_SOURCE"
    # Check if a secret exists without revealing it
    - |
      if [ -n "$SECRET_KEY" ]; then
        echo "SECRET_KEY is set (length: ${#SECRET_KEY})"
      else
        echo "SECRET_KEY is NOT set"
      fi
```

---

## 8. Runner Issues

### `no matching runner`

```yaml
# Diagnose: list available runners and their tags
# glab runner list

# Fix: remove tags to use any shared runner
test:
  # tags:                    # commented out — use any available runner
  script: npm test

# Or ensure tags match exactly
test:
  tags:
    - saas-linux-medium-amd64  # GitLab.com shared runner tag
  script: npm test
```

### Runner Out of Disk Space

Add cleanup steps or configure Docker garbage collection in runner config:

```toml
# Runner config.toml
[runners.docker]
  # Automatically remove containers/images after job
  privileged = true
  disable_cache = false
  volumes = ["/cache"]
  # Prune dangling images
  [runners.docker.tmpfs]
    "/tmp" = "rw,noexec"
```

```yaml
# Manual cleanup in CI
cleanup:
  stage: .post
  script:
    - docker system prune -af --volumes || true
  when: always
```

### Runner Timeout

```yaml
# Job-level timeout (overrides runner default)
long-test:
  timeout: 3h 30m
  script: ./run-e2e-tests.sh

# For the runner itself, set in config.toml:
# [runners]
#   executor = "docker"
#   limit = 10
#   request_concurrency = 5
```

### Concurrent Job Limits

If jobs queue for long periods, the runner's `concurrent` setting may be too low. Check `config.toml`:

```toml
# config.toml
concurrent = 10   # max parallel jobs across all runners in this config
```

---

## 9. Merge Request Pipeline Issues

### `$CI_MERGE_REQUEST_IID` Not Available

This variable only exists in MR pipelines (`merge_request_event` source). Branch pipelines do not have it.

```yaml
# WRONG — fails on branch pipelines
test:
  script:
    - echo "MR !$CI_MERGE_REQUEST_IID"  # empty on branch push
  rules:
    - if: $CI_COMMIT_BRANCH             # branch pipeline, no MR vars

# CORRECT — only reference MR vars in MR pipelines
test:
  script:
    - echo "MR !$CI_MERGE_REQUEST_IID"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### MR Pipeline vs Branch Pipeline Confusion

Use `workflow:rules` to pick one or the other, not both (see Section 2).

### Fork Pipelines and Permissions

Forks cannot access the parent project's CI/CD variables by default. Enable **Run pipelines in the parent project for merge requests from forked projects** under Settings > CI/CD > Pipelines if needed. Be cautious — this exposes secrets to fork contributors.

### Merge Train Failures

Merge trains run pipelines on the result of merging each MR sequentially. If one MR in the train fails, all subsequent MRs are re-queued.

```yaml
# Ensure merge train jobs are fast
merge-train-test:
  rules:
    - if: $CI_MERGE_REQUEST_EVENT_TYPE == "merge_train"
  script: npm run test:fast
  interruptible: true          # allow newer trains to cancel stale runs
```

---

## 10. Performance Diagnosis

### Identifying Slow Stages

- Use the pipeline graph in GitLab UI to visually spot long-running jobs.
- Check the pipeline duration breakdown in CI/CD > Pipelines.
- Use `needs:` DAG to parallelize jobs that don't depend on each other.

### Large Repository Clone Times

```yaml
variables:
  GIT_DEPTH: 20                    # shallow clone — only last 20 commits
  GIT_STRATEGY: fetch              # reuse existing repo if runner supports it
  GIT_CLEAN_FLAGS: -ffdx -e .cache # clean but preserve local cache directories

# For very large repos, consider sparse checkout
test:
  variables:
    GIT_STRATEGY: clone
    GIT_DEPTH: 1
    GIT_SUBMODULE_STRATEGY: none
  before_script:
    - git sparse-checkout init --cone
    - git sparse-checkout set src/ tests/
  script: npm test
```

### Network-Related Slowdowns

```yaml
# Use a local mirror or proxy for package registries
install:
  variables:
    NPM_CONFIG_REGISTRY: "https://npm-cache.internal.example.com/"
    PIP_INDEX_URL: "https://pypi-cache.internal.example.com/simple/"
  script:
    - npm ci
```

### Artifact Upload/Download Times

- Compress artifacts: GitLab compresses by default, but exclude unnecessary files.
- Use `needs:` to only download artifacts you actually need.
- Set short `expire_in` to reduce storage overhead.

---

## 11. Debugging Techniques

### `CI_DEBUG_TRACE` (Verbose Logging)

```yaml
debug-job:
  variables:
    CI_DEBUG_TRACE: "true"     # WARNING: prints ALL variables including secrets!
  script:
    - echo "This job has extremely verbose output"
```

**Never enable `CI_DEBUG_TRACE` on production pipelines** — it logs the full environment, including masked secrets.

### Collecting Diagnostics on Failure

```yaml
test:
  script:
    - npm test
  after_script:
    # after_script runs even if script fails
    - |
      if [ "$CI_JOB_STATUS" == "failed" ]; then
        echo "=== DIAGNOSTICS ==="
        df -h
        free -m
        docker ps -a 2>/dev/null || true
        cat /var/log/syslog 2>/dev/null | tail -50 || true
      fi
  artifacts:
    when: on_failure           # only upload artifacts if the job fails
    paths:
      - test-results/
      - screenshots/
      - "**/*.log"
    expire_in: 1 week
```

### Interactive Web Terminal

If the runner supports it (shell or Docker executor, not Kubernetes by default):

```yaml
debug-session:
  stage: test
  script:
    - echo "Connect to the web terminal in the GitLab UI to debug interactively"
    - sleep 3600               # keep the job alive for terminal access
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == "debug"
```

Navigate to the job page and click the "Debug" terminal button.

### Local Runner Testing

```bash
# gitlab-runner exec is deprecated but still useful for quick local checks
gitlab-runner exec docker test \
  --docker-image node:20 \
  --env "CI_PROJECT_DIR=/builds/project"

# Better alternative: use glab ci run to trigger a pipeline for testing
glab ci run --branch feature-branch
```

---

## 12. Common Anti-Patterns

### Using `only/except` Instead of `rules`

`only/except` is legacy. `rules` provides more control and clarity.

```yaml
# ANTI-PATTERN
test:
  only:
    - main
    - merge_requests
  script: npm test

# BETTER
test:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: npm test
```

### Not Setting `expire_in` on Artifacts

Artifacts without expiry consume storage indefinitely.

```yaml
# ANTI-PATTERN — artifacts persist forever
build:
  artifacts:
    paths:
      - dist/

# BETTER
build:
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
```

### Caching Build Outputs Instead of Dependencies

```yaml
# ANTI-PATTERN — caching compiled output is fragile
build:
  cache:
    paths:
      - dist/           # build output changes every commit — poor cache hit rate

# BETTER — cache dependency install artifacts
build:
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/   # dependencies change less often — better hit rate
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/            # use artifacts for build output, not cache
```

### Running All Jobs on Every Pipeline

```yaml
# ANTI-PATTERN — docs lint runs even when no docs changed
docs-lint:
  script: markdownlint docs/

# BETTER — only run when relevant files change
docs-lint:
  rules:
    - changes:
        - "docs/**/*"
        - "*.md"
  script: markdownlint docs/
```

### Hardcoding `main` Instead of `$CI_DEFAULT_BRANCH`

```yaml
# ANTI-PATTERN — breaks if default branch is renamed
deploy:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# BETTER — works regardless of default branch name
deploy:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Hiding Real Failures with `allow_failure: true`

```yaml
# ANTI-PATTERN — masking a consistently failing test
integration-test:
  allow_failure: true    # "it always fails, just ignore it"
  script: npm run test:integration

# BETTER — fix the test, or scope allow_failure to specific exit codes
integration-test:
  allow_failure:
    exit_codes:
      - 2               # only allow known flaky exit code
  script: npm run test:integration
```

### Not Using `interruptible: true`

```yaml
# ANTI-PATTERN — stale pipelines waste runner resources
test:
  script: npm test       # keeps running even after a new push

# BETTER — auto-cancel on newer pipeline
test:
  interruptible: true    # GitLab cancels this if a newer pipeline starts
  script: npm test
```

### Monolithic Pipelines Instead of Parent-Child

For large projects, a single `.gitlab-ci.yml` becomes unmaintainable. Use parent-child pipelines:

```yaml
# Parent pipeline — .gitlab-ci.yml
stages:
  - triggers

frontend:
  stage: triggers
  trigger:
    include: frontend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - "frontend/**/*"

backend:
  stage: triggers
  trigger:
    include: backend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - "backend/**/*"
```

---

## Quick Reference: Diagnostic Commands

```bash
# Validate CI config locally
glab ci lint .gitlab-ci.yml

# Check pipeline status
glab ci status

# View job logs
glab ci trace <job-id>

# List runners available to the project
glab runner list

# Retry a failed pipeline
glab ci retry <pipeline-id>

# Run a new pipeline on current branch
glab ci run
```

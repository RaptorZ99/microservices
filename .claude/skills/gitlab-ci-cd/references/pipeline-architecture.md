# Pipeline Architecture Reference

Expert-level reference for GitLab CI/CD pipeline design patterns and architecture decisions.

## Table of Contents

1. [Stage-Based vs DAG Pipelines](#1-stage-based-vs-dag-pipelines)
2. [Workflow Rules](#2-workflow-rules)
3. [Parent-Child Pipelines](#3-parent-child-pipelines)
4. [Multi-Project Pipelines](#4-multi-project-pipelines)
5. [Merge Trains](#5-merge-trains)
6. [Pipeline Types and Sources](#6-pipeline-types-and-sources)
7. [Resource Groups](#7-resource-groups)
8. [Pipeline Patterns by Project Type](#8-pipeline-patterns-by-project-type)

---

## 1. Stage-Based vs DAG Pipelines

### Traditional Stage-Based Model

Jobs within a stage run in parallel. The next stage starts only after all jobs in the current stage finish. A slow job in stage N blocks everything in stage N+1, even if most jobs in N are done.

```yaml
stages:
  - build
  - test
  - deploy

build-frontend:
  stage: build
  script: npm run build --prefix frontend

build-backend:
  stage: build
  script: ./gradlew assemble

# Both test jobs wait for BOTH build jobs to finish
test-frontend:
  stage: test
  script: npm test --prefix frontend

test-backend:
  stage: test
  script: ./gradlew test

deploy:
  stage: deploy
  script: ./deploy.sh
```

Problem: `test-frontend` waits for `build-backend` even though it has no dependency on it.

### DAG with `needs`

The `needs` keyword declares explicit job dependencies, allowing jobs to start as soon as their actual prerequisites finish.

```yaml
stages:
  - build
  - test
  - deploy

build-frontend:
  stage: build
  script: npm run build --prefix frontend
  artifacts:
    paths: [frontend/dist/]

build-backend:
  stage: build
  script: ./gradlew assemble
  artifacts:
    paths: [build/libs/]

# Starts as soon as build-frontend finishes, does NOT wait for build-backend
test-frontend:
  stage: test
  needs: [build-frontend]
  script: npm test --prefix frontend

# Starts as soon as build-backend finishes
test-backend:
  stage: test
  needs: [build-backend]
  script: ./gradlew test

deploy:
  stage: deploy
  needs: [test-frontend, test-backend]
  script: ./deploy.sh
```

### Hybrid Approach (Recommended)

Keep `stages` for visual grouping in the UI. Use `needs` to define the real execution graph. This gives you fast pipelines with a clear visual layout.

```yaml
stages:
  - build
  - test
  - integration
  - deploy

build-api:
  stage: build
  script: make build-api

build-web:
  stage: build
  script: make build-web

unit-api:
  stage: test
  needs: [build-api]
  script: make test-api

unit-web:
  stage: test
  needs: [build-web]
  script: make test-web

lint:
  stage: test
  needs: []          # No dependencies; starts immediately
  script: make lint

integration:
  stage: integration
  needs: [unit-api, unit-web]
  script: make integration-test

deploy-staging:
  stage: deploy
  needs: [integration, lint]
  script: make deploy-staging
```

Key details:
- `needs: []` means "no dependencies" -- the job starts immediately when the pipeline is created.
- `needs` only downloads artifacts from listed jobs by default. Use `artifacts: false` on a needs entry to skip artifact download.
- Maximum of 50 entries in `needs` per job.

---

## 2. Workflow Rules

### Preventing Duplicate Pipelines

The most common problem: a push to a branch with an open MR creates two pipelines (one for push, one for MR). Fix this with `workflow:rules`.

```yaml
workflow:
  rules:
    # Run for merge requests
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    # Run for the default branch (after merge)
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    # Run for tags
    - if: $CI_COMMIT_TAG
    # Run for scheduled pipelines
    - if: $CI_PIPELINE_SOURCE == "schedule"
    # Run for web/api triggers
    - if: $CI_PIPELINE_SOURCE == "web"
    # Block everything else (prevents branch push duplicates)
```

### Conditional Pipelines Based on File Changes

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - src/**/*
        - package.json
        - .gitlab-ci.yml
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
```

### Pipeline Variables from Workflow Rules

Set variables at the pipeline level based on conditions:

```yaml
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      variables:
        DEPLOY_ENV: "production"
        RUN_FULL_SUITE: "true"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      variables:
        DEPLOY_ENV: "review"
        RUN_FULL_SUITE: "false"
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
      variables:
        DEPLOY_ENV: "production"
        IS_RELEASE: "true"
```

### Complete Workflow Pattern

```yaml
workflow:
  rules:
    # Merge request pipelines (primary development flow)
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      variables:
        PIPELINE_TYPE: "mr"
    # Default branch after merge
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      variables:
        PIPELINE_TYPE: "default"
    # Semantic version tags
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+/
      variables:
        PIPELINE_TYPE: "release"
    # Scheduled (nightly, weekly)
    - if: $CI_PIPELINE_SOURCE == "schedule"
      variables:
        PIPELINE_TYPE: "scheduled"
    # Manual web triggers
    - if: $CI_PIPELINE_SOURCE == "web"
      variables:
        PIPELINE_TYPE: "manual"

# Use PIPELINE_TYPE in job rules:
nightly-cleanup:
  rules:
    - if: $PIPELINE_TYPE == "scheduled"
  script: ./cleanup.sh

publish:
  rules:
    - if: $PIPELINE_TYPE == "release"
  script: ./publish.sh
```

---

## 3. Parent-Child Pipelines

### Basic Parent-Child with `trigger:include`

Parent pipelines spawn child pipelines from YAML files in the same repository. Each child pipeline has its own status, jobs, and stages.

```yaml
# .gitlab-ci.yml (parent)
stages:
  - triggers

trigger-frontend:
  stage: triggers
  trigger:
    include: frontend/.gitlab-ci.yml
    strategy: depend        # Parent waits for child to finish

trigger-backend:
  stage: triggers
  trigger:
    include: backend/.gitlab-ci.yml
    strategy: depend
```

```yaml
# frontend/.gitlab-ci.yml (child)
stages:
  - build
  - test

build:
  stage: build
  script: npm ci && npm run build

test:
  stage: test
  script: npm test
```

### Passing Variables to Child Pipelines

```yaml
trigger-deploy:
  stage: triggers
  variables:
    ENVIRONMENT: staging
    VERSION: $CI_COMMIT_SHORT_SHA
  trigger:
    include: deploy/.gitlab-ci.yml
    strategy: depend
```

### Dynamic Child Pipelines

Generate a child pipeline YAML file at runtime. Useful for monorepos where you only want to build changed services.

```yaml
stages:
  - generate
  - trigger

detect-changes:
  stage: generate
  script: |
    python3 scripts/generate-pipeline.py > child-pipeline.yml
  artifacts:
    paths:
      - child-pipeline.yml

run-dynamic:
  stage: trigger
  trigger:
    include:
      - artifact: child-pipeline.yml
        job: detect-changes
    strategy: depend
```

### Complete Monorepo Pattern

```yaml
# .gitlab-ci.yml (parent)
stages:
  - detect
  - trigger

detect-changes:
  stage: detect
  image: alpine:3.19
  script: |
    apk add --no-cache git
    CHANGED=$(git diff --name-only $CI_MERGE_REQUEST_DIFF_BASE_SHA...$CI_COMMIT_SHA)
    echo "FRONTEND_CHANGED=false" > changes.env
    echo "BACKEND_CHANGED=false" >> changes.env
    echo "INFRA_CHANGED=false" >> changes.env
    echo "$CHANGED" | grep -q "^frontend/" && echo "FRONTEND_CHANGED=true" >> changes.env || true
    echo "$CHANGED" | grep -q "^backend/" && echo "BACKEND_CHANGED=true" >> changes.env || true
    echo "$CHANGED" | grep -q "^infra/" && echo "INFRA_CHANGED=true" >> changes.env || true
  artifacts:
    reports:
      dotenv: changes.env
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

trigger-frontend:
  stage: trigger
  needs: [detect-changes]
  trigger:
    include: frontend/.gitlab-ci.yml
    strategy: depend
  rules:
    - if: $FRONTEND_CHANGED == "true"

trigger-backend:
  stage: trigger
  needs: [detect-changes]
  trigger:
    include: backend/.gitlab-ci.yml
    strategy: depend
  rules:
    - if: $BACKEND_CHANGED == "true"

trigger-infra:
  stage: trigger
  needs: [detect-changes]
  trigger:
    include: infra/.gitlab-ci.yml
    strategy: depend
  rules:
    - if: $INFRA_CHANGED == "true"
```

### Strategy: `depend` vs Default

- **`strategy: depend`** -- parent job mirrors the child pipeline's status. If the child fails, the parent job fails. Use this when the child result matters.
- **No strategy (default)** -- parent job succeeds as soon as the child pipeline is created. Parent does not wait. Use for fire-and-forget triggers.

---

## 4. Multi-Project Pipelines

### Triggering a Downstream Project

```yaml
deploy-service:
  stage: deploy
  trigger:
    project: my-group/deployment-project
    branch: main
    strategy: depend
  variables:
    UPSTREAM_PROJECT: $CI_PROJECT_PATH
    UPSTREAM_SHA: $CI_COMMIT_SHA
    SERVICE_NAME: "my-service"
    IMAGE_TAG: $CI_COMMIT_SHORT_SHA
```

### Cross-Project Dependencies

The downstream pipeline can reference the upstream pipeline via predefined variables: `$CI_UPSTREAM_PIPELINE_ID`, `$CI_UPSTREAM_PROJECT_PATH`.

```yaml
# In the downstream project's .gitlab-ci.yml
download-artifact:
  stage: prepare
  script: |
    curl --header "PRIVATE-TOKEN: $API_TOKEN" \
      "$CI_API_V4_URL/projects/${UPSTREAM_PROJECT_ID}/jobs/artifacts/${UPSTREAM_REF}/download?job=build" \
      -o artifacts.zip
    unzip artifacts.zip
```

### Mirroring Status

With `strategy: depend`, the upstream trigger job reflects the downstream pipeline's status. Without it, the upstream job succeeds immediately and you must poll or use webhooks.

```yaml
trigger-deploy:
  trigger:
    project: ops/deploy-pipeline
    strategy: depend      # Upstream waits and mirrors status
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 5. Merge Trains

### How Merge Trains Work

Merge trains sequentially merge MRs, running the pipeline on each merged result in order. If MR #2 is in the train behind MR #1, the pipeline for MR #2 runs against the result of merging MR #1 into the target branch. If MR #1 fails, MR #2 is automatically re-queued.

### Configuration

Enable in project settings: **Settings > Merge requests > Merge trains**.

In `.gitlab-ci.yml`, jobs must support merged-result pipelines:

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

test:
  script: make test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Detecting Merge Train Context

```yaml
deploy-review:
  script: ./deploy-review.sh
  rules:
    # Skip heavy deploys inside merge trains -- only run tests
    - if: $CI_MERGE_REQUEST_EVENT_TYPE == "merged_result"
      when: never
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

Key variable values for `$CI_MERGE_REQUEST_EVENT_TYPE`:
- `detached` -- standard MR pipeline (runs on source branch HEAD)
- `merged_result` -- merged result pipeline (runs on simulated merge)
- `merge_train` -- merge train pipeline

### When to Use Merge Trains

Use when:
- High-velocity projects with many concurrent MRs
- Main branch protection is critical (no broken builds)
- CI is fast enough (merge trains add latency per MR)

Avoid when:
- Pipelines are slow (>20 minutes); trains become a bottleneck
- Low MR volume; regular merged-result pipelines suffice

---

## 6. Pipeline Types and Sources

### `$CI_PIPELINE_SOURCE` Values

| Value | Trigger |
|---|---|
| `push` | Git push to a branch |
| `merge_request_event` | MR created, updated, or reopened |
| `schedule` | Scheduled pipeline |
| `trigger` | Trigger token (legacy) |
| `api` | Pipeline API call |
| `web` | "Run pipeline" button in UI |
| `pipeline` | Multi-project trigger (`trigger:project`) |
| `parent_pipeline` | Parent-child trigger (`trigger:include`) |
| `ondemand_dast_scan` | DAST on-demand scan |

### Using Pipeline Source in Rules

```yaml
# Full test suite on push/MR; smoke tests on schedule
test:
  script: make test
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      variables:
        TEST_SUITE: "smoke"
    - if: $CI_PIPELINE_SOURCE =~ /push|merge_request_event/
      variables:
        TEST_SUITE: "full"

# Nightly security scan
security-scan:
  script: ./run-security-scan.sh
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_TYPE == "nightly"

# Allow manual re-runs from the UI
full-rebuild:
  script: make clean && make build
  rules:
    - if: $CI_PIPELINE_SOURCE == "web"
```

### Scheduled Pipelines for Periodic Tasks

Configure schedules in **CI/CD > Schedules**. Pass custom variables to distinguish schedule types.

```yaml
# Schedule 1: SCHEDULE_TYPE=nightly, runs at 2am
# Schedule 2: SCHEDULE_TYPE=weekly_cleanup, runs Sunday 4am

nightly-build:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_TYPE == "nightly"
  script: make build && make integration-test

weekly-cleanup:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_TYPE == "weekly_cleanup"
  script: ./scripts/cleanup-old-artifacts.sh && ./scripts/prune-registry.sh
```

---

## 7. Resource Groups

### Deployment Serialization

`resource_group` ensures only one job using that resource group runs at a time. Essential for preventing concurrent deployments to the same environment.

```yaml
deploy-staging:
  stage: deploy
  resource_group: staging
  script: ./deploy.sh staging
  environment:
    name: staging

deploy-production:
  stage: deploy
  resource_group: production
  script: ./deploy.sh production
  environment:
    name: production
```

### Process Modes

Control which queued job runs next when the current job finishes:

```yaml
deploy-production:
  resource_group: production
  # process_mode is set in the API, not in YAML.
  # Configure via: PUT /projects/:id/resource_groups/:key
  # { "process_mode": "newest_first" }
  script: ./deploy.sh
```

| Mode | Behavior |
|---|---|
| `unordered` | No guaranteed order (default) |
| `oldest_first` | FIFO queue; processes jobs in creation order |
| `newest_first` | Only the most recent waiting job runs; older queued jobs are skipped. Best for deployments where only the latest code matters. |

### Practical Pattern: Environment-Scoped Resource Groups

```yaml
.deploy_template:
  script: ./deploy.sh $DEPLOY_ENV
  resource_group: deploy-$DEPLOY_ENV

deploy-staging:
  extends: .deploy_template
  variables:
    DEPLOY_ENV: staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-production:
  extends: .deploy_template
  variables:
    DEPLOY_ENV: production
  when: manual
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
```

---

## 8. Pipeline Patterns by Project Type

### Microservices Monorepo

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

stages:
  - detect
  - build
  - test
  - deploy

.service_template:
  variables:
    DOCKER_IMAGE: $CI_REGISTRY_IMAGE/$SERVICE_NAME:$CI_COMMIT_SHORT_SHA
  rules:
    - changes:
        - $SERVICE_NAME/**/*
        - shared-libs/**/*

detect-services:
  stage: detect
  image: alpine/git
  script: |
    git diff --name-only $CI_MERGE_REQUEST_DIFF_BASE_SHA...$CI_COMMIT_SHA \
      | cut -d/ -f1 | sort -u | tee changed-services.txt
  artifacts:
    paths: [changed-services.txt]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

build-auth:
  stage: build
  extends: .service_template
  variables:
    SERVICE_NAME: auth-service
  script: docker build -t $DOCKER_IMAGE $SERVICE_NAME/

build-api:
  stage: build
  extends: .service_template
  variables:
    SERVICE_NAME: api-gateway
  script: docker build -t $DOCKER_IMAGE $SERVICE_NAME/
```

### Library/Package with Semantic Release

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG =~ /^v\d+/

stages:
  - validate
  - test
  - publish

lint:
  stage: validate
  needs: []
  script: npm run lint

test:
  stage: test
  script: npm test
  coverage: '/Lines\s+:\s+(\d+\.\d+)%/'
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

publish:
  stage: publish
  script: |
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
    npm publish --access public
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
```

### Docker Image Build and Push

```yaml
stages:
  - build
  - scan
  - push

variables:
  IMAGE_NAME: $CI_REGISTRY_IMAGE
  IMAGE_TAG: $CI_COMMIT_SHORT_SHA

build:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  variables:
    DOCKER_BUILDKIT: "1"
  script: |
    docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    docker build \
      --cache-from $IMAGE_NAME:latest \
      --build-arg BUILDKIT_INLINE_CACHE=1 \
      -t $IMAGE_NAME:$IMAGE_TAG \
      -t $IMAGE_NAME:latest \
      .
    docker push $IMAGE_NAME:$IMAGE_TAG

container-scan:
  stage: scan
  needs: [build]
  image:
    name: aquasec/trivy:latest
    entrypoint: [""]
  script: |
    trivy image --exit-code 1 --severity HIGH,CRITICAL \
      $IMAGE_NAME:$IMAGE_TAG

push-latest:
  stage: push
  needs: [container-scan]
  image: docker:27
  services:
    - docker:27-dind
  script: |
    docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    docker pull $IMAGE_NAME:$IMAGE_TAG
    docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
    docker push $IMAGE_NAME:latest
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Infrastructure as Code (Terraform/OpenTofu)

```yaml
stages:
  - validate
  - plan
  - apply

variables:
  TF_ROOT: infra/
  TF_STATE_NAME: $CI_ENVIRONMENT_SLUG

.tofu_template:
  image: ghcr.io/opentofu/opentofu:1.8
  before_script:
    - cd $TF_ROOT
    - tofu init
      -backend-config="address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}"
      -backend-config="lock_address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}/lock"
      -backend-config="unlock_address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}/lock"
      -backend-config="username=gitlab-ci-token"
      -backend-config="password=$CI_JOB_TOKEN"
      -backend-config="lock_method=POST"
      -backend-config="unlock_method=DELETE"
      -backend-config="retry_wait_min=5"

validate:
  stage: validate
  extends: .tofu_template
  script: tofu validate

plan:
  stage: plan
  extends: .tofu_template
  script: |
    tofu plan -out=plan.cache
    tofu show -json plan.cache > plan.json
  artifacts:
    paths:
      - $TF_ROOT/plan.cache
    reports:
      terraform: $TF_ROOT/plan.json
  resource_group: $TF_STATE_NAME

apply:
  stage: apply
  extends: .tofu_template
  script: tofu apply plan.cache
  dependencies: [plan]
  resource_group: $TF_STATE_NAME
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
  environment:
    name: $TF_STATE_NAME
```

### Mobile App (iOS/Android) with Signing

```yaml
stages:
  - build
  - test
  - sign
  - distribute

variables:
  FLUTTER_VERSION: "3.24"

.mobile_base:
  before_script:
    - flutter pub get

build-android:
  extends: .mobile_base
  stage: build
  tags: [linux, docker]
  image: ghcr.io/cirruslabs/flutter:$FLUTTER_VERSION
  script: flutter build apk --release --build-number=$CI_PIPELINE_IID
  artifacts:
    paths:
      - build/app/outputs/flutter-apk/app-release.apk

build-ios:
  extends: .mobile_base
  stage: build
  tags: [macos, xcode]     # Must run on macOS runner
  script: |
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" login.keychain
    flutter build ipa --release --build-number=$CI_PIPELINE_IID \
      --export-options-plist=ios/ExportOptions.plist
  artifacts:
    paths:
      - build/ios/ipa/*.ipa

test:
  extends: .mobile_base
  stage: test
  image: ghcr.io/cirruslabs/flutter:$FLUTTER_VERSION
  needs: []
  script: flutter test --coverage
  coverage: '/lines......: (\d+\.\d+)%/'

sign-android:
  stage: sign
  needs: [build-android]
  script: |
    echo "$ANDROID_KEYSTORE" | base64 -d > keystore.jks
    jarsigner -keystore keystore.jks \
      -storepass "$KEYSTORE_PASSWORD" \
      -keypass "$KEY_PASSWORD" \
      build/app/outputs/flutter-apk/app-release.apk "$KEY_ALIAS"
  artifacts:
    paths:
      - build/app/outputs/flutter-apk/app-release.apk

distribute-firebase:
  stage: distribute
  needs: [sign-android, build-ios, test]
  script: |
    firebase appdistribution:distribute \
      build/app/outputs/flutter-apk/app-release.apk \
      --app "$FIREBASE_APP_ID_ANDROID" \
      --groups "internal-testers"
    firebase appdistribution:distribute \
      build/ios/ipa/*.ipa \
      --app "$FIREBASE_APP_ID_IOS" \
      --groups "internal-testers"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  environment:
    name: firebase-distribution
```

# Templates & Components Reference

## Table of Contents

1. [The `include` Keyword](#1-the-include-keyword)
2. [The `extends` Keyword](#2-the-extends-keyword)
3. [YAML Anchors and Aliases](#3-yaml-anchors-and-aliases)
4. [CI/CD Components Catalog](#4-cicd-components-catalog)
5. [Project Templates](#5-project-templates)
6. [Auto DevOps](#6-auto-devops)
7. [`default` Keyword](#7-default-keyword)
8. [Design Patterns for Reusability](#8-design-patterns-for-reusability)
9. [Migration Patterns](#9-migration-patterns)

---

## 1. The `include` Keyword

Include merges external YAML into the pipeline configuration at evaluation time.
GitLab resolves includes before the pipeline is created, so included content
behaves as if it were written inline.

### `include:local` -- files from the same project

```yaml
include:
  - local: '.gitlab/ci/build.yml'
  - local: '.gitlab/ci/test.yml'
  - local: '.gitlab/ci/deploy.yml'
```

Paths are relative to the project root. The file must exist on the same ref
(branch/tag) that triggered the pipeline.

### `include:file` -- files from other projects

```yaml
include:
  - project: 'my-group/ci-templates'
    ref: 'v2.1.0'
    file: '/templates/docker-build.yml'

  # Multiple files from the same project
  - project: 'my-group/ci-templates'
    ref: main
    file:
      - '/templates/lint.yml'
      - '/templates/sast.yml'
```

Always pin `ref` to a tag or SHA for stability. Using `main` means your pipeline
can break when the template project pushes a change.

### `include:remote` -- files from a URL

```yaml
include:
  - remote: 'https://example.com/ci/shared-pipeline.yml'
```

The URL must be publicly accessible (or accessible from the runner's network).
Remote includes cannot use authentication headers. Prefer `include:file` for
private GitLab projects.

### `include:template` -- GitLab-provided templates

```yaml
include:
  - template: 'Security/SAST.gitlab-ci.yml'
  - template: 'Jobs/Build.gitlab-ci.yml'
  - template: 'Auto-DevOps.gitlab-ci.yml'
```

Templates ship with every GitLab release. Find the full list at
`https://gitlab.com/gitlab-org/gitlab/-/tree/master/lib/gitlab/ci/templates`.

### `include:component` -- CI/CD catalog components

```yaml
include:
  - component: 'gitlab.com/my-org/components/go@1.0.0'
    inputs:
      go_version: "1.22"
      stage: test
```

Components are versioned, parameterized, and published to the CI/CD catalog.
The `@` suffix pins the version (tag, branch, or SHA).

### Include with `rules` -- conditional includes

```yaml
include:
  - local: '.gitlab/ci/deploy-production.yml'
    rules:
      - if: '$CI_COMMIT_BRANCH == "main"'

  - local: '.gitlab/ci/deploy-staging.yml'
    rules:
      - if: '$CI_COMMIT_BRANCH == "develop"'

  - local: '.gitlab/ci/security-scan.yml'
    rules:
      - if: '$CI_PIPELINE_SOURCE == "schedule"'
      - if: '$CI_COMMIT_TAG'
```

When `rules` evaluate to false the entire file is skipped -- none of its jobs
are added to the pipeline.

### Include with `inputs` -- parameterized includes

```yaml
# In the included file (reusable-deploy.yml):
spec:
  inputs:
    environment:
      description: "Target environment"
    replicas:
      type: number
      default: 2
    enable_canary:
      type: boolean
      default: false
---
deploy:
  stage: deploy
  script:
    - helm upgrade --set replicas=$[[ inputs.replicas ]] app ./chart
  environment:
    name: $[[ inputs.environment ]]
```

```yaml
# In .gitlab-ci.yml:
include:
  - local: '.gitlab/ci/reusable-deploy.yml'
    inputs:
      environment: production
      replicas: 5
      enable_canary: true
```

### Nested includes

Included files can themselves contain `include` directives. GitLab resolves
them recursively up to a maximum depth of 150. Keep nesting shallow to avoid
confusion and hitting the limit.

### Include ordering and override behavior

When the same job name appears in multiple included files or in the main
`.gitlab-ci.yml`, the **last definition wins** via deep merge. Keys in the
later definition override keys in earlier ones; keys not present in the later
definition are preserved from earlier ones.

Resolution order:
1. Included files are processed top to bottom.
2. Nested includes are resolved before continuing to the next sibling.
3. The main `.gitlab-ci.yml` content is applied last and overrides everything.

```yaml
# If both templates define "build" job, the second overrides the first,
# and .gitlab-ci.yml overrides both.
include:
  - local: '.gitlab/ci/build-base.yml'    # processed first
  - local: '.gitlab/ci/build-custom.yml'  # overrides build-base

build:  # overrides everything above
  script:
    - make build
```

---

## 2. The `extends` Keyword

### Inheriting job configuration

```yaml
.base-deploy:
  image: alpine:3.19
  before_script:
    - apk add --no-cache curl
  tags:
    - docker

deploy-staging:
  extends: .base-deploy
  stage: deploy
  script:
    - deploy --env staging
  environment:
    name: staging
```

### Multi-level extends

```yaml
.base:
  tags:
    - docker

.base-test:
  extends: .base
  image: node:20
  before_script:
    - npm ci

unit-test:
  extends: .base-test
  script:
    - npm run test:unit

integration-test:
  extends: .base-test
  script:
    - npm run test:integration
```

GitLab resolves the full chain and merges from the top down. Up to 11 levels
of nesting are supported.

### Override behavior (merge vs replace)

Hash (map) keys are **deep merged**. Array (list) keys are **replaced entirely**.

```yaml
.base:
  variables:
    APP_ENV: development
    LOG_LEVEL: debug
  script:
    - echo "base step 1"
    - echo "base step 2"

production:
  extends: .base
  variables:
    APP_ENV: production     # overrides APP_ENV; LOG_LEVEL is preserved
  script:
    - echo "prod step only" # replaces the entire script array
```

### Hidden jobs as base templates

Any job prefixed with `.` is hidden -- it never runs but can be referenced by
`extends`. Use hidden jobs to define reusable fragments.

```yaml
.docker-build-template:
  image: docker:latest
  services:
    - docker:dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY
```

### `extends` vs YAML anchors

| Aspect              | `extends`                        | YAML anchors           |
|----------------------|----------------------------------|------------------------|
| Scope                | Works across `include` files     | File-scoped only       |
| Merge behavior       | Deep merge with override         | Shallow merge via `<<` |
| Readability          | Explicit, named                  | Symbolic, compact      |
| Multi-level          | Up to 11 levels                  | Unlimited nesting      |
| GitLab awareness     | Resolved by GitLab CI engine     | Resolved by YAML parser|

**Rule of thumb:** Use `extends` for cross-file and multi-job inheritance. Use
anchors for small, same-file value reuse.

---

## 3. YAML Anchors and Aliases

### Definition and reference

```yaml
variables:
  POSTGRES_DB: &default_db "myapp_test"

test-unit:
  variables:
    DB_NAME: *default_db   # resolves to "myapp_test"
```

### Merge key for maps

```yaml
.default_retry: &default_retry
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure

.default_cache: &default_cache
  cache:
    key: "${CI_COMMIT_REF_SLUG}"
    paths:
      - node_modules/
    policy: pull

test:
  <<: *default_retry
  <<: *default_cache       # NOTE: duplicate << keys -- use array form instead
  script:
    - npm test

# Correct way to merge multiple anchors:
test:
  <<: [*default_retry, *default_cache]
  script:
    - npm test
```

### Limitations

Anchors are resolved by the YAML parser **before** GitLab processes includes.
An anchor defined in `build.yml` cannot be referenced from `test.yml` even if
both are included in the same pipeline. This is the primary reason to prefer
`extends` for cross-file reuse.

### When anchors are better than `extends`

- Reusing a single scalar value (a version string, image tag, path).
- Sharing a small map fragment within the same file.
- Avoiding the overhead of hidden jobs for trivial reuse.

### When `extends` is better than anchors

- Sharing configuration across multiple files via `include`.
- Deep merging of complex job configurations.
- Making inheritance explicit and visible in the merged YAML view in the
  GitLab pipeline editor.

---

## 4. CI/CD Components Catalog

### What are CI/CD components

Components are reusable, versioned, parameterized CI/CD configuration units.
Each component lives in its own project and is published to the CI/CD catalog,
making it discoverable and installable like a package.

### Component structure

```
my-component-project/
  template.yml          # required -- the component definition
  README.md             # recommended -- usage docs
  .gitlab-ci.yml        # CI for the component project itself
```

For a project with multiple components:

```
my-components-project/
  templates/
    build/
      template.yml
    test/
      template.yml
    deploy/
      template.yml
  .gitlab-ci.yml
```

### `spec:inputs` for parameters

```yaml
# template.yml
spec:
  inputs:
    stage:
      default: build
      description: "Pipeline stage for this job"
    image:
      default: docker:latest
    dockerfile:
      default: Dockerfile
    build_args:
      type: string
      default: ""
    enable_push:
      type: boolean
      default: true
    timeout_minutes:
      type: number
      default: 30
---
build-docker:
  stage: $[[ inputs.stage ]]
  image: $[[ inputs.image ]]
  timeout: $[[ inputs.timeout_minutes ]] minutes
  script:
    - docker build -f $[[ inputs.dockerfile ]] $[[ inputs.build_args ]] -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - |
      if [ "$[[ inputs.enable_push ]]" = "true" ]; then
        docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      fi
```

Input types: `string` (default), `number`, `boolean`. Inputs without a
`default` are required.

### Publishing components to the catalog

1. The project must have a `template.yml` (or `templates/*/template.yml`).
2. Add a CI/CD catalog resource badge or set the project as a catalog resource
   in Settings > General > Visibility.
3. Create a release (git tag). The tag becomes the component version.

```yaml
# .gitlab-ci.yml for the component project itself
include:
  - component: 'gitlab.com/components/release@0.3.0'

create-release:
  stage: deploy
  script:
    - echo "Publishing component"
  release:
    tag_name: $CI_COMMIT_TAG
    description: "Release $CI_COMMIT_TAG"
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
```

### Versioning

```yaml
include:
  # Pin to exact version (recommended for production)
  - component: 'gitlab.com/my-org/components/docker-build@1.2.3'

  # Pin to major version (gets latest 1.x.x)
  - component: 'gitlab.com/my-org/components/docker-build@~1'

  # Pin to branch (use for development only)
  - component: 'gitlab.com/my-org/components/docker-build@main'

  # Pin to commit SHA (immutable)
  - component: 'gitlab.com/my-org/components/docker-build@abc123def'
```

### Complete component example: reusable Go build

```yaml
# template.yml
spec:
  inputs:
    stage:
      default: build
    go_version:
      default: "1.22"
    build_flags:
      default: "-ldflags '-s -w'"
    binary_name:
      default: app
    run_tests:
      type: boolean
      default: true
---
go-build:
  stage: $[[ inputs.stage ]]
  image: golang:$[[ inputs.go_version ]]
  variables:
    GOPATH: "$CI_PROJECT_DIR/.go"
    CGO_ENABLED: "0"
  cache:
    key: go-mod-${CI_COMMIT_REF_SLUG}
    paths:
      - .go/pkg/mod/
  script:
    - |
      if [ "$[[ inputs.run_tests ]]" = "true" ]; then
        go test ./...
      fi
    - go build $[[ inputs.build_flags ]] -o $[[ inputs.binary_name ]] .
  artifacts:
    paths:
      - $[[ inputs.binary_name ]]
```

Usage:

```yaml
include:
  - component: 'gitlab.com/my-org/components/go-build@1.0.0'
    inputs:
      go_version: "1.22"
      binary_name: myservice
      run_tests: true
```

---

## 5. Project Templates

### Creating a CI/CD template project

Create a dedicated project (e.g., `my-group/ci-templates`) to hold all shared
CI/CD configuration. This becomes the single source of truth for your
organization's pipeline standards.

### Organizing templates by concern

```
ci-templates/
  templates/
    build/
      docker.yml
      go.yml
      node.yml
    test/
      unit.yml
      integration.yml
      e2e.yml
    security/
      sast.yml
      dependency-scan.yml
      container-scan.yml
    deploy/
      helm.yml
      terraform.yml
      serverless.yml
    quality/
      lint.yml
      code-quality.yml
  .gitlab-ci.yml
```

### Versioning with git tags

Tag the template project with semantic versions. Consuming projects pin to a
specific version:

```yaml
include:
  - project: 'my-group/ci-templates'
    ref: 'v3.2.1'
    file:
      - '/templates/build/docker.yml'
      - '/templates/security/sast.yml'
      - '/templates/deploy/helm.yml'
```

### Template inheritance patterns

```yaml
# ci-templates/templates/build/docker.yml
.docker-build-base:
  image: docker:latest
  services:
    - docker:dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY

docker-build:
  extends: .docker-build-base
  stage: build
  script:
    - docker build -t "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  rules:
    - if: '$SKIP_DOCKER_BUILD'
      when: never
    - when: on_success
```

Consumers override specific keys:

```yaml
include:
  - project: 'my-group/ci-templates'
    ref: 'v3.2.1'
    file: '/templates/build/docker.yml'

docker-build:
  variables:
    DOCKERFILE: "Dockerfile.production"
  script:
    - docker build -f "$DOCKERFILE" -t "$CI_REGISTRY_IMAGE:$CI_COMMIT_TAG" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_TAG"
  rules:
    - if: '$CI_COMMIT_TAG'
```

---

## 6. Auto DevOps

### What Auto DevOps provides

Auto DevOps delivers a complete CI/CD pipeline with zero configuration. It
detects the project language, builds a container, runs security scans, and
deploys to Kubernetes -- all automatically.

Enable it in **Settings > CI/CD > Auto DevOps**.

### Stages provided by Auto DevOps

| Stage                  | What it does                                    |
|------------------------|-------------------------------------------------|
| Build                  | Builds a Docker image using Buildpacks or Dockerfile |
| Test                   | Runs language-specific test suites               |
| Code Quality           | Analyzes code quality with CodeClimate           |
| SAST                   | Static Application Security Testing              |
| Secret Detection       | Scans for leaked secrets in the codebase         |
| Dependency Scanning    | Checks dependencies for known vulnerabilities    |
| Container Scanning     | Scans the built Docker image for vulnerabilities |
| DAST                   | Dynamic Application Security Testing on review apps |
| License Compliance     | Checks dependency licenses against policy        |
| Review                 | Deploys review apps for merge requests           |
| Deploy (staging)       | Deploys to staging on default branch             |
| Deploy (production)    | Deploys to production (manual or auto)           |
| Performance            | Runs browser performance testing                 |
| Cleanup                | Removes review app environments                  |

### When to use Auto DevOps vs custom pipelines

Use Auto DevOps when: starting a new project quickly, the project fits standard
patterns (web app with Dockerfile or buildpack-compatible), or you want
security scanning without writing config.

Use custom pipelines when: the project has non-standard build steps, you need
fine-grained control over deployment, or Auto DevOps stages conflict with
existing tooling.

### Customizing Auto DevOps

Override specific jobs by defining them in `.gitlab-ci.yml`:

```yaml
include:
  - template: 'Auto-DevOps.gitlab-ci.yml'

# Override just the test job
test:
  script:
    - npm ci
    - npm run test:coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura.xml

# Disable a stage entirely
performance:
  rules:
    - when: never

# Add custom variables
variables:
  AUTO_DEVOPS_DEPLOY_DEBUG: "true"
  POSTGRES_ENABLED: "false"
  K8S_SECRET_DATABASE_URL: "$DATABASE_URL"
```

---

## 7. `default` Keyword

The `default` keyword sets global defaults that apply to all jobs unless
overridden at the job level.

```yaml
default:
  image: node:20-alpine
  services:
    - name: postgres:16
      alias: db
  before_script:
    - npm ci
  after_script:
    - echo "Job finished with exit code $CI_JOB_STATUS"
  cache:
    key: "${CI_COMMIT_REF_SLUG}"
    paths:
      - node_modules/
  artifacts:
    expire_in: 1 week
    when: on_failure
    paths:
      - logs/
  retry:
    max: 2
    when:
      - runner_system_failure
  timeout: 30 minutes
  interruptible: true
  tags:
    - docker

# This job inherits all defaults
lint:
  stage: test
  script:
    - npm run lint

# This job overrides image and before_script
build:
  stage: build
  image: node:20      # overrides default image
  before_script:      # replaces default before_script entirely
    - npm ci --production
  script:
    - npm run build
```

### `default` vs hidden job templates

| Aspect           | `default`                          | Hidden job + `extends`            |
|------------------|------------------------------------|-----------------------------------|
| Applies to       | All jobs automatically             | Only jobs that opt in             |
| Override         | Job-level keys replace defaults    | Deep merge with extends chain     |
| Use case         | Universal settings (image, tags)   | Shared logic for a subset of jobs |
| Granularity      | One global set                     | Multiple templates possible       |

Use `default` for settings that genuinely apply to every job. Use hidden jobs
and `extends` when different job families need different base configurations.

---

## 8. Design Patterns for Reusability

### Pattern: base template + environment-specific overrides

```yaml
.deploy-base:
  image: bitnami/kubectl:latest
  before_script:
    - kubectl config use-context $KUBE_CONTEXT
  script:
    - kubectl apply -f k8s/
    - kubectl rollout status deployment/$APP_NAME -n $NAMESPACE

deploy-staging:
  extends: .deploy-base
  stage: deploy
  variables:
    KUBE_CONTEXT: staging-cluster
    NAMESPACE: staging
    APP_NAME: myapp
  environment:
    name: staging
    url: https://staging.example.com

deploy-production:
  extends: .deploy-base
  stage: deploy
  variables:
    KUBE_CONTEXT: production-cluster
    NAMESPACE: production
    APP_NAME: myapp
  environment:
    name: production
    url: https://example.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual
```

### Pattern: shared config project with versioned releases

```yaml
# Consumer .gitlab-ci.yml
include:
  - project: 'platform/ci-templates'
    ref: 'v4.0.0'
    file:
      - '/templates/build/docker.yml'
      - '/templates/test/go.yml'
      - '/templates/deploy/helm.yml'

variables:
  APP_NAME: my-service
  HELM_CHART: ./charts/my-service
```

### Pattern: component per concern

```yaml
include:
  - component: 'gitlab.com/my-org/components/docker-build@2.0.0'
    inputs:
      dockerfile: Dockerfile.prod
  - component: 'gitlab.com/my-org/components/trivy-scan@1.3.0'
    inputs:
      severity: CRITICAL,HIGH
  - component: 'gitlab.com/my-org/components/helm-deploy@3.1.0'
    inputs:
      chart_path: ./charts/app
      namespace: production
```

### Pattern: monorepo with per-service includes

```yaml
include:
  - local: 'services/api/.gitlab-ci.yml'
    rules:
      - changes:
          - services/api/**/*
  - local: 'services/web/.gitlab-ci.yml'
    rules:
      - changes:
          - services/web/**/*
  - local: 'services/worker/.gitlab-ci.yml'
    rules:
      - changes:
          - services/worker/**/*
```

### Anti-patterns

- **Over-abstraction:** Wrapping every two-line script in a reusable template.
  Keep templates for genuinely repeated patterns.
- **Circular includes:** File A includes File B which includes File A. GitLab
  detects this and fails, but it wastes debugging time.
- **Unversioned remote includes:** Using `include:remote` without any
  versioning guarantee. The URL content can change at any time.
- **Giant monolithic template files:** A single 1000-line included file defeats
  the purpose of modularity. Split by concern.
- **Deeply nested extends chains:** More than 3-4 levels becomes impossible to
  reason about. Flatten when you notice yourself scrolling through extends to
  understand a job.

---

## 9. Migration Patterns

### From YAML anchors to `extends`

Before:

```yaml
.job_defaults: &job_defaults
  image: node:20
  tags:
    - docker
  cache:
    key: node-cache
    paths:
      - node_modules/

test:
  <<: *job_defaults
  script:
    - npm test

lint:
  <<: *job_defaults
  script:
    - npm run lint
```

After:

```yaml
.job-defaults:
  image: node:20
  tags:
    - docker
  cache:
    key: node-cache
    paths:
      - node_modules/

test:
  extends: .job-defaults
  script:
    - npm test

lint:
  extends: .job-defaults
  script:
    - npm run lint
```

The `extends` version works identically but supports cross-file reuse and deep
merge.

### From `extends` to CI/CD components

Before (template file in shared project):

```yaml
# ci-templates/templates/docker-build.yml
.docker-build:
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
```

After (component with `spec:inputs`):

```yaml
# components/docker-build/template.yml
spec:
  inputs:
    stage:
      default: build
    image_tag:
      description: "Full image tag including registry"
---
docker-build:
  stage: $[[ inputs.stage ]]
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $[[ inputs.image_tag ]] .
    - docker push $[[ inputs.image_tag ]]
```

Consumer changes from:

```yaml
include:
  - project: 'my-group/ci-templates'
    file: '/templates/docker-build.yml'

build:
  extends: .docker-build
  variables:
    IMAGE_TAG: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
```

To:

```yaml
include:
  - component: 'gitlab.com/my-org/components/docker-build@1.0.0'
    inputs:
      image_tag: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
```

### From `only/except` to `rules`

Before:

```yaml
deploy:
  script:
    - deploy.sh
  only:
    - main
  except:
    - schedules
```

After:

```yaml
deploy:
  script:
    - deploy.sh
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
      when: never
    - if: '$CI_COMMIT_BRANCH == "main"'
```

Note: `rules` are evaluated top to bottom; the first match wins. Place
exclusions (`when: never`) before inclusions.

### From hardcoded values to `include:inputs`

Before:

```yaml
# shared-deploy.yml
deploy:
  image: bitnami/kubectl:1.28
  script:
    - kubectl set image deployment/myapp app=myregistry/myapp:$CI_COMMIT_SHA
    - kubectl rollout status deployment/myapp
```

After:

```yaml
# shared-deploy.yml
spec:
  inputs:
    app_name:
      description: "Deployment and container name"
    image_registry:
      default: "$CI_REGISTRY_IMAGE"
    kubectl_version:
      default: "1.28"
---
deploy:
  image: bitnami/kubectl:$[[ inputs.kubectl_version ]]
  script:
    - kubectl set image deployment/$[[ inputs.app_name ]] app=$[[ inputs.image_registry ]]:$CI_COMMIT_SHA
    - kubectl rollout status deployment/$[[ inputs.app_name ]]
```

Consumer:

```yaml
include:
  - local: 'shared-deploy.yml'
    inputs:
      app_name: order-service
      image_registry: "registry.example.com/backend/order-service"
```

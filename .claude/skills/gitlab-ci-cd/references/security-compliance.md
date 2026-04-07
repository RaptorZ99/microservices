# Security & Compliance Reference

## Table of Contents
1. [Security Scanning Suite](#1-security-scanning-suite)
2. [Secrets Management](#2-secrets-management)
3. [Compliance Pipelines](#3-compliance-pipelines)
4. [Protected Branches and Environments](#4-protected-branches-and-environments)
5. [Container and Registry Security](#5-container-and-registry-security)
6. [SBOM and Supply Chain Security](#6-sbom-and-supply-chain-security)
7. [Security Reports in Merge Requests](#7-security-reports-in-merge-requests)
8. [Complete Secure Pipeline Example](#8-complete-secure-pipeline-example)

---

## 1. Security Scanning Suite

### SAST (Static Application Security Testing)

Analyzes source code for vulnerabilities without executing it.

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml

variables:
  SAST_EXCLUDED_PATHS: "spec,test,tests,tmp,vendor"
  SEARCH_MAX_DEPTH: 4
  SAST_EXCLUDED_ANALYZERS: "gosec,bandit"
  # Analyzer-specific tuning
  SAST_BANDIT_EXCLUDED_PATHS: "*/test/**"
  SAST_SEMGREP_METRICS: "false"
```

Custom rulesets override default analyzer behavior:

```yaml
variables:
  SAST_RULESET_GIT_REFERENCE: "refs/heads/main"

sast:
  variables:
    SAST_RULESET_GIT_REFERENCE: "my-group/my-ruleset-project@v1.0"
```

Custom ruleset file (`.gitlab/sast-ruleset.toml`):

```toml
[semgrep]
  [[semgrep.passthrough]]
    type = "url"
    target = "/sgrules/custom.yml"
    value = "https://example.com/semgrep-rules.yml"

  [[semgrep.ruleset]]
    disable = true
    identifier = "semgrep_id.rule-id-to-disable"
```

### DAST (Dynamic Application Security Testing)

Tests running applications for vulnerabilities by sending real HTTP requests.

```yaml
include:
  - template: DAST.gitlab-ci.yml

variables:
  DAST_WEBSITE: "https://staging.example.com"
  DAST_FULL_SCAN_ENABLED: "true"
  DAST_BROWSER_SCAN: "true"

dast:
  stage: dast
  variables:
    DAST_PATHS: "/api/v1,/login,/dashboard"
    DAST_EXCLUDE_URLS: "https://staging.example.com/logout"
```

Authenticated DAST scan:

```yaml
dast:
  variables:
    DAST_AUTH_URL: "https://staging.example.com/login"
    DAST_USERNAME: $DAST_USER
    DAST_PASSWORD: $DAST_PASS
    DAST_USERNAME_FIELD: "css:input[name='email']"
    DAST_PASSWORD_FIELD: "css:input[name='password']"
    DAST_SUBMIT_FIELD: "css:button[type='submit']"
    DAST_AUTH_VERIFICATION_URL: "https://staging.example.com/dashboard"
```

DAST API scanning:

```yaml
include:
  - template: DAST-API.gitlab-ci.yml

variables:
  DAST_API_OPENAPI: "https://staging.example.com/api/openapi.json"
  DAST_API_TARGET_URL: "https://staging.example.com"
```

### Secret Detection

Scans commits for accidentally committed secrets (API keys, tokens, passwords).

```yaml
include:
  - template: Security/Secret-Detection.gitlab-ci.yml

variables:
  SECRET_DETECTION_HISTORIC_SCAN: "true"         # scan full git history
  SECRET_DETECTION_EXCLUDED_PATHS: "tests/"
  SECRET_DETECTION_LOG_OPTIONS: "--all --branches"
```

Custom secret patterns (`.gitlab/secret-detection-ruleset.toml`):

```toml
[[rules]]
  id = "custom-api-key"
  description = "Custom internal API key pattern"
  regex = '''INTERNAL_KEY_[A-Za-z0-9]{32}'''
  severity = "CRITICAL"

[[rules]]
  id = "gitleaks-generic-api-key"
  disabled = true   # disable a built-in rule
```

### Dependency Scanning

Detects known vulnerabilities in project dependencies.

```yaml
include:
  - template: Security/Dependency-Scanning.gitlab-ci.yml

variables:
  DS_EXCLUDED_PATHS: "doc,spec"
  DS_EXCLUDED_ANALYZERS: "bundler-audit"
  SECURE_LOG_LEVEL: "debug"        # for troubleshooting
```

Vulnerability allowlist (`vulnerability-allowlist.yml`):

```yaml
generalallowlist:
  - cve: CVE-2023-12345
    reason: "False positive; function not reachable"
  - cve: CVE-2023-67890
    reason: "Accepted risk; mitigated by WAF rule"
```

### Container Scanning

Scans Docker images for OS-level and language-level vulnerabilities.

```yaml
include:
  - template: Security/Container-Scanning.gitlab-ci.yml

container_scanning:
  variables:
    CS_IMAGE: "$CI_REGISTRY_IMAGE/$CI_COMMIT_REF_SLUG:$CI_COMMIT_SHA"
    CS_SEVERITY_THRESHOLD: "HIGH"
    CS_DOCKERFILE_PATH: "Dockerfile"
```

Scanning images from custom registries:

```yaml
container_scanning:
  variables:
    CS_IMAGE: "registry.example.com/my-app:latest"
    CS_REGISTRY_USER: $CUSTOM_REGISTRY_USER
    CS_REGISTRY_PASSWORD: $CUSTOM_REGISTRY_PASSWORD
```

### License Compliance

Identifies licenses used by project dependencies and enforces approval policies.

```yaml
include:
  - template: Security/License-Scanning.gitlab-ci.yml

license_scanning:
  variables:
    LICENSE_FINDER_CLI_OPTS: "--recursive"
    SECURE_LOG_LEVEL: "info"
```

License approval policies are managed in **Settings > Policies > License approval**.
Deny specific licenses:

```yaml
# Managed via API or UI. Example API call:
# PUT /projects/:id/managed_licenses
# { "name": "AGPL-3.0", "approval_status": "denied" }
```

### Infrastructure as Code Scanning

Scans Terraform, CloudFormation, Ansible, Kubernetes manifests, and Dockerfiles.

```yaml
include:
  - template: Security/SAST-IaC.gitlab-ci.yml

variables:
  SAST_EXCLUDED_PATHS: "examples/"
```

### Fuzz Testing

**Coverage-guided fuzzing** instruments the application binary:

```yaml
include:
  - template: Coverage-Fuzzing.gitlab-ci.yml

coverage_fuzzing:
  stage: fuzz
  variables:
    COVFUZZ_CORPUS: "corpus/"
    COVFUZZ_SEED_CORPUS: "seed_corpus/"
  script:
    - ./gitlab-cov-fuzz run --regression=$CI_PIPELINE_SOURCE
```

**API fuzzing** sends mutated payloads to API endpoints:

```yaml
include:
  - template: API-Fuzzing.gitlab-ci.yml

variables:
  FUZZAPI_OPENAPI: "openapi.json"
  FUZZAPI_TARGET_URL: "https://staging.example.com"
  FUZZAPI_PROFILE: "Quick-10"   # Quick-10, Medium-20, Long-30
```

---

## 2. Secrets Management

### CI/CD Variable Types and Scopes

```yaml
# Project-level variables (Settings > CI/CD > Variables)
# Properties:
#   Protected  - only exposed on protected branches/tags
#   Masked     - value hidden in job logs (must meet masking requirements)
#   File       - written to a temp file; variable holds the file path
#   Expanded   - whether $REFERENCES in the value are expanded (default: true)

# Variable scopes:
#   Instance   - available to all projects on the GitLab instance
#   Group      - available to all projects within the group
#   Project    - available only within the specific project
#   Environment - available only in jobs targeting a specific environment
```

### OIDC Authentication with Vault

```yaml
deploy:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: "https://vault.example.com"
  secrets:
    DATABASE_PASSWORD:
      vault: "production/db/password@kv-v2"
      token: $VAULT_ID_TOKEN
    API_KEY:
      vault: "production/api/key@kv-v2"
      token: $VAULT_ID_TOKEN
  script:
    - echo "DB password is available as $DATABASE_PASSWORD"
    - deploy --api-key "$API_KEY"
```

### OIDC with AWS

```yaml
assume_role:
  id_tokens:
    AWS_OIDC_TOKEN:
      aud: "https://gitlab.example.com"
  script:
    - >
      STS_OUTPUT=$(aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::123456789012:role/gitlab-ci
      --role-session-name "gitlab-ci-${CI_PROJECT_ID}-${CI_PIPELINE_ID}"
      --web-identity-token "$AWS_OIDC_TOKEN"
      --duration-seconds 3600)
    - export AWS_ACCESS_KEY_ID=$(echo $STS_OUTPUT | jq -r '.Credentials.AccessKeyId')
    - export AWS_SECRET_ACCESS_KEY=$(echo $STS_OUTPUT | jq -r '.Credentials.SecretAccessKey')
    - export AWS_SESSION_TOKEN=$(echo $STS_OUTPUT | jq -r '.Credentials.SessionToken')
    - aws s3 ls
```

### External Secrets Manager (HashiCorp Vault)

```yaml
variables:
  VAULT_SERVER_URL: "https://vault.example.com"
  VAULT_AUTH_PATH: "jwt/gitlab"
  VAULT_AUTH_ROLE: "myproject-production"

deploy:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: "https://vault.example.com"
  secrets:
    DB_CONN_STRING:
      vault: "database/creds/readonly@database"
      token: $VAULT_ID_TOKEN
    TLS_CERT:
      vault: "pki/issue/myapp@pki"
      token: $VAULT_ID_TOKEN
      file: true   # write to file instead of env var
  script:
    - cat "$TLS_CERT"  # file-type secret
```

### Anti-Patterns to Avoid

```yaml
# BAD: Hardcoded secret
script:
  - curl -H "Authorization: Bearer sk-abc123hardcoded" https://api.example.com

# BAD: Secret leaked into artifact
script:
  - echo "$SECRET_KEY" > config.txt
artifacts:
  paths:
    - config.txt

# BAD: Unmasked sensitive value in logs
script:
  - echo "The password is $DB_PASSWORD"   # will print value if not masked

# GOOD: Use masked CI/CD variables or Vault secrets
# GOOD: Never echo secrets; use them directly in commands
# GOOD: Mark variables as Protected so they only run on protected branches
```

---

## 3. Compliance Pipelines

### Compliance Framework Configuration

Compliance frameworks ensure required jobs always execute, even if developers modify `.gitlab-ci.yml`.

```yaml
# .compliance-gitlab-ci.yml (in the compliance project)
# This pipeline is prepended to every project in the framework.

include:
  - project: "$CI_PROJECT_PATH"
    file: ".gitlab-ci.yml"
    ref: "$CI_COMMIT_SHA"

stages:
  - .pre
  - build
  - test
  - security
  - compliance
  - deploy
  - .post

# Required security scans that cannot be removed by developers
mandatory_sast:
  stage: security
  extends: .sast
  allow_failure: false
  rules:
    - when: always

mandatory_secret_detection:
  stage: security
  extends: .secret-detection
  allow_failure: false
  rules:
    - when: always

compliance_check:
  stage: compliance
  script:
    - echo "Verifying compliance controls..."
    - ./scripts/verify-controls.sh
  allow_failure: false
  rules:
    - when: always
```

### Separation of Duties

```yaml
# Developers own build/test; security team owns compliance jobs.
# Compliance pipeline project is locked down:
#   - Only compliance team can merge to compliance project
#   - Compliance project is linked as framework source
#   - Developers cannot override compliance jobs

# In group settings:
# Settings > General > Compliance frameworks
#   Name: "SOC 2 Type II"
#   Pipeline configuration: .compliance-gitlab-ci.yml@my-group/compliance-pipelines
```

### Audit Events

GitLab tracks audit events for:
- Pipeline creation and deletion
- Variable changes
- Protected branch/environment changes
- User permission changes
- Compliance framework assignment

Access via: **Group > Security & Compliance > Audit events** or the Audit Events API.

---

## 4. Protected Branches and Environments

### Branch Protection Rules

```yaml
# Configured via Settings > Repository > Protected branches
# or via API:
# POST /projects/:id/protected_branches
# {
#   "name": "main",
#   "push_access_level": 40,           # Maintainers only
#   "merge_access_level": 40,          # Maintainers only
#   "allow_force_push": false,
#   "code_owner_approval_required": true
# }
```

### Protected Environments with Approval Gates

```yaml
deploy_production:
  stage: deploy
  script:
    - helm upgrade --install myapp ./charts/myapp
  environment:
    name: production
    url: https://app.example.com
    deployment_tier: production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual

# Environment protection is configured in:
# Settings > CI/CD > Protected environments
#   Environment: production
#   Allowed to deploy: Maintainers
#   Required approvals: 2
#   Approvers: @security-team, @platform-team
```

### Deployment Approvals

```yaml
# When required approvals are configured on an environment,
# manual jobs targeting that environment will block until
# the required number of approvers approve in the UI.

deploy_staging:
  stage: deploy
  script:
    - deploy-to staging
  environment:
    name: staging
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy_production:
  stage: deploy
  script:
    - deploy-to production
  environment:
    name: production
  needs: [deploy_staging]
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual   # requires click + environment approvals
```

### Environment-Scoped Variables

```yaml
# Variables can be scoped to specific environments:
# Settings > CI/CD > Variables
#   Key: DATABASE_URL
#   Value: postgres://prod-db:5432/app
#   Environment scope: production
#
#   Key: DATABASE_URL
#   Value: postgres://staging-db:5432/app
#   Environment scope: staging
```

---

## 5. Container and Registry Security

### GitLab Container Registry

```yaml
build_image:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

scan_image:
  stage: test
  needs: [build_image]
  include:
    - template: Security/Container-Scanning.gitlab-ci.yml
  variables:
    CS_IMAGE: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
    CS_SEVERITY_THRESHOLD: "CRITICAL"
```

### Signing Images with Cosign

```yaml
sign_image:
  stage: deploy
  image: bitnami/cosign:latest
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: "sigstore"
  script:
    - cosign sign
      --yes
      --oidc-issuer="$CI_SERVER_URL"
      --identity-token="$SIGSTORE_ID_TOKEN"
      "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  needs: [scan_image]

verify_image:
  stage: deploy
  image: bitnami/cosign:latest
  script:
    - cosign verify
      --certificate-oidc-issuer="$CI_SERVER_URL"
      --certificate-identity="//gitlab.example.com/my-group/my-project"
      "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
```

### Blocking Vulnerable Images

```yaml
container_scanning:
  variables:
    CS_IMAGE: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  allow_failure: false   # pipeline fails if vulnerabilities found

gate_deployment:
  stage: deploy
  needs: [container_scanning]
  script:
    - echo "Image passed security scan, proceeding with deployment"
    - deploy_image "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

---

## 6. SBOM and Supply Chain Security

### Software Bill of Materials

```yaml
include:
  - template: Security/Dependency-Scanning.gitlab-ci.yml

# GitLab automatically generates CycloneDX SBOM from dependency scanning.
# Access via: Project > Security & Compliance > Dependency list

# Export SBOM via API:
# GET /projects/:id/dependency_list_exports
```

### Explicit CycloneDX Generation

```yaml
generate_sbom:
  stage: build
  image: cyclonedx/cyclonedx-cli:latest
  script:
    - cyclonedx-cli analyze --input-file package-lock.json --output-file sbom.json
  artifacts:
    paths:
      - sbom.json
    reports:
      cyclonedx:
        - sbom.json
```

### SLSA (Supply-chain Levels for Software Artifacts)

```yaml
# GitLab supports SLSA provenance generation.
# Enable in CI/CD settings or via:

build_with_provenance:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  artifacts:
    reports:
      # SLSA provenance is attached automatically when
      # using GitLab Runner with attestation enabled
      cyclonedx:
        - gl-sbom-report.cdx.json
```

---

## 7. Security Reports in Merge Requests

### How Reports Appear

Security scan results are displayed directly in merge requests when jobs produce
the correct artifact reports. GitLab compares the MR branch against the target
branch and shows new, resolved, and existing vulnerabilities.

```yaml
# Each scanner template produces the correct report format automatically.
# Manual jobs must declare the report type:

custom_sast:
  stage: test
  script:
    - my-custom-scanner --output gl-sast-report.json
  artifacts:
    reports:
      sast: gl-sast-report.json
    when: always   # upload report even if scanner finds issues
```

### Vulnerability Dismissals

Vulnerabilities can be dismissed with a reason in the Security Dashboard:
- **Acceptable risk** -- risk acknowledged and accepted
- **False positive** -- scanner incorrectly identified the issue
- **Mitigating control** -- other controls reduce the risk
- **Used in tests** -- vulnerable code only runs in test context

### Security Approval Rules

```yaml
# Configured via Settings > Merge requests > Approval rules
# or via API:
# POST /projects/:id/approval_rules
# {
#   "name": "Security Team Approval",
#   "approvals_required": 1,
#   "user_ids": [42, 43],
#   "rule_type": "any_approver",
#   "vulnerability_states": ["new_needs_triage", "new_dismissed"]
# }

# When any MR introduces new vulnerabilities, the security approval
# rule triggers and requires the specified reviewers to approve.
```

---

## 8. Complete Secure Pipeline Example

```yaml
stages:
  - build
  - test
  - security
  - fuzz
  - deploy

include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Container-Scanning.gitlab-ci.yml
  - template: Security/License-Scanning.gitlab-ci.yml
  - template: DAST.gitlab-ci.yml

variables:
  DOCKER_IMAGE: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  CS_IMAGE: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  DAST_WEBSITE: "https://staging.example.com"

# ── Build ──────────────────────────────────────────────
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ── Unit Tests ─────────────────────────────────────────
test:
  stage: test
  image: $DOCKER_IMAGE
  script:
    - npm ci
    - npm test
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# ── Security Scans (overrides from templates) ──────────
sast:
  stage: security
  allow_failure: false

secret_detection:
  stage: security
  allow_failure: false

dependency_scanning:
  stage: security
  allow_failure: false

container_scanning:
  stage: security
  needs: [build]
  allow_failure: false
  variables:
    CS_SEVERITY_THRESHOLD: "HIGH"

license_scanning:
  stage: security

# ── DAST (requires running application) ────────────────
dast:
  stage: security
  needs: [deploy_staging]
  variables:
    DAST_FULL_SCAN_ENABLED: "false"
    DAST_BROWSER_SCAN: "true"

# ── Deploy Staging ─────────────────────────────────────
deploy_staging:
  stage: deploy
  needs:
    - job: build
    - job: sast
      artifacts: false
    - job: secret_detection
      artifacts: false
    - job: dependency_scanning
      artifacts: false
    - job: container_scanning
      artifacts: false
  script:
    - helm upgrade --install myapp-staging ./charts/myapp
      --set image.tag=$CI_COMMIT_SHA
      --namespace staging
  environment:
    name: staging
    url: https://staging.example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ── Deploy Production ─────────────────────────────────
deploy_production:
  stage: deploy
  needs:
    - job: deploy_staging
    - job: dast
      artifacts: false
    - job: license_scanning
      artifacts: false
  script:
    - helm upgrade --install myapp ./charts/myapp
      --set image.tag=$CI_COMMIT_SHA
      --namespace production
  environment:
    name: production
    url: https://app.example.com
    deployment_tier: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

Key design decisions in this pipeline:
- **All security scans set `allow_failure: false`** so the pipeline blocks on vulnerabilities.
- **`needs` dependencies** ensure staging deployment only proceeds after scans pass.
- **DAST runs after staging deploy** because it requires a live target.
- **Production deploy is manual** and depends on DAST completing, giving the team time to review all security findings.
- **Container scanning targets the built image** by referencing `$CI_COMMIT_SHA`, not `latest`.

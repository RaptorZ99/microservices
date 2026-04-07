# Deployment Strategies Reference

## Table of Contents

1. [GitLab Environments](#1-gitlab-environments)
2. [Review Apps](#2-review-apps)
3. [Blue-Green Deployment](#3-blue-green-deployment)
4. [Canary Deployment](#4-canary-deployment)
5. [Rolling Deployment](#5-rolling-deployment)
6. [GitLab Pages Deployment](#6-gitlab-pages-deployment)
7. [Multi-Environment Promotion](#7-multi-environment-promotion)
8. [Kubernetes Deployments](#8-kubernetes-deployments)
9. [Cloud Provider Deployments](#9-cloud-provider-deployments)
10. [Rollback Strategies](#10-rollback-strategies)
11. [Notifications](#11-notifications)

---

## 1. GitLab Environments

### Environment Basics

```yaml
deploy_staging:
  stage: deploy
  script:
    - ./deploy.sh staging
  environment:
    name: staging
    url: https://staging.example.com
```

### Dynamic Environments

Use `$CI_COMMIT_REF_SLUG` to create per-branch environments:

```yaml
deploy_branch:
  stage: deploy
  script:
    - ./deploy.sh "$CI_COMMIT_REF_SLUG"
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.dev.example.com
```

### Environment Tiers

GitLab assigns a tier to each environment, which controls ordering and grouping in the UI:

| Tier          | Matched patterns (default)          |
|---------------|-------------------------------------|
| `production`  | `production`, `prod`                |
| `staging`     | `staging`, `stage`, `pre-prod`      |
| `testing`     | `testing`, `test`, `qa`             |
| `development` | `development`, `dev`, `review/*`    |
| `other`       | anything else                       |

Override explicitly with `deployment_tier`:

```yaml
deploy_canary:
  environment:
    name: production-canary
    deployment_tier: production
```

### Auto-Stop Environments

Automatically tear down environments after a duration of inactivity:

```yaml
deploy_review:
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    auto_stop_in: 1 week
    on_stop: stop_review
```

### Environment-Specific Variables

Define variables scoped to an environment in **Settings > CI/CD > Variables** with the "Environment scope" field. In `.gitlab-ci.yml`, variables resolve based on the job's `environment:name`.

```yaml
deploy_production:
  stage: deploy
  variables:
    DEPLOY_TARGET: "production-cluster"  # job-level variable
  script:
    - echo "DB_HOST is $DB_HOST"  # resolved from env-scoped CI/CD variable
  environment:
    name: production
```

### Deployment History and Rollback

Every successful deployment job creates a deployment record. Use the GitLab UI or API to:
- View full deployment history per environment
- Re-deploy any previous deployment (rollback)
- Track which commit is currently deployed

---

## 2. Review Apps

### Dynamic Environments per Merge Request

```yaml
deploy_review:
  stage: deploy
  script:
    - kubectl apply -f k8s/ --namespace="review-$CI_MERGE_REQUEST_IID"
  environment:
    name: review/$CI_MERGE_REQUEST_IID
    url: https://$CI_MERGE_REQUEST_IID.review.example.com
    on_stop: stop_review
    auto_stop_in: 2 days
  rules:
    - if: $CI_MERGE_REQUEST_IID

stop_review:
  stage: deploy
  script:
    - kubectl delete namespace "review-$CI_MERGE_REQUEST_IID"
  environment:
    name: review/$CI_MERGE_REQUEST_IID
    action: stop
  rules:
    - if: $CI_MERGE_REQUEST_IID
      when: manual
  allow_failure: true
```

Key points:
- `on_stop` links to the cleanup job. GitLab auto-triggers it when the MR is merged or closed.
- The stop job must have `action: stop` and the same `environment:name`.
- `allow_failure: true` on the stop job prevents pipeline failures during cleanup.

### Kubernetes-Based Review Apps

```yaml
deploy_review:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - |
      cat <<YAML | kubectl apply -f -
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: review-$CI_MERGE_REQUEST_IID
        namespace: review-apps
      spec:
        replicas: 1
        selector:
          matchLabels:
            app: review-$CI_MERGE_REQUEST_IID
        template:
          metadata:
            labels:
              app: review-$CI_MERGE_REQUEST_IID
          spec:
            containers:
              - name: app
                image: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
                ports:
                  - containerPort: 8080
      YAML
  environment:
    name: review/$CI_MERGE_REQUEST_IID
    url: https://$CI_MERGE_REQUEST_IID.review.example.com
    on_stop: stop_review
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

### Docker Compose-Based Review Apps

```yaml
deploy_review:
  stage: deploy
  tags:
    - docker-compose
  script:
    - export COMPOSE_PROJECT_NAME="review-${CI_MERGE_REQUEST_IID}"
    - export APP_PORT=$((3000 + CI_MERGE_REQUEST_IID))
    - docker compose -f docker-compose.review.yml up -d --build
  environment:
    name: review/$CI_MERGE_REQUEST_IID
    url: http://review-server.example.com:$((3000 + CI_MERGE_REQUEST_IID))
    on_stop: stop_review
  rules:
    - if: $CI_MERGE_REQUEST_IID

stop_review:
  stage: deploy
  tags:
    - docker-compose
  script:
    - export COMPOSE_PROJECT_NAME="review-${CI_MERGE_REQUEST_IID}"
    - docker compose -f docker-compose.review.yml down --volumes --remove-orphans
  environment:
    name: review/$CI_MERGE_REQUEST_IID
    action: stop
  rules:
    - if: $CI_MERGE_REQUEST_IID
      when: manual
  allow_failure: true
```

---

## 3. Blue-Green Deployment

**Concept:** Maintain two identical environments (blue and green). Deploy to the inactive one, run smoke tests, then switch traffic. Rollback is instant -- just switch back.

```yaml
stages:
  - build
  - deploy
  - test
  - switch
  - rollback

variables:
  ACTIVE_FILE: /shared/active-slot  # persisted state: "blue" or "green"

.deploy_template: &deploy_template
  stage: deploy
  script:
    - ./deploy.sh "$SLOT" "$CI_COMMIT_SHA"

determine_slot:
  stage: .pre
  script:
    - CURRENT=$(cat "$ACTIVE_FILE" 2>/dev/null || echo "blue")
    - |
      if [ "$CURRENT" = "blue" ]; then
        echo "DEPLOY_SLOT=green" >> deploy.env
      else
        echo "DEPLOY_SLOT=blue" >> deploy.env
      fi
  artifacts:
    reports:
      dotenv: deploy.env

deploy_inactive:
  stage: deploy
  script:
    - echo "Deploying to $DEPLOY_SLOT slot"
    - ./deploy.sh "$DEPLOY_SLOT" "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
  environment:
    name: production-$DEPLOY_SLOT
    url: https://$DEPLOY_SLOT.example.com
  needs:
    - determine_slot

smoke_test:
  stage: test
  script:
    - curl --fail "https://${DEPLOY_SLOT}.example.com/health"
    - ./run-smoke-tests.sh "https://${DEPLOY_SLOT}.example.com"
  needs:
    - deploy_inactive

switch_traffic:
  stage: switch
  script:
    - echo "Switching traffic to $DEPLOY_SLOT"
    - ./switch-load-balancer.sh "$DEPLOY_SLOT"
    - echo "$DEPLOY_SLOT" > "$ACTIVE_FILE"
  environment:
    name: production
    url: https://www.example.com
  when: manual
  needs:
    - smoke_test

rollback:
  stage: rollback
  script:
    - PREVIOUS=$(cat "$ACTIVE_FILE")
    - |
      if [ "$PREVIOUS" = "blue" ]; then
        ./switch-load-balancer.sh green
      else
        ./switch-load-balancer.sh blue
      fi
  environment:
    name: production
  when: manual
  needs:
    - switch_traffic
```

---

## 4. Canary Deployment

### Incremental Rollout Pattern

Roll out to a small percentage of traffic first, then progressively increase.

```yaml
stages:
  - build
  - canary
  - production

.canary_template:
  stage: canary
  script:
    - echo "Rolling out to ${CANARY_WEIGHT}% of traffic"
    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl annotate deployment/myapp traffic-weight="${CANARY_WEIGHT}" --overwrite
    - ./configure-ingress-weight.sh myapp-canary "${CANARY_WEIGHT}"
  environment:
    name: production
    url: https://www.example.com

canary_10:
  extends: .canary_template
  variables:
    CANARY_WEIGHT: "10"
  when: manual

canary_25:
  extends: .canary_template
  variables:
    CANARY_WEIGHT: "25"
  needs: [canary_10]
  when: manual

canary_50:
  extends: .canary_template
  variables:
    CANARY_WEIGHT: "50"
  needs: [canary_25]
  when: manual

production_100:
  stage: production
  script:
    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl scale deployment/myapp-canary --replicas=0
    - ./configure-ingress-weight.sh myapp-canary 0
    - ./configure-ingress-weight.sh myapp 100
  environment:
    name: production
    url: https://www.example.com
  needs: [canary_50]
  when: manual
```

### Incremental Rollout with `parallel:matrix`

```yaml
canary_rollout:
  stage: canary
  script:
    - echo "Canary at ${WEIGHT}%"
    - ./set-canary-weight.sh "$WEIGHT"
  parallel:
    matrix:
      - WEIGHT: ["10", "25", "50", "100"]
  environment:
    name: production
  when: manual
  resource_group: production
```

### Automated Canary Analysis

```yaml
canary_deploy:
  stage: canary
  script:
    - ./deploy-canary.sh "$CI_COMMIT_SHA" 10
    - echo "Canary deployed at 10%"

canary_analysis:
  stage: canary
  needs: [canary_deploy]
  script:
    - sleep 300  # wait 5 minutes for metrics
    - |
      ERROR_RATE=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_errors_total{version=\"canary\"}[5m])" | jq '.data.result[0].value[1]')
      BASELINE=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_errors_total{version=\"stable\"}[5m])" | jq '.data.result[0].value[1]')
      if (( $(echo "$ERROR_RATE > $BASELINE * 1.1" | bc -l) )); then
        echo "Canary error rate too high: $ERROR_RATE vs baseline $BASELINE"
        exit 1
      fi
    - echo "Canary analysis passed"
```

---

## 5. Rolling Deployment

### Zero-Downtime with `resource_group`

`resource_group` ensures only one deployment runs at a time for a given environment, preventing race conditions:

```yaml
deploy_production:
  stage: deploy
  resource_group: production
  script:
    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl rollout status deployment/myapp --timeout=300s
  environment:
    name: production
    url: https://www.example.com
```

### Kubernetes Rolling Update

```yaml
deploy_rolling:
  stage: deploy
  image: bitnami/kubectl:latest
  resource_group: production
  script:
    - |
      kubectl patch deployment myapp -p '{
        "spec": {
          "strategy": {
            "type": "RollingUpdate",
            "rollingUpdate": {
              "maxSurge": "25%",
              "maxUnavailable": "0"
            }
          }
        }
      }'
    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl rollout status deployment/myapp --timeout=600s
  environment:
    name: production

verify_health:
  stage: deploy
  needs: [deploy_rolling]
  script:
    - |
      for i in $(seq 1 10); do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.example.com/health)
        if [ "$STATUS" != "200" ]; then
          echo "Health check failed (attempt $i)"
          sleep 5
        else
          echo "Health check passed"
          exit 0
        fi
      done
      echo "Health checks exhausted"
      exit 1
```

---

## 6. GitLab Pages Deployment

The `pages` job name is a reserved convention. Artifacts placed in `public/` are deployed to GitLab Pages automatically.

```yaml
pages:
  stage: deploy
  script:
    - npm ci
    - npm run build
    - mv dist public  # GitLab Pages serves from public/
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Custom Domains and SSL

Configure custom domains in **Settings > Pages**. GitLab provisions Let's Encrypt certificates automatically when enabled. For manual SSL:

```yaml
pages:
  stage: deploy
  script:
    - hugo --minify
  artifacts:
    paths:
      - public
  environment:
    name: production
    url: https://docs.example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 7. Multi-Environment Promotion

### Dev to Staging to Production

```yaml
stages:
  - build
  - deploy_dev
  - deploy_staging
  - deploy_production

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy_dev:
  stage: deploy_dev
  script:
    - ./deploy.sh dev "$CI_COMMIT_SHA"
  environment:
    name: development
    url: https://dev.example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_staging:
  stage: deploy_staging
  script:
    - ./deploy.sh staging "$CI_COMMIT_SHA"
  environment:
    name: staging
    url: https://staging.example.com
  needs: [deploy_dev]
  when: manual
  allow_failure: false  # blocks downstream jobs until this is triggered
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_production:
  stage: deploy_production
  script:
    - ./deploy.sh production "$CI_COMMIT_SHA"
  environment:
    name: production
    url: https://www.example.com
  needs: [deploy_staging]
  when: manual
  allow_failure: false
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Key: `when: manual` + `allow_failure: false` creates a **blocking gate** -- the pipeline pauses until someone manually triggers the job. Without `allow_failure: false`, downstream jobs would skip rather than wait.

---

## 8. Kubernetes Deployments

### GitLab Agent for Kubernetes (KAS)

The recommended way to connect GitLab to Kubernetes. Install the agent in your cluster, then reference it:

```yaml
deploy_k8s:
  stage: deploy
  image:
    name: bitnami/kubectl:latest
    entrypoint: [""]
  script:
    - kubectl config use-context mygroup/myproject:my-agent
    - kubectl apply -f k8s/manifests/
    - kubectl rollout status deployment/myapp --timeout=300s
  environment:
    name: production
```

### Helm Chart Deployment

```yaml
deploy_helm:
  stage: deploy
  image:
    name: alpine/helm:3
    entrypoint: [""]
  script:
    - helm repo add myrepo https://charts.example.com
    - helm repo update
    - |
      helm upgrade --install myapp myrepo/myapp \
        --namespace production \
        --set image.tag=$CI_COMMIT_SHA \
        --set replicaCount=3 \
        --values helm/values-production.yaml \
        --wait \
        --timeout 5m
  environment:
    name: production
    url: https://www.example.com
```

### Kustomize Integration

```yaml
deploy_kustomize:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - cd k8s/overlays/production
    - kustomize edit set image myapp=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl apply -k .
    - kubectl rollout status deployment/myapp --timeout=300s
  environment:
    name: production
```

---

## 9. Cloud Provider Deployments

### AWS ECS

```yaml
deploy_ecs:
  stage: deploy
  image: amazon/aws-cli:latest
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://aws.example.com
  script:
    - >
      aws sts assume-role-with-web-identity
      --role-arn "$AWS_ROLE_ARN"
      --role-session-name "gitlab-ci-$CI_JOB_ID"
      --web-identity-token "$AWS_ID_TOKEN"
      > creds.json
    - export AWS_ACCESS_KEY_ID=$(jq -r '.Credentials.AccessKeyId' creds.json)
    - export AWS_SECRET_ACCESS_KEY=$(jq -r '.Credentials.SecretAccessKey' creds.json)
    - export AWS_SESSION_TOKEN=$(jq -r '.Credentials.SessionToken' creds.json)
    - |
      aws ecs update-service \
        --cluster my-cluster \
        --service my-service \
        --force-new-deployment \
        --region us-east-1
    - aws ecs wait services-stable --cluster my-cluster --services my-service --region us-east-1
  environment:
    name: production
```

### GCP Cloud Run

```yaml
deploy_cloud_run:
  stage: deploy
  image: google/cloud-sdk:slim
  id_tokens:
    GCP_ID_TOKEN:
      aud: https://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID
  script:
    - echo "$GCP_ID_TOKEN" > token.txt
    - >
      gcloud auth login
      --cred-file=token.txt
      --update-adc
    - >
      gcloud run deploy my-service
      --image $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      --region us-central1
      --project $GCP_PROJECT_ID
      --platform managed
      --allow-unauthenticated
  environment:
    name: production
    url: https://my-service-xyz.a.run.app
```

### AWS S3 Static Site

```yaml
deploy_s3:
  stage: deploy
  image: amazon/aws-cli:latest
  script:
    - aws s3 sync ./dist s3://$S3_BUCKET --delete
    - aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
  environment:
    name: production
    url: https://www.example.com
```

### Azure App Service

```yaml
deploy_azure:
  stage: deploy
  image: mcr.microsoft.com/azure-cli:latest
  id_tokens:
    AZURE_ID_TOKEN:
      aud: api://AzureADTokenExchange
  script:
    - az login --federated-token "$AZURE_ID_TOKEN" --service-principal -u "$AZURE_CLIENT_ID" -t "$AZURE_TENANT_ID"
    - >
      az webapp config container set
      --name my-webapp
      --resource-group my-rg
      --container-image-name $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  environment:
    name: production
    url: https://my-webapp.azurewebsites.net
```

### OIDC Authentication (No Long-Lived Credentials)

GitLab can issue ID tokens for OIDC authentication with cloud providers. This eliminates the need to store long-lived access keys:

```yaml
deploy_with_oidc:
  id_tokens:
    MY_TOKEN:
      aud: https://my-cloud-provider.example.com
  script:
    - echo "Token available in $MY_TOKEN"
    - ./authenticate-with-oidc.sh "$MY_TOKEN"
```

Configure the cloud provider to trust GitLab's OIDC issuer (`https://gitlab.com` or your self-managed URL) and map claims (`project_id`, `ref`, `environment`) to IAM roles.

---

## 10. Rollback Strategies

### GitLab Environment Rollback (UI)

In **Operate > Environments**, click any previous successful deployment and select "Rollback". This re-runs the deployment job with the previous commit's artifacts and variables.

### Kubernetes Rollback

```yaml
rollback_k8s:
  stage: rollback
  script:
    - kubectl rollout undo deployment/myapp
    - kubectl rollout status deployment/myapp --timeout=300s
  environment:
    name: production
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Database Migration Rollback

Always write reversible migrations. Include a rollback job that runs the down migration:

```yaml
rollback_db:
  stage: rollback
  script:
    - echo "Rolling back last migration"
    - bundle exec rails db:rollback STEP=1  # Rails example
    # - npx prisma migrate resolve --rolled-back $MIGRATION_NAME  # Prisma example
    # - flyway undo  # Flyway example
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

**Important:** Database rollbacks are risky if the migration was destructive (dropped columns, changed types). Consider:
- Using expand-contract migrations (add new column, backfill, switch reads, drop old)
- Decoupling schema changes from application deploys

### Feature Flag-Based Rollback

The fastest rollback -- no redeployment needed. Toggle a flag to disable the new code path:

```yaml
toggle_feature:
  stage: rollback
  script:
    - |
      curl -X PUT "$FEATURE_FLAG_API/flags/new-checkout" \
        -H "Authorization: Bearer $FF_TOKEN" \
        -d '{"enabled": false}'
  when: manual
  environment:
    name: production
```

### Manual Rollback Job Pattern

```yaml
rollback_production:
  stage: rollback
  variables:
    ROLLBACK_SHA: ""  # set manually when triggering
  script:
    - |
      if [ -z "$ROLLBACK_SHA" ]; then
        echo "ROLLBACK_SHA must be provided"
        exit 1
      fi
    - echo "Rolling back to $ROLLBACK_SHA"
    - kubectl set image deployment/myapp app=$CI_REGISTRY_IMAGE:$ROLLBACK_SHA
    - kubectl rollout status deployment/myapp --timeout=300s
  environment:
    name: production
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 11. Notifications

### Slack Notifications

```yaml
notify_slack_success:
  stage: .post
  script:
    - |
      curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
          \"text\": \"Deployed *$CI_PROJECT_NAME* to production\",
          \"blocks\": [
            {
              \"type\": \"section\",
              \"text\": {
                \"type\": \"mrkdwn\",
                \"text\": \"*Deployment Successful* :white_check_mark:\n*Project:* $CI_PROJECT_NAME\n*Commit:* <$CI_PROJECT_URL/-/commit/$CI_COMMIT_SHA|$CI_COMMIT_SHORT_SHA>\n*Pipeline:* <$CI_PIPELINE_URL|#$CI_PIPELINE_ID>\n*Author:* $GITLAB_USER_NAME\"
              }
            }
          ]
        }"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success

notify_slack_failure:
  stage: .post
  script:
    - |
      curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
          \"text\": \"Deployment FAILED for *$CI_PROJECT_NAME*\",
          \"blocks\": [
            {
              \"type\": \"section\",
              \"text\": {
                \"type\": \"mrkdwn\",
                \"text\": \"*Deployment Failed* :x:\n*Project:* $CI_PROJECT_NAME\n*Pipeline:* <$CI_PIPELINE_URL|#$CI_PIPELINE_ID>\n*Author:* $GITLAB_USER_NAME\"
              }
            }
          ]
        }"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_failure
```

### Microsoft Teams Notifications

```yaml
notify_teams:
  stage: .post
  script:
    - |
      curl -X POST "$TEAMS_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
          \"@type\": \"MessageCard\",
          \"summary\": \"Deployment $CI_PROJECT_NAME\",
          \"themeColor\": \"0076D7\",
          \"title\": \"Deployment Successful\",
          \"sections\": [{
            \"facts\": [
              {\"name\": \"Project\", \"value\": \"$CI_PROJECT_NAME\"},
              {\"name\": \"Commit\", \"value\": \"$CI_COMMIT_SHORT_SHA\"},
              {\"name\": \"Author\", \"value\": \"$GITLAB_USER_NAME\"}
            ]
          }],
          \"potentialAction\": [{
            \"@type\": \"OpenUri\",
            \"name\": \"View Pipeline\",
            \"targets\": [{\"os\": \"default\", \"uri\": \"$CI_PIPELINE_URL\"}]
          }]
        }"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success
```

### Email Notifications

GitLab sends pipeline emails by default. For custom emails, use an SMTP-capable image:

```yaml
notify_email:
  stage: .post
  image: alpine:latest
  script:
    - apk add --no-cache msmtp
    - |
      cat > /etc/msmtprc <<CONF
      account default
      host $SMTP_HOST
      port 587
      auth on
      user $SMTP_USER
      password $SMTP_PASSWORD
      from ci@example.com
      tls on
      CONF
    - |
      echo -e "Subject: Deploy complete - $CI_PROJECT_NAME\n\nDeployed $CI_COMMIT_SHORT_SHA to production.\nPipeline: $CI_PIPELINE_URL" | msmtp "$NOTIFY_EMAIL"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success
```

### Custom Webhook Integration

```yaml
notify_webhook:
  stage: .post
  script:
    - |
      curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "X-GitLab-Token: $WEBHOOK_SECRET" \
        -d "{
          \"event\": \"deployment\",
          \"status\": \"success\",
          \"project\": \"$CI_PROJECT_NAME\",
          \"commit\": \"$CI_COMMIT_SHA\",
          \"ref\": \"$CI_COMMIT_REF_NAME\",
          \"environment\": \"production\",
          \"pipeline_url\": \"$CI_PIPELINE_URL\",
          \"author\": \"$GITLAB_USER_NAME\",
          \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success
```

### Reusable Notification Template

```yaml
.notify:
  stage: .post
  image: curlimages/curl:latest

.notify_success:
  extends: .notify
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success

.notify_failure:
  extends: .notify
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_failure

slack_success:
  extends: .notify_success
  script:
    - curl -X POST "$SLACK_WEBHOOK_URL" -d "{\"text\":\"Deployed $CI_PROJECT_NAME ($CI_COMMIT_SHORT_SHA) to production.\"}"

slack_failure:
  extends: .notify_failure
  script:
    - curl -X POST "$SLACK_WEBHOOK_URL" -d "{\"text\":\"FAILED to deploy $CI_PROJECT_NAME. Pipeline: $CI_PIPELINE_URL\"}"
```

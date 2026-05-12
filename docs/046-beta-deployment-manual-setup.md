# 046 — Beta Deployment: Manual Setup Guide

This guide covers everything you need to do manually to complete the beta deployment setup
after the PR is merged. It also provides a testing checklist to confirm the feature is
working end-to-end.

---

## Prerequisites

Before you start, make sure you have the following installed and authenticated:

```bash
# Azure CLI (v2.60+)
az --version

# GitHub CLI
gh --version

# Log in to Azure
az login

# Set your target subscription
az account set --subscription "<your-subscription-id>"
```

---

## Part 1: Azure Setup

### 1.1 Register Azure Resource Providers

Some providers may not be registered on a fresh subscription:

```bash
az provider register --namespace Microsoft.App          # Container Apps
az provider register --namespace Microsoft.Web          # Static Web Apps
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Cache        # Redis
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Communication
az provider register --namespace Microsoft.AlertsManagement
az provider register --namespace Microsoft.Network
az provider register --namespace Microsoft.Consumption  # Budgets
```

> **Note**: Provider registration can take a few minutes. Run
> `az provider show -n Microsoft.App --query "registrationState"` to check status.

### 1.2 Create a Service Principal for GitHub Actions (OIDC — no long-lived secrets)

```bash
# Create the service principal
APP_ID=$(az ad app create --display-name "fundrbolt-github-actions" --query appId -o tsv)
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "App (Client) ID:  $APP_ID"
echo "Tenant ID:        $TENANT_ID"
echo "Subscription ID:  $SUBSCRIPTION_ID"

# Grant Contributor + User Access Administrator at subscription scope
# (User Access Admin is needed so Bicep can create role assignments)
az role assignment create \
  --role Contributor \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

az role assignment create \
  --role "User Access Administrator" \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# Set up federated credentials for OIDC (replace <org>/<repo>)
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "fundrbolt-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:jeanesdev/fundrbolt-platform:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenAudience"]
  }'

az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "fundrbolt-pull-requests",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:jeanesdev/fundrbolt-platform:pull_request",
    "audiences": ["api://AzureADTokenAudience"]
  }'
```

### 1.3 Deploy the Infrastructure (Bicep)

```bash
cd /path/to/fundrbolt-platform

# Edit the parameter file if needed (custom domain, budget, alert emails, image tag)
# infrastructure/bicep/parameters/production-beta.bicepparam

# Run the subscription-scoped deployment (creates the resource group + all resources)
az deployment sub create \
  --name "fundrbolt-production-beta" \
  --location eastus \
  --template-file infrastructure/bicep/main-beta.bicep \
  --parameters infrastructure/bicep/parameters/production-beta.bicepparam \
  --parameters postgresAdminPassword="<STRONG-PASSWORD-HERE>"
```

> **Tip**: The deployment takes ~10–15 minutes. Watch progress with:
> `az deployment sub show -n fundrbolt-production-beta --query properties.provisioningState`

### 1.4 Populate Key Vault Secrets

After deployment, find your Key Vault name and populate the required secrets:

```bash
KV_NAME="fundrbolt-production-kv"   # adjust if appName differs

# Core application secrets
az keyvault secret set --vault-name "$KV_NAME" --name "DATABASE-URL" \
  --value "postgresql+asyncpg://<user>:<password>@fundrbolt-production-postgres.postgres.database.azure.com/fundrbolt?sslmode=require"

az keyvault secret set --vault-name "$KV_NAME" --name "REDIS-URL" \
  --value "rediss://:fundrbolt-production-redis.redis.cache.windows.net:6380/0"

az keyvault secret set --vault-name "$KV_NAME" --name "SECRET-KEY" \
  --value "$(openssl rand -hex 32)"

az keyvault secret set --vault-name "$KV_NAME" --name "SENTRY-DSN-BACKEND" \
  --value "<backend-sentry-dsn>"   # from Step 2.1 below

# Email / SMTP (Azure Communication Services connection string)
az keyvault secret set --vault-name "$KV_NAME" --name "EMAIL-CONNECTION-STRING" \
  --value "<acs-connection-string>"

# Postgres admin password (used by migration jobs)
az keyvault secret set --vault-name "$KV_NAME" --name "POSTGRES-ADMIN-PASSWORD" \
  --value "<STRONG-PASSWORD-HERE>"
```

> Get the PostgreSQL connection string hostname from:
> `az postgres flexible-server show -n fundrbolt-production-postgres -g fundrbolt-production-rg --query fullyQualifiedDomainName -o tsv`

> Get the Redis hostname + key from:
> `az redis show -n fundrbolt-production-redis -g fundrbolt-production-rg --query hostName -o tsv`
> `az redis list-keys -n fundrbolt-production-redis -g fundrbolt-production-rg --query primaryKey -o tsv`

---

## Part 2: Sentry Setup

### 2.1 Create Sentry Projects

1. Log in to [sentry.io](https://sentry.io) (create a free account if you don't have one)
2. Create an **Organization** named `fundrbolt` (or similar)
3. Create four **Projects**:
   - `fundrbolt-backend` (Python / FastAPI)
   - `fundrbolt-admin` (React)
   - `fundrbolt-donor` (React)
   - `fundrbolt-landing` (React)
4. Copy the **DSN** for each project (Settings → Client Keys → DSN)
5. Create a **Sentry Auth Token** for source map uploads:
   - User Settings → Auth Tokens → Create New Token
   - Scopes needed: `project:write`, `project:releases`, `org:read`

---

## Part 3: GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** and add:

### Azure OIDC (no passwords stored)
| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | App (Client) ID from step 1.2 |
| `AZURE_TENANT_ID` | Tenant ID from step 1.2 |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID from step 1.2 |

### Static Web Apps deployment tokens

After Bicep deployment, retrieve each SWA deployment token:

```bash
RG="fundrbolt-production-rg"

# Admin PWA
az staticwebapp secrets list \
  --name fundrbolt-production-admin \
  --resource-group "$RG" \
  --query properties.apiKey -o tsv

# Donor PWA
az staticwebapp secrets list \
  --name fundrbolt-production-donor \
  --resource-group "$RG" \
  --query properties.apiKey -o tsv

# Landing Site
az staticwebapp secrets list \
  --name fundrbolt-production-landing \
  --resource-group "$RG" \
  --query properties.apiKey -o tsv
```

| Secret | Value |
|--------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN_PROD` | Token for admin SWA |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DONOR_PROD` | Token for donor SWA |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING_PROD` | Token for landing SWA |

### Sentry
| Secret | Value |
|--------|-------|
| `VITE_SENTRY_DSN_ADMIN` | Admin PWA DSN from Sentry |
| `VITE_SENTRY_DSN_DONOR` | Donor PWA DSN from Sentry |
| `VITE_SENTRY_DSN_LANDING` | Landing site DSN from Sentry |
| `SENTRY_AUTH_TOKEN` | Auth token for source map uploads |
| `SENTRY_ORG` | Sentry organization slug (e.g. `fundrbolt`) |

### Container Registry

The backend image uses GHCR (GitHub Container Registry) — **no additional secrets needed**.
GHCR auth uses the built-in `GITHUB_TOKEN`.

However, make the GHCR package **public** (or grant pull access to the Container App
managed identity) so the Container App can pull images:

1. Go to **GitHub → Packages → fundrbolt-backend**
2. Set visibility to **Public**, or
3. Add the Container App's managed identity as a package reader

---

## Part 4: DNS Configuration

After deployment, get the endpoints to create DNS records:

```bash
RG="fundrbolt-production-rg"

# Backend API FQDN (Container App)
az containerapp show \
  --name fundrbolt-production-api \
  --resource-group "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv

# Admin PWA default hostname
az staticwebapp show \
  --name fundrbolt-production-admin \
  --resource-group "$RG" \
  --query defaultHostname -o tsv

# Donor PWA default hostname
az staticwebapp show \
  --name fundrbolt-production-donor \
  --resource-group "$RG" \
  --query defaultHostname -o tsv

# Landing Site default hostname
az staticwebapp show \
  --name fundrbolt-production-landing \
  --resource-group "$RG" \
  --query defaultHostname -o tsv
```

### DNS Records to Create

At your DNS registrar (or in Azure DNS if you delegated `fundrbolt.com`):

| Record | Type | Target |
|--------|------|--------|
| `api.fundrbolt.com` | CNAME | Container App FQDN from above |
| `app.fundrbolt.com` | CNAME | Admin SWA default hostname |
| `give.fundrbolt.com` | CNAME | Donor SWA default hostname |
| `www.fundrbolt.com` | CNAME | Landing Site default hostname |
| `fundrbolt.com` | A / ALIAS | Landing Site default hostname (ALIAS/ANAME at registrar, or redirect) |

> **Static Web Apps custom domain**: After DNS propagates, add the custom domain in each SWA:
> ```bash
> az staticwebapp hostname set \
>   --name fundrbolt-production-admin \
>   --resource-group fundrbolt-production-rg \
>   --hostname app.fundrbolt.com
> ```

---

## Part 5: First Deployment

Once GitHub Secrets are set, trigger the first production deployment:

```bash
# Push to main (or manually trigger from GitHub Actions)
gh workflow run backend-deploy.yml --ref main
gh workflow run frontend-deploy.yml --ref main
gh workflow run donor-pwa-deploy.yml --ref main
gh workflow run landing-site-deploy.yml --ref main
```

The `backend-deploy.yml` will automatically run database migrations via the Container Apps
Job before updating the API image.

---

## Part 6: Post-Deployment Testing Checklist

Work through these in order. Check each off before moving to the next section.

### 6.1 Infrastructure Health

- [ ] **Resource group exists**: `az group show -n fundrbolt-production-rg` returns 200
- [ ] **All resources deployed**: Open Azure Portal → Resource Group, confirm ~15 resources present
- [ ] **Key Vault accessible**: `az keyvault secret list --vault-name fundrbolt-production-kv` returns secrets
- [ ] **PostgreSQL reachable**: Container App logs show `"Database connection established"` (check via `az containerapp logs show -n fundrbolt-production-api -g fundrbolt-production-rg`)
- [ ] **Redis reachable**: Same log stream shows `"Redis connection established"`

### 6.2 Backend API

- [ ] **Health check**: `curl https://api.fundrbolt.com/health` returns `{"status": "healthy"}`
- [ ] **Detailed health**: `curl https://api.fundrbolt.com/health/detailed` returns DB + Redis both `"healthy"`
- [ ] **API docs accessible**: `https://api.fundrbolt.com/docs` loads the OpenAPI UI
- [ ] **Scale to zero**: Wait 15+ minutes with no traffic, then confirm replica count drops to 0 in Azure Portal
  - Container Apps → fundrbolt-production-api → Metrics → Replica Count

### 6.3 Database Migrations

- [ ] **Migration job succeeded**: In Azure Portal, check Container Apps Jobs → fundrbolt-production-migration → Execution History → last run is `Succeeded`
- [ ] **Schema up to date**: `curl https://api.fundrbolt.com/health/ready` returns 200 (would 503 if DB not ready)

### 6.4 Frontend Apps

- [ ] **Landing site loads**: `https://www.fundrbolt.com` renders homepage
- [ ] **Admin PWA loads**: `https://app.fundrbolt.com` renders login screen
- [ ] **Donor PWA loads**: `https://give.fundrbolt.com` renders donor landing
- [ ] **No console errors**: Open each URL in DevTools → Console, confirm no critical JS errors

### 6.5 Sentry Error Tracking

For each of the four Sentry projects, verify events are being received:

**Backend:**
- [ ] Make a request that causes a 500 error (e.g., remove a required header to trigger an unhandled exception in a dev/test endpoint)
- [ ] Confirm the error appears in the `fundrbolt-backend` Sentry project within ~30 seconds

**Admin PWA / Donor PWA / Landing Site:**
- [ ] In browser console on each app, run: `import('/sentry').then(s => s.captureMessage('test-event'))`
  - Or navigate to a non-existent route to trigger a React error boundary
- [ ] Confirm test events appear in the respective Sentry project
- [ ] **Source maps**: In Sentry, open an error event's stack trace — confirm it shows your TypeScript source (not minified JS). This confirms `sentryVitePlugin` is uploading source maps correctly

### 6.6 Full End-to-End User Flow

- [ ] **User registration**: Create a new account via the admin PWA or API
- [ ] **Email verification**: Confirm verification email is received via Azure Communication Services
- [ ] **Login / logout**: Confirm JWT auth flow works (15-min access token, 7-day refresh)
- [ ] **Event creation**: Create a test event as an NPO admin
- [ ] **Donor registration**: Register for the event via the donor PWA
- [ ] **Auction bidding**: Place a bid on an auction item

### 6.7 Cold-Start Performance

- [ ] With scale-to-zero enabled, confirm cold-start time is acceptable:
  1. Wait for replicas to scale to 0 (15 min idle)
  2. Make a request to `https://api.fundrbolt.com/health`
  3. Measure total response time (should be < 30 seconds for first request)
- [ ] Subsequent requests should be < 500ms

### 6.8 CI/CD Pipeline

- [ ] **Backend deploy**: Make a trivial change (e.g., add a comment), push to `main`, confirm `backend-deploy.yml` runs and completes successfully
- [ ] **Frontend deploy**: Confirm `frontend-deploy.yml`, `donor-pwa-deploy.yml`, and `landing-site-deploy.yml` all run and complete
- [ ] **Manual migration skip**: Manually trigger `backend-deploy.yml` via GitHub Actions UI with `skip_migrations: true`, confirm the migration step is skipped

### 6.9 Cost Verification

After 24 hours of normal use:

- [ ] Check Azure Cost Management: expected spend < $2/day (< $50/month target)
- [ ] Confirm budget alert email thresholds are set at 80% / 90% / 100%
- [ ] Verify scale-to-zero is saving compute cost during low-traffic periods

---

## Troubleshooting

### Container App fails to start

```bash
# View live logs
az containerapp logs show \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --follow

# Check environment variables and secrets are mounted
az containerapp show \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --query "properties.template.containers[0].env"
```

### Key Vault access denied

```bash
# Check managed identity has the Key Vault Secrets User role
API_PRINCIPAL=$(az containerapp show \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --query identity.principalId -o tsv)

az role assignment list \
  --assignee "$API_PRINCIPAL" \
  --scope "/subscriptions/<sub-id>/resourceGroups/fundrbolt-production-rg/providers/Microsoft.KeyVault/vaults/fundrbolt-production-kv"
```

### Migration job fails

```bash
# Check execution logs
az containerapp job execution logs show \
  --name fundrbolt-production-migration \
  --resource-group fundrbolt-production-rg \
  --execution <execution-name>

# List recent executions
az containerapp job execution list \
  --name fundrbolt-production-migration \
  --resource-group fundrbolt-production-rg \
  --query "[].{name:name, status:properties.status, startTime:properties.startTime}"
```

### Sentry source maps not working

1. Confirm `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` are set in GitHub Secrets
2. Check the deploy workflow's "Upload source maps" step logs in GitHub Actions
3. Verify the release name matches between `sentryVitePlugin` config and Sentry's releases page

---

## Calling the Feature Complete

The feature can be called complete when **all items in section 6** are checked off, including:

1. All four Sentry projects receiving events with working source maps
2. Scale-to-zero confirmed working (replicas reach 0 after 15 min idle)
3. First full end-to-end donor registration and bidding flow succeeds in production
4. 24-hour cost is on track to stay within the $50/month budget
5. CI/CD pipeline successfully auto-deploys a change to main

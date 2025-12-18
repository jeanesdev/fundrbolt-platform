# CI/CD Pipeline Guide

This guide explains the automated CI/CD pipelines for the Fundrbolt platform.

## Overview

The Fundrbolt platform uses GitHub Actions for continuous integration and deployment across three environments:

- **Development**: Automatic deployment on every merge to `main`
- **Staging**: Automatic deployment after successful dev deployment
- **Production**: Manual approval required after successful staging deployment

## Pipeline Architecture

```
┌─────────────────┐
│   Pull Request  │
│                 │
│  • Code checks  │
│  • Tests        │
│  • Security     │
│  • Infrastructure│
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Merge to main │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ↓                  ↓                  ↓
   ┌──────────┐       ┌──────────┐      ┌──────────┐
   │ Backend  │       │ Frontend │      │Infrastructure│
   │ Pipeline │       │ Pipeline │      │  Pipeline    │
   └────┬─────┘       └────┬─────┘      └──────┬──────┘
        │                  │                    │
        ↓                  ↓                    ↓
   ┌──────────┐       ┌──────────┐      ┌──────────┐
   │   Dev    │       │   Dev    │      │   Dev    │
   └────┬─────┘       └────┬─────┘      └────┬─────┘
        │                  │                  │
        ↓                  ↓                  ↓
   ┌──────────┐       ┌──────────┐      ┌──────────┐
   │ Staging  │       │ Staging  │      │ Staging  │
   └────┬─────┘       └────┬─────┘      └────┬─────┘
        │                  │                  │
        ↓                  ↓                  ↓
   ┌──────────┐       ┌──────────┐      ┌──────────┐
   │Production│       │Production│      │Production│
   │(Manual)  │       │(Manual)  │      │(Manual)  │
   └──────────┘       └──────────┘      └──────────┘
```

## Workflows

### 1. PR Checks (`pr-checks.yml`)

Runs automatically on every pull request to validate code quality.

**Jobs:**
- **Backend Validation**
  - Poetry dependency check
  - Ruff linting
  - Black formatting
  - MyPy type checking
  - Pytest with coverage

- **Frontend Validation**
  - pnpm dependency installation
  - ESLint linting
  - TypeScript type checking
  - Build verification

- **Infrastructure Validation**
  - Bicep template syntax validation
  - Deployment validation
  - What-if analysis

- **Security Scan**
  - Trivy vulnerability scanning
  - Dependency audit

**Trigger:**
```yaml
on:
  pull_request:
    branches: [main, develop]
```

**Required Status Checks:**
All jobs must pass before merging is allowed.

### 2. Backend Deployment (`backend-deploy.yml`)

Deploys the FastAPI backend application to Azure App Service.

**Deployment Flow:**

1. **Build Phase**
   - Build Docker image from `./backend/Dockerfile`
   - Tag with branch name, commit SHA, and semantic version
   - Push to GitHub Container Registry (`ghcr.io`)

2. **Deploy to Dev**
   - Configure container in App Service
   - Restart application
   - Run database migrations
   - Health check verification

3. **Deploy to Staging**
   - Same process as dev
   - Requires dev deployment success

4. **Deploy to Production** (Manual Approval)
   - Deploy to staging slot
   - Run health checks on staging slot
   - Swap staging slot to production (blue-green deployment)
   - Verify production health
   - Automatic rollback on failure

**Trigger:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-deploy.yml'
```

**Production Deployment:**
Requires manual approval in GitHub environments.

**Rollback Process:**
Automatic slot swap reversal if health checks fail.

### 3. Frontend Deployment (`frontend-deploy.yml`)

Deploys the React frontend to Azure Static Web Apps.

**Deployment Flow:**

1. **Build Phase**
   - Install pnpm dependencies
   - Build with environment-specific `VITE_API_URL`
   - Output to `dist/` directory

2. **Deploy to Dev**
   - Deploy to Azure Static Web Apps (dev instance)
   - Use dev deployment token

3. **Deploy to Staging**
   - Deploy to staging instance
   - Requires dev deployment success

4. **Deploy to Production** (Manual Approval)
   - Deploy to production instance
   - Requires staging deployment success

**Trigger:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'frontend/fundrbolt-admin/**'
      - '.github/workflows/frontend-deploy.yml'
```

**API URLs by Environment:**
- Dev: `https://fundrbolt-dev-api.azurewebsites.net`
- Staging: `https://fundrbolt-staging-api.azurewebsites.net`
- Production: `https://api.fundrbolt.app`

### 4. Infrastructure Deployment (`infrastructure-deploy.yml`)

Deploys Azure infrastructure using Bicep templates.

**Deployment Flow:**

1. **Validation Phase**
   - Validate Bicep templates
   - Run what-if analysis
   - Display proposed changes

2. **Deployment Phase**
   - Deploy resource group
   - Deploy all Azure resources
   - Verify resource creation
   - Display deployment outputs

**Trigger:**
```yaml
on:
  workflow_dispatch:
    inputs:
      environment: [dev, staging, production]
      postgres_password: (secure input)

  push:
    branches: [main]
    paths:
      - 'infrastructure/bicep/**'
```

**Note:** Infrastructure deployments are typically manual via `workflow_dispatch` to prevent accidental resource modifications.

## Environment Configuration

### GitHub Environments

Three environments are configured with different protection rules:

| Environment | Auto-Deploy | Approvers | Wait Timer |
|-------------|-------------|-----------|------------|
| dev         | ✅ Yes      | None      | None       |
| staging     | ✅ Yes      | None      | None       |
| production  | ❌ No       | Required  | Optional   |

### Required Secrets

Configure these secrets in GitHub repository settings:

**Azure Credentials (OIDC):**
```
AZURE_CLIENT_ID         - Service principal client ID
AZURE_TENANT_ID         - Azure tenant ID
AZURE_SUBSCRIPTION_ID   - Azure subscription ID
```

**PostgreSQL:**
```
POSTGRES_ADMIN_PASSWORD - PostgreSQL admin password (per environment)
```

**Static Web Apps Deployment Tokens:**
```
AZURE_STATIC_WEB_APPS_API_TOKEN_DEV
AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING
AZURE_STATIC_WEB_APPS_API_TOKEN_PRODUCTION
```

**Container Registry:**
```
GITHUB_TOKEN - Automatically provided by GitHub Actions
```

### Setting up OIDC Authentication

1. Create Azure AD App Registration:
```bash
az ad app create --display-name "fundrbolt-github-actions"
```

2. Create Service Principal:
```bash
az ad sp create --id <app-id>
```

3. Add Federated Credentials:
```bash
az ad app federated-credential create \
  --id <app-id> \
  --parameters '{
    "name": "fundrbolt-github-actions",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:your-org/fundrbolt-platform:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

4. Assign Contributor Role:
```bash
az role assignment create \
  --assignee <service-principal-id> \
  --role Contributor \
  --scope /subscriptions/<subscription-id>
```

## Deployment Scripts

### Backend Deployment (`deploy-backend.sh`)

Deploys Docker container to Azure App Service with blue-green deployment for production.

**Usage:**
```bash
./infrastructure/scripts/deploy-backend.sh <environment> <image-tag>
```

**Example:**
```bash
./infrastructure/scripts/deploy-backend.sh production v1.2.3
```

**Features:**
- Automatic staging slot deployment for production
- Health check verification
- Slot swap to production
- Rollback on failure

### Frontend Deployment (`deploy-frontend.sh`)

Builds and deploys frontend to Azure Static Web Apps.

**Usage:**
```bash
./infrastructure/scripts/deploy-frontend.sh <environment> <deployment-token>
```

**Example:**
```bash
./infrastructure/scripts/deploy-frontend.sh production $AZURE_STATIC_WEB_APPS_API_TOKEN_PRODUCTION
```

### Database Migrations (`run-migrations.sh`)

Runs Alembic database migrations.

**Usage:**
```bash
./infrastructure/scripts/run-migrations.sh <environment>
```

**Example:**
```bash
./infrastructure/scripts/run-migrations.sh production
```

**Features:**
- Retrieves DATABASE_URL from App Service
- Runs `alembic upgrade head`
- Displays current migration version

### Rollback (`rollback.sh`)

Rolls back failed production deployments.

**Usage:**
```bash
# Rollback backend (swap slots)
./infrastructure/scripts/rollback.sh backend

# Rollback backend (specific version)
./infrastructure/scripts/rollback.sh backend v1.2.2

# Rollback frontend
./infrastructure/scripts/rollback.sh frontend
```

## Manual Deployment

### Deploy Backend Manually

1. Build and push Docker image:
```bash
cd backend
docker build -t ghcr.io/your-org/fundrbolt-backend:v1.0.0 .
docker push ghcr.io/your-org/fundrbolt-backend:v1.0.0
```

2. Deploy to environment:
```bash
./infrastructure/scripts/deploy-backend.sh production v1.0.0
```

3. Run migrations:
```bash
./infrastructure/scripts/run-migrations.sh production
```

### Deploy Frontend Manually

1. Get deployment token from Azure Portal:
   - Navigate to Static Web App
   - Go to "Configuration"
   - Copy deployment token

2. Deploy:
```bash
export DEPLOYMENT_TOKEN="<your-token>"
./infrastructure/scripts/deploy-frontend.sh production $DEPLOYMENT_TOKEN
```

### Deploy Infrastructure Manually

1. Validate templates:
```bash
./infrastructure/scripts/validate.sh production
```

2. Review what-if analysis:
```bash
cd infrastructure/bicep
az deployment sub what-if \
  --location eastus \
  --template-file main.bicep \
  --parameters environment=production location=eastus postgresAdminPassword="<password>"
```

3. Deploy:
```bash
./infrastructure/scripts/provision.sh production <postgres-password>
```

## Monitoring Deployments

### GitHub Actions UI

Monitor deployment progress in GitHub Actions tab:
- View real-time logs
- Check job status
- Review deployment history
- Approve production deployments

### Azure Portal

Monitor Azure resources:
- **App Service**: Deployment logs, container logs, metrics
- **Static Web Apps**: Deployment history, build logs
- **Application Insights**: Performance metrics, exceptions

### Health Checks

All deployments verify application health:

**Backend:**
```bash
curl https://fundrbolt-production-api.azurewebsites.net/health
```

**Frontend:**
```bash
curl https://fundrbolt-production-web.azurestaticapps.net/
```

## Troubleshooting

### Deployment Failed

1. **Check GitHub Actions logs**
   - Navigate to Actions tab
   - Click on failed workflow
   - Review step-by-step logs

2. **Check Azure logs**
   ```bash
   # App Service logs
   az webapp log tail --name fundrbolt-production-api --resource-group fundrbolt-production-rg

   # Container logs
   az webapp log download --name fundrbolt-production-api --resource-group fundrbolt-production-rg
   ```

3. **Verify secrets**
   - Ensure all GitHub secrets are configured
   - Check secret expiration dates
   - Verify Key Vault access

### Health Check Failed

1. **Check application logs**
2. **Verify environment variables**
3. **Check database connectivity**
4. **Verify Redis connectivity**
5. **Check Application Insights for errors**

### Rollback Failed

1. **Manual slot swap**
   ```bash
   az webapp deployment slot swap \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg \
     --slot staging \
     --target-slot production
   ```

2. **Redeploy previous version**
   ```bash
   ./infrastructure/scripts/deploy-backend.sh production v1.2.2
   ```

### Migration Failed

1. **Check database connectivity**
2. **Verify DATABASE_URL**
3. **Run migrations manually:**
   ```bash
   cd backend
   export DATABASE_URL="<connection-string>"
   poetry run alembic upgrade head
   ```

## Best Practices

### 1. Always Test in Dev/Staging First
- Never deploy directly to production
- Verify functionality in staging
- Run load tests if needed

### 2. Use Semantic Versioning
- Tag releases: `v1.2.3`
- Docker images inherit tags
- Enables easy rollback

### 3. Monitor After Deployment
- Watch Application Insights for 15 minutes
- Check error rates and response times
- Verify health endpoints

### 4. Keep Secrets Secure
- Rotate secrets regularly
- Use Key Vault references
- Never commit secrets to Git

### 5. Review What-If Before Infrastructure Changes
- Always run what-if analysis
- Review proposed changes carefully
- Test in dev environment first

### 6. Maintain Rollback Capability
- Keep previous Docker images
- Document rollback procedures
- Test rollback process regularly

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure App Service Deployment](https://docs.microsoft.com/en-us/azure/app-service/deploy-best-practices)
- [Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Bicep Documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/bicep/)

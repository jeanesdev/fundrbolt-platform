# Infrastructure Contracts

This directory contains Infrastructure as Code templates and CI/CD workflow definitions for the Fundrbolt Platform.

## Contents

### Bicep Templates (Preferred)

- `main.bicep` - Main orchestration template
- `modules/` - Reusable resource modules
  - `app-service.bicep` - App Service Plan and App Service
  - `database.bicep` - PostgreSQL Flexible Server
  - `redis.bicep` - Azure Cache for Redis
  - `key-vault.bicep` - Key Vault with RBAC
  - `dns.bicep` - DNS Zone and records
  - `monitoring.bicep` - Application Insights and Log Analytics
  - `communication.bicep` - Azure Communication Services
  - `storage.bicep` - Storage Account for backups
- `parameters/` - Environment-specific parameters
  - `dev.bicepparam` - Development environment
  - `staging.bicepparam` - Staging environment
  - `production.bicepparam` - Production environment

### GitHub Actions Workflows

- `infrastructure-deploy.yml` - Infrastructure provisioning workflow
- `backend-deploy.yml` - Backend application deployment workflow
- `frontend-deploy.yml` - Frontend application deployment workflow

## Usage

### Deploy Infrastructure

```bash
# Deploy to development
az deployment group create \
  --resource-group fundrbolt-dev-rg \
  --template-file main.bicep \
  --parameters @parameters/dev.bicepparam

# Deploy to production (with what-if preview)
az deployment group what-if \
  --resource-group fundrbolt-prod-rg \
  --template-file main.bicep \
  --parameters @parameters/production.bicepparam

# After review, deploy
az deployment group create \
  --resource-group fundrbolt-prod-rg \
  --template-file main.bicep \
  --parameters @parameters/production.bicepparam
```

### CI/CD Deployment

Infrastructure deployments are automated via GitHub Actions:

1. Push Bicep changes to feature branch
2. Create pull request → workflow runs `what-if` preview
3. Merge to main → workflow deploys to staging automatically
4. Manual approval → workflow deploys to production

## Template Structure

Each Bicep module follows this pattern:

```bicep
@description('Environment name (dev, staging, production)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Common tags for all resources')
param tags object

// Resource definitions...

output resourceId string = resource.id
output resourceName string = resource.name
```

## Next Steps

These templates will be generated in Phase 2 (Implementation) by the `/speckit.tasks` command.

For now, this directory serves as a specification of what contracts will be created.

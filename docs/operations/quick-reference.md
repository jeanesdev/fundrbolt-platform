# Quick Reference Guide

Fast reference for common operations on the Fundrbolt Platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Common Commands](#common-commands)
- [Deployment](#deployment)
- [Rollback](#rollback)
- [Logs & Monitoring](#logs--monitoring)
- [Scaling](#scaling)
- [Backup & Restore](#backup--restore)
- [Secrets Management](#secrets-management)
- [Troubleshooting](#troubleshooting)

## Prerequisites

```bash
# Required tools
- Azure CLI (2.50+)
- Bicep CLI (0.20+)
- Docker
- Node.js 22+ with pnpm
- Python 3.11+ with Poetry

# Login to Azure
az login
az account set --subscription <subscription-id>

# Set environment variables
export ENVIRONMENT=production  # or dev, staging
export RESOURCE_GROUP=fundrbolt-${ENVIRONMENT}-rg
export APP_NAME=fundrbolt-${ENVIRONMENT}-api
```

## Common Commands

### Infrastructure

```bash
# Validate Bicep templates
make validate-infra ENV=production

# Deploy infrastructure
make deploy-infra ENV=production TAG=v1.0.0

# View deployment status
az deployment sub show \
    --name fundrbolt-production-deployment \
    --query properties.provisioningState
```

### Backend

```bash
# Run backend locally
make dev-backend  # or make b

# Run tests
make test-backend

# Deploy backend
make deploy-backend ENV=production TAG=v1.0.0

# View backend logs
az webapp log tail \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP}
```

### Frontend

```bash
# Run frontend locally
make dev-frontend  # or make f

# Build frontend
cd frontend/fundrbolt-admin && pnpm build

# Deploy frontend
make deploy-frontend ENV=production TAG=v1.0.0
```

### Database

```bash
# Run migrations
make migrate  # or make m

# Create migration
make migrate-create NAME="add_user_table"

# Seed database
make db-seed

# Connect to database
az postgres flexible-server connect \
    --name fundrbolt-production-postgres \
    --admin-user fundrbolt_admin \
    --admin-password <password> \
    --database fundrbolt
```

## Deployment

### Full Stack Deployment

```bash
# 1. Deploy infrastructure
make deploy-infra ENV=production TAG=v1.2.0

# 2. Configure secrets
make configure-secrets ENV=production

# 3. Deploy backend
make deploy-backend ENV=production TAG=v1.2.0

# 4. Run migrations
./infrastructure/scripts/run-migrations.sh production

# 5. Deploy frontend
make deploy-frontend ENV=production TAG=v1.2.0

# 6. Verify deployment
curl https://api.fundrbolt.app/health
curl https://admin.fundrbolt.app
```

### Backend Only Deployment

```bash
# Using blue-green deployment (production)
./infrastructure/scripts/deploy-backend.sh production v1.2.0

# Direct deployment (dev/staging)
az webapp deployment source config-zip \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --src backend.zip
```

### Frontend Only Deployment

```bash
# Deploy to Static Web Apps
./infrastructure/scripts/deploy-frontend.sh production v1.2.0
```

## Rollback

### Backend Rollback

```bash
# Automatic rollback (within 30 minutes)
./infrastructure/scripts/rollback.sh production backend

# Manual rollback to specific version
az webapp deployment slot swap \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --slot staging \
    --action swap \
    --target-slot production
```

### Database Rollback

```bash
# Point-in-time restore (last 30 days)
az postgres flexible-server restore \
    --resource-group ${RESOURCE_GROUP} \
    --name fundrbolt-production-postgres-restored \
    --source-server fundrbolt-production-postgres \
    --restore-time "2025-10-20T10:00:00Z"
```

### Frontend Rollback

```bash
# Rollback to previous deployment
./infrastructure/scripts/rollback.sh production frontend

# Or manually re-deploy previous version
./infrastructure/scripts/deploy-frontend.sh production v1.1.0
```

## Logs & Monitoring

### View Application Logs

```bash
# Backend logs (real-time)
az webapp log tail \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP}

# Download logs
az webapp log download \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --log-file backend-logs.zip

# Frontend logs (Static Web Apps)
az staticwebapp logs show \
    --name fundrbolt-production-admin \
    --resource-group ${RESOURCE_GROUP}
```

### View Infrastructure Metrics

```bash
# App Service metrics
az monitor metrics list \
    --resource ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --resource-type "Microsoft.Web/sites" \
    --metric CpuPercentage MemoryPercentage Http5xx

# Database metrics
az monitor metrics list \
    --resource fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP} \
    --resource-type "Microsoft.DBforPostgreSQL/flexibleServers" \
    --metric cpu_percent memory_percent active_connections
```

### Query Application Insights

```bash
# Error rate (last hour)
az monitor app-insights query \
    --app fundrbolt-production-insights \
    --resource-group ${RESOURCE_GROUP} \
    --analytics-query "requests | where timestamp > ago(1h) | summarize error_rate = countif(success == false) * 100.0 / count()"

# Slow requests (P95 > 500ms)
az monitor app-insights query \
    --app fundrbolt-production-insights \
    --resource-group ${RESOURCE_GROUP} \
    --analytics-query "requests | summarize p95=percentile(duration, 95) by name | where p95 > 500"
```

### Health Checks

```bash
# Backend health
curl https://api.fundrbolt.app/health

# Detailed health (includes database, Redis, email)
curl https://api.fundrbolt.app/health/detailed

# Frontend health
curl https://admin.fundrbolt.app

# All services health
make health-check
```

## Scaling

### Manual Scaling

```bash
# Scale App Service instances
az appservice plan update \
    --name fundrbolt-production-asp \
    --resource-group ${RESOURCE_GROUP} \
    --number-of-workers 5

# Scale up App Service SKU
az appservice plan update \
    --name fundrbolt-production-asp \
    --resource-group ${RESOURCE_GROUP} \
    --sku S2
```

### Auto-scaling Configuration

```bash
# View auto-scale settings
az monitor autoscale show \
    --name fundrbolt-production-asp-autoscale \
    --resource-group ${RESOURCE_GROUP}

# Disable auto-scaling temporarily
az monitor autoscale update \
    --name fundrbolt-production-asp-autoscale \
    --resource-group ${RESOURCE_GROUP} \
    --enabled false

# Re-enable auto-scaling
az monitor autoscale update \
    --name fundrbolt-production-asp-autoscale \
    --resource-group ${RESOURCE_GROUP} \
    --enabled true
```

### Database Scaling

```bash
# Scale database compute
az postgres flexible-server update \
    --name fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP} \
    --sku-name Standard_D4s_v3

# Scale database storage
az postgres flexible-server update \
    --name fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP} \
    --storage-size 256
```

## Backup & Restore

### Manual Backup

```bash
# PostgreSQL backup (automatic)
az postgres flexible-server backup list \
    --name fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP}

# Redis export to blob storage
az redis export \
    --name fundrbolt-production-redis \
    --resource-group ${RESOURCE_GROUP} \
    --container backups \
    --prefix redis-backup-$(date +%Y%m%d-%H%M%S)

# Database pg_dump
az postgres flexible-server execute \
    --name fundrbolt-production-postgres \
    --admin-user fundrbolt_admin \
    --admin-password <password> \
    --database-name fundrbolt \
    --querytext "SELECT 1" \
    > backup.sql
```

### Restore from Backup

```bash
# PostgreSQL point-in-time restore
az postgres flexible-server restore \
    --resource-group ${RESOURCE_GROUP} \
    --name fundrbolt-production-postgres-restored \
    --source-server fundrbolt-production-postgres \
    --restore-time "2025-10-20T10:00:00Z"

# Redis import from blob storage
az redis import \
    --name fundrbolt-production-redis \
    --resource-group ${RESOURCE_GROUP} \
    --files https://<storage-account>.blob.core.windows.net/backups/redis-backup.rdb

# Full disaster recovery test
./infrastructure/scripts/test-disaster-recovery.sh production
```

## Secrets Management

### View Secrets

```bash
# List secrets in Key Vault
az keyvault secret list \
    --vault-name fundrbolt-production-kv

# Get secret value
az keyvault secret show \
    --vault-name fundrbolt-production-kv \
    --name database-url \
    --query value -o tsv
```

### Update Secrets

```bash
# Update secret in Key Vault
az keyvault secret set \
    --vault-name fundrbolt-production-kv \
    --name jwt-secret \
    --value <new-secret-value>

# Update App Service settings with new Key Vault references
make update-app-settings ENV=production

# Restart App Service to pick up new secrets
az webapp restart \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP}
```

### Rotate Secrets

```bash
# Run secret rotation script
./infrastructure/scripts/configure-secrets.sh production --rotate

# Or manually rotate specific secret
az keyvault secret set \
    --vault-name fundrbolt-production-kv \
    --name jwt-secret \
    --value $(openssl rand -base64 32)
```

## Troubleshooting

### Application Not Responding

```bash
# 1. Check health endpoint
curl -I https://api.fundrbolt.app/health

# 2. Check App Service status
az webapp show \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --query state

# 3. View recent logs
az webapp log tail --name ${APP_NAME} --resource-group ${RESOURCE_GROUP}

# 4. Restart App Service
az webapp restart --name ${APP_NAME} --resource-group ${RESOURCE_GROUP}
```

### Database Connection Issues

```bash
# 1. Check PostgreSQL status
az postgres flexible-server show \
    --name fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP} \
    --query state

# 2. Test database connectivity
az postgres flexible-server connect \
    --name fundrbolt-production-postgres \
    --admin-user fundrbolt_admin \
    --admin-password <password> \
    --database fundrbolt

# 3. Check firewall rules
az postgres flexible-server firewall-rule list \
    --name fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP}

# 4. View database metrics
az monitor metrics list \
    --resource fundrbolt-production-postgres \
    --resource-group ${RESOURCE_GROUP} \
    --metric active_connections failed_connections
```

### High Error Rate

```bash
# 1. Check error rate in Application Insights
az monitor app-insights query \
    --app fundrbolt-production-insights \
    --analytics-query "requests | where timestamp > ago(1h) | summarize errors=countif(success==false), total=count() | extend error_rate=errors*100.0/total"

# 2. View recent errors
az monitor app-insights query \
    --app fundrbolt-production-insights \
    --analytics-query "exceptions | where timestamp > ago(1h) | order by timestamp desc | take 20"

# 3. Check dependency failures
az monitor app-insights query \
    --app fundrbolt-production-insights \
    --analytics-query "dependencies | where success == false | where timestamp > ago(1h) | summarize count() by name, resultCode"

# 4. Review alert history
az monitor activity-log list \
    --resource-group ${RESOURCE_GROUP} \
    --offset 1h
```

### Redis Connection Issues

```bash
# 1. Check Redis status
az redis show \
    --name fundrbolt-production-redis \
    --resource-group ${RESOURCE_GROUP} \
    --query provisioningState

# 2. View Redis metrics
az monitor metrics list \
    --resource fundrbolt-production-redis \
    --resource-group ${RESOURCE_GROUP} \
    --metric connectedclients serverLoad usedmemory

# 3. Test Redis connection
redis-cli -h fundrbolt-production-redis.redis.cache.windows.net \
    -p 6380 -a <redis-key> --tls PING

# 4. Restart Redis (careful - clears cache)
az redis force-reboot \
    --name fundrbolt-production-redis \
    --resource-group ${RESOURCE_GROUP} \
    --reboot-type AllNodes
```

### Deployment Failures

```bash
# 1. View deployment logs
az deployment sub show \
    --name fundrbolt-production-deployment \
    --query properties.error

# 2. View App Service deployment logs
az webapp log deployment show \
    --name ${APP_NAME} \
    --resource-group ${RESOURCE_GROUP}

# 3. Check container logs (if using Docker)
az webapp log tail --name ${APP_NAME} --resource-group ${RESOURCE_GROUP}

# 4. Rollback to previous version
./infrastructure/scripts/rollback.sh production backend
```

### Cost Overruns

```bash
# 1. View current month costs
az costmanagement query \
    --type ActualCost \
    --scope /subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP} \
    --timeframe MonthToDate

# 2. Identify most expensive resources
az costmanagement query \
    --type ActualCost \
    --scope /subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP} \
    --dataset-grouping name=ResourceType type=Dimension

# 3. Check budget status
az consumption budget list \
    --resource-group ${RESOURCE_GROUP}

# 4. Scale down non-production resources
make scale-down ENV=staging
```

## Emergency Contacts

- **On-call Engineer**: ops@fundrbolt.app
- **DevOps Team**: devops@fundrbolt.app
- **Platform Team**: engineering@fundrbolt.app

## Related Documentation

- [CI/CD Guide](./ci-cd-guide.md)
- [Rollback Procedures](./rollback-procedures.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Monitoring Guide](./monitoring-guide.md)
- [Cost Optimization](./cost-optimization.md)
- [Security Checklist](./security-checklist.md)

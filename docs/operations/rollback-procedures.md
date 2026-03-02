# Rollback Procedures

This document provides step-by-step instructions for rolling back failed deployments in the Fundrbolt platform.

## Quick Reference

| Component | Method | Time | Risk |
|-----------|--------|------|------|
| Backend (Production) | Slot swap | 30 seconds | Low |
| Backend (Dev/Staging) | Redeploy | 5 minutes | Low |
| Frontend | Redeploy | 3 minutes | Low |
| Infrastructure | Manual revert | 15 minutes | Medium |
| Database | Restore backup | 30-60 minutes | High |

## Backend Rollback

### Automatic Rollback

The production deployment workflow includes automatic rollback if health checks fail after slot swap.

**How it works:**
1. Deployment to staging slot
2. Health check verification
3. Slot swap to production
4. Production health check
5. If health check fails → automatic slot swap back

### Manual Slot Swap Rollback (Production)

**When to use:**
- Production deployment succeeded but issues discovered later
- Need to quickly revert to previous stable version

**Steps:**

1. **Verify current slot status**
   ```bash
   az webapp show \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg \
     --query "siteConfig.{slot: name}"
   ```

2. **Swap staging slot to production**
   ```bash
   az webapp deployment slot swap \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg \
     --slot staging \
     --target-slot production
   ```

3. **Verify health**
   ```bash
   curl -f https://fundrbolt-production-api.azurewebsites.net/health
   ```

4. **Monitor Application Insights**
   - Check error rates
   - Verify request counts
   - Review performance metrics

**Time to complete:** ~30 seconds

**Using rollback script:**
```bash
./infrastructure/scripts/rollback.sh backend
```

### Redeploy Previous Version (All Environments)

**When to use:**
- Staging slot is also problematic
- Need to deploy a specific previous version
- Dev/Staging environment rollback

**Steps:**

1. **Find previous stable version**
   ```bash
   # List recent Docker images
   gh api repos/your-org/fundrbolt-platform/packages/container/fundrbolt-backend/versions

   # Or check GitHub releases
   git tag -l "v*" | sort -V | tail -5
   ```

2. **Deploy previous version**
   ```bash
   ./infrastructure/scripts/deploy-backend.sh production v1.2.2
   ```

3. **Verify deployment**
   ```bash
   curl -f https://fundrbolt-production-api.azurewebsites.net/health
   ```

4. **Check logs**
   ```bash
   az webapp log tail \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg
   ```

**Time to complete:** ~5 minutes

**Using rollback script:**
```bash
./infrastructure/scripts/rollback.sh backend v1.2.2
```

## Frontend Rollback

### Redeploy Previous Version

Static Web Apps don't support slot swapping, so rollback requires redeploying a previous version.

**Steps:**

1. **Find previous stable commit/tag**
   ```bash
   git log --oneline frontend/fundrbolt-admin/ | head -10
   ```

2. **Checkout previous version**
   ```bash
   git checkout v1.2.2
   ```

3. **Get deployment token**
   ```bash
   # From GitHub secrets or Azure Portal
   echo $AZURE_STATIC_WEB_APPS_API_TOKEN_PRODUCTION
   ```

4. **Deploy previous version**
   ```bash
   ./infrastructure/scripts/deploy-frontend.sh production $DEPLOYMENT_TOKEN
   ```

5. **Verify deployment**
   ```bash
   curl -I https://fundrbolt-production-web.azurestaticapps.net/
   ```

6. **Return to main branch**
   ```bash
   git checkout main
   ```

**Time to complete:** ~3 minutes

### GitHub Actions Rerun

**Alternative method:**

1. Go to GitHub Actions tab
2. Find previous successful deployment workflow
3. Click "Re-run all jobs"
4. Approve production deployment

**Time to complete:** ~5 minutes

## Database Rollback

### Rollback Migration

**When to use:**
- Migration caused data issues
- Need to revert schema changes

**Steps:**

1. **SSH into App Service**
   ```bash
   az webapp ssh \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg
   ```

2. **Check current migration version**
   ```bash
   poetry run alembic current
   ```

3. **List migration history**
   ```bash
   poetry run alembic history
   ```

4. **Downgrade to previous version**
   ```bash
   # Downgrade one revision
   poetry run alembic downgrade -1

   # Or downgrade to specific revision
   poetry run alembic downgrade abc123def456
   ```

5. **Verify database state**
   ```bash
   poetry run alembic current
   ```

**Time to complete:** ~2 minutes

**⚠️ Warning:** Downgrading migrations may cause data loss if not designed properly.

### Restore from Backup

**When to use:**
- Data corruption
- Catastrophic migration failure
- Need to restore specific point in time

**Steps:**

1. **List available backups**
   ```bash
   az postgres flexible-server backup list \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-db
   ```

2. **Create restore request**
   ```bash
   az postgres flexible-server restore \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-db-restored \
     --source-server fundrbolt-production-db \
     --restore-time "2024-01-15T10:30:00Z"
   ```

3. **Wait for restore to complete**
   ```bash
   az postgres flexible-server show \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-db-restored \
     --query "state"
   ```

4. **Update App Service connection string**
   ```bash
   # Get new connection string
   NEW_DB_HOST=$(az postgres flexible-server show \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-db-restored \
     --query "fullyQualifiedDomainName" -o tsv)

   # Update Key Vault secret
   az keyvault secret set \
     --vault-name fundrbolt-production-kv \
     --name database-url \
     --value "postgresql://admin:password@$NEW_DB_HOST:5432/fundrbolt"
   ```

5. **Restart App Service**
   ```bash
   az webapp restart \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg
   ```

6. **Verify connectivity**
   ```bash
   curl -f https://fundrbolt-production-api.azurewebsites.net/health/detailed
   ```

**Time to complete:** 30-60 minutes

**⚠️ Warning:** This is a destructive operation. All data after the restore point will be lost.

## Infrastructure Rollback

### Bicep Deployment Rollback

**When to use:**
- Infrastructure deployment caused issues
- Need to revert resource configuration changes

**Steps:**

1. **Find previous stable template version**
   ```bash
   git log --oneline infrastructure/bicep/ | head -10
   ```

2. **Checkout previous version**
   ```bash
   git checkout abc123 -- infrastructure/bicep/
   ```

3. **Review what-if changes**
   ```bash
   cd infrastructure/bicep
   az deployment sub what-if \
     --location eastus \
     --template-file main.bicep \
     --parameters environment=production location=eastus postgresAdminPassword="<password>"
   ```

4. **Deploy previous template**
   ```bash
   ./infrastructure/scripts/provision.sh production <postgres-password>
   ```

5. **Verify resources**
   ```bash
   az resource list \
     --resource-group fundrbolt-production-rg \
     --output table
   ```

6. **Return to main branch**
   ```bash
   git checkout main -- infrastructure/bicep/
   ```

**Time to complete:** ~15 minutes

**⚠️ Warning:** Some resource changes may require recreation, causing downtime.

### Manual Resource Revert

**For individual resource changes:**

1. **Identify the changed resource**
2. **Get previous configuration** (from Git history or Azure Portal history)
3. **Update resource manually:**
   ```bash
   az <resource-type> update \
     --name <resource-name> \
     --resource-group fundrbolt-production-rg \
     --<property> <previous-value>
   ```

4. **Verify change**
   ```bash
   az <resource-type> show \
     --name <resource-name> \
     --resource-group fundrbolt-production-rg
   ```

## Redis Rollback

### Clear Cache

**When to use:**
- Corrupted cache data
- Stale session issues

**Steps:**

1. **Connect to Redis**
   ```bash
   REDIS_HOST=$(az redis show \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-redis \
     --query "hostName" -o tsv)

   REDIS_KEY=$(az redis list-keys \
     --resource-group fundrbolt-production-rg \
     --name fundrbolt-production-redis \
     --query "primaryKey" -o tsv)

   redis-cli -h $REDIS_HOST -p 6380 -a $REDIS_KEY --tls
   ```

2. **Flush all keys** (or selective deletion)
   ```bash
   # WARNING: This clears ALL cache data
   FLUSHALL

   # Or delete specific keys
   DEL session:*
   DEL jwt_blacklist:*
   ```

3. **Verify cache is cleared**
   ```bash
   DBSIZE
   ```

4. **Restart App Service** (to clear in-memory state)
   ```bash
   az webapp restart \
     --name fundrbolt-production-api \
     --resource-group fundrbolt-production-rg
   ```

**Time to complete:** ~2 minutes

**⚠️ Warning:** This will log out all users and invalidate all sessions.

## Emergency Procedures

### Complete System Rollback

**When to use:**
- Multiple components failed
- Coordinated rollback needed

**Steps:**

1. **Rollback backend**
   ```bash
   ./infrastructure/scripts/rollback.sh backend
   ```

2. **Rollback frontend**
   ```bash
   git checkout v1.2.2
   ./infrastructure/scripts/deploy-frontend.sh production $DEPLOYMENT_TOKEN
   git checkout main
   ```

3. **Rollback database migration** (if applicable)
   ```bash
   az webapp ssh --name fundrbolt-production-api --resource-group fundrbolt-production-rg
   poetry run alembic downgrade -1
   ```

4. **Clear Redis cache**
   ```bash
   redis-cli -h $REDIS_HOST -p 6380 -a $REDIS_KEY --tls FLUSHALL
   ```

5. **Verify all services**
   ```bash
   curl -f https://fundrbolt-production-api.azurewebsites.net/health/detailed
   curl -I https://fundrbolt-production-web.azurestaticapps.net/
   ```

**Time to complete:** ~10 minutes

### Disaster Recovery

**When to use:**
- Complete regional failure
- Data center outage

See [Backup and Disaster Recovery Plan](./backup-disaster-recovery.md) for full procedures.

## Post-Rollback Checklist

After any rollback:

- [ ] Verify application health endpoints
- [ ] Check Application Insights for errors
- [ ] Monitor error rates for 15 minutes
- [ ] Verify user-facing functionality
- [ ] Update status page if applicable
- [ ] Document incident in post-mortem
- [ ] Create GitHub issue for root cause analysis
- [ ] Plan fix and test in dev/staging
- [ ] Schedule new deployment when ready

## Communication Template

### Internal Team Notification

```
🚨 Production Rollback Initiated

Component: [Backend/Frontend/Infrastructure/Database]
Reason: [Brief description]
Started: [Timestamp]
Expected completion: [Timestamp]
Status: [In Progress/Complete]

Actions taken:
- [Step 1]
- [Step 2]
- [Step 3]

Current status:
- Backend: [Healthy/Unhealthy]
- Frontend: [Healthy/Unhealthy]
- Database: [Healthy/Unhealthy]

Next steps:
- [Action 1]
- [Action 2]
```

### User-Facing Status Update

```
We've identified an issue with our recent deployment and have rolled back
to the previous stable version. All services are now operating normally.
We apologize for any inconvenience.
```

## Contact Information

**During business hours:**
- DevOps team Slack channel: #devops
- On-call engineer: See PagerDuty rotation

**After hours:**
- Page on-call engineer via PagerDuty
- Escalate to DevOps lead if needed

## References

- [CI/CD Pipeline Guide](./ci-cd-guide.md)
- [Architecture Documentation](./architecture.md)
- [Monitoring Guide](./monitoring.md)
- [Azure App Service Deployment Slots](https://docs.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [PostgreSQL Backup and Restore](https://docs.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-backup-restore)

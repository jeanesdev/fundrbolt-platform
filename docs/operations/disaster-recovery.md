# Disaster Recovery Procedures

Comprehensive disaster recovery (DR) procedures for the Fundrbolt platform, including backup strategies, restore procedures, and RTO/RPO targets.

## Overview

The Fundrbolt platform implements a multi-layered backup strategy to ensure business continuity and data protection:

- **PostgreSQL**: Automated backups with point-in-time restore (PITR)
- **Redis**: AOF persistence (production) with export to blob storage
- **Storage Account**: Blob versioning and soft delete with lifecycle management
- **Application Code**: GitHub repository with branch protection

## Recovery Time & Point Objectives

| Environment | RTO (Recovery Time) | RPO (Recovery Point) | Notes |
|-------------|--------------------|--------------------|-------|
| Development | 4 hours | 24 hours | Lower priority, acceptable data loss |
| Staging | 2 hours | 1 hour | Test environment, moderate priority |
| Production | 1 hour | 15 minutes | Critical, minimal data loss |

### Definitions

- **RTO**: Maximum acceptable time to restore service after an incident
- **RPO**: Maximum acceptable data loss measured in time

## Backup Configuration

### PostgreSQL Flexible Server

**Automated Backups**:
- Development: 7-day retention, local redundancy
- Staging: 7-day retention, local redundancy
- Production: 30-day retention, geo-redundant

**Backup Schedule**:
- Full backup: Daily (automatic)
- Transaction logs: Continuous streaming
- Point-in-time restore: Any point within retention period

**Storage**:
- Backup data encrypted at rest (AES-256)
- Stored in geo-redundant Azure storage (production)
- Automatic backup rotation based on retention policy

### Redis Cache

**Persistence Strategy**:
- Development/Staging: Memory-only (ephemeral data)
- Production: AOF (Append-Only File) persistence enabled

**Backup Options**:
1. **AOF Persistence**: Continuous append-only log (production)
2. **RDB Export**: Manual snapshot to blob storage (on-demand)

**Export Procedure**:

```bash
# Get storage account credentials
STORAGE_ACCOUNT="fundrbolt-production-storage"
STORAGE_KEY=$(az storage account keys list \
    --resource-group "fundrbolt-production-rg" \
    --account-name "$STORAGE_ACCOUNT" \
    --query "[0].value" -o tsv)

# Export Redis data
az redis export \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --container "backups" \
    --prefix "redis-backup-$(date +%Y%m%d-%H%M%S)" \
    --file-format "rdb" \
    --storage-account-name "$STORAGE_ACCOUNT" \
    --storage-account-key "$STORAGE_KEY"
```

### Storage Account

**Data Protection Features**:
- Blob versioning: Enabled (all environments)
- Soft delete: 30 days (production), 7 days (dev/staging)
- Container soft delete: 30 days (production), 7 days (dev/staging)
- Change feed: 90-day retention

**Lifecycle Management**:
- Archive old backups after 90 days
- Delete backups after 365 days (production) or 90 days (dev/staging)
- Delete logs after 30 days

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption or Data Loss

**Detection**: Application errors, data integrity issues, user reports

**Impact**: Data loss, application errors, potential service disruption

**Recovery Procedure**:

1. **Assess the damage**

```bash
# Connect to database
psql -h fundrbolt-production-db.postgres.database.azure.com \
     -U fundrbolt_admin -d fundrbolt

# Check table counts
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM npos;
SELECT COUNT(*) FROM sessions;

# Identify corruption timestamp
SELECT MAX(updated_at) FROM users;
```

2. **Determine restore point**

```bash
# List available backups
az postgres flexible-server backup list \
    --resource-group "fundrbolt-production-rg" \
    --server-name "fundrbolt-production-db"

# Check earliest restore point
az postgres flexible-server show \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --query "backup.earliestRestoreDate"
```

3. **Create restore in staging for verification**

```bash
# Restore to staging first (test restore)
RESTORE_TIME="2025-10-27T18:00:00Z"  # Point before corruption

az postgres flexible-server restore \
    --resource-group "fundrbolt-staging-rg" \
    --name "fundrbolt-staging-db-restore" \
    --source-server "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/fundrbolt-production-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/fundrbolt-production-db" \
    --restore-time "$RESTORE_TIME"

# Wait for restore (10-15 minutes)
az postgres flexible-server wait \
    --name "fundrbolt-staging-db-restore" \
    --resource-group "fundrbolt-staging-rg" \
    --created
```

4. **Verify restored data**

```bash
# Connect to restored database
RESTORED_HOST=$(az postgres flexible-server show \
    --name "fundrbolt-staging-db-restore" \
    --resource-group "fundrbolt-staging-rg" \
    --query "fullyQualifiedDomainName" -o tsv)

psql -h "$RESTORED_HOST" -U fundrbolt_admin -d fundrbolt

# Verify data integrity
SELECT COUNT(*) FROM users;
SELECT MAX(updated_at) FROM users;
# Compare with known good state
```

5. **Perform production restore** (after verification)

```bash
# Stop application traffic (enable maintenance mode)
az webapp stop \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# Rename current database (backup)
az postgres flexible-server update \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --tags "status=backup-$(date +%Y%m%d)"

# Restore production database
az postgres flexible-server restore \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-db-restored" \
    --source-server "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/fundrbolt-production-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/fundrbolt-production-db" \
    --restore-time "$RESTORE_TIME"

# Update App Service connection string
# (use update-app-settings.sh with new database host)

# Start application
az webapp start \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"
```

6. **Verify service restoration**

```bash
# Check health endpoint
curl https://api.fundrbolt.com/health/detailed

# Monitor Application Insights for errors
# Check user login functionality
# Verify data completeness
```

**Expected RTO**: 45-60 minutes
**Expected RPO**: 15 minutes (continuous transaction log backup)

### Scenario 2: Redis Cache Failure

**Detection**: Session loss, cache miss rate spike, Redis connection errors

**Impact**: User logout, slower response times, increased database load

**Recovery Procedure**:

1. **Check Redis status**

```bash
az redis show \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --query "{provisioningState:provisioningState,redisVersion:redisVersion}"
```

2. **Verify AOF persistence** (production)

```bash
az redis show \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --query "redisConfiguration"
```

3. **Option A: Wait for automatic recovery** (if AOF enabled)

Redis will automatically restore from AOF file on restart. This is the preferred method for production.

4. **Option B: Import from RDB export** (if manual backup exists)

```bash
# List available Redis backups
az storage blob list \
    --account-name "fundrbolt-production-storage" \
    --container-name "backups" \
    --prefix "redis-backup" \
    --output table

# Import Redis data
az redis import \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --files "backups/redis-backup-20251027-120000.rdb" \
    --storage-account-name "fundrbolt-production-storage"
```

5. **Verify cache restoration**

```bash
# Check Redis key count
redis-cli -h fundrbolt-production-cache.redis.cache.windows.net \
    -p 6380 --tls --askpass INFO keyspace

# Test session retrieval
# Login as test user and verify session persistence
```

**Expected RTO**: 10-15 minutes (AOF restore), 30 minutes (RDB import)
**Expected RPO**: 0 minutes (AOF), 1 hour (RDB)

### Scenario 3: Regional Azure Outage

**Detection**: Azure status dashboard, all services unavailable, DNS resolution failure

**Impact**: Complete service unavailability, multi-hour outage

**Recovery Procedure**:

1. **Assess outage scope**

- Check Azure status: https://status.azure.com
- Verify affected regions and services
- Estimate recovery time from Azure updates

2. **Activate geo-redundant resources** (production only)

```bash
# PostgreSQL geo-redundant backup available in paired region
# Restore to new region

NEW_REGION="westus2"  # Paired region

# Create new resource group
az group create \
    --name "fundrbolt-production-rg-dr" \
    --location "$NEW_REGION"

# Restore database from geo-redundant backup
az postgres flexible-server geo-restore \
    --resource-group "fundrbolt-production-rg-dr" \
    --name "fundrbolt-production-db-dr" \
    --source-server "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/fundrbolt-production-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/fundrbolt-production-db" \
    --location "$NEW_REGION"
```

3. **Deploy application to new region**

```bash
# Deploy infrastructure to new region
./infrastructure/scripts/provision.sh production-dr

# Deploy backend
./infrastructure/scripts/deploy-backend.sh production-dr latest

# Deploy frontend
./infrastructure/scripts/deploy-frontend.sh production-dr
```

4. **Update DNS records**

```bash
# Update A record to point to new region
az network dns record-set a update \
    --resource-group "fundrbolt-production-rg" \
    --zone-name "fundrbolt.com" \
    --name "api" \
    --set aRecords[0].ipv4Address="<new-app-service-ip>"

# Update CNAME for Static Web App
az network dns record-set cname update \
    --resource-group "fundrbolt-production-rg" \
    --zone-name "fundrbolt.com" \
    --name "admin" \
    --cname "<new-static-web-app-url>"
```

5. **Verify service in new region**

```bash
# Check DNS propagation
nslookup api.fundrbolt.com
nslookup admin.fundrbolt.com

# Test endpoints
curl https://api.fundrbolt.com/health
curl https://admin.fundrbolt.com
```

**Expected RTO**: 3-4 hours (full regional failover)
**Expected RPO**: 15 minutes (geo-redundant backup lag)

### Scenario 4: Accidental Data Deletion

**Detection**: User report, data validation checks, application errors

**Impact**: Missing data, application errors, user complaints

**Recovery Procedure**:

1. **Determine deletion scope and time**

```bash
# Check audit logs for deletion events
az monitor activity-log list \
    --resource-group "fundrbolt-production-rg" \
    --start-time "2025-10-27T00:00:00Z" \
    --query "[?contains(operationName.value, 'delete')]"
```

2. **Option A: Restore from soft delete** (Storage Account)

```bash
# List deleted blobs
az storage blob list \
    --account-name "fundrbolt-production-storage" \
    --container-name "backups" \
    --include d \
    --output table

# Undelete blob
az storage blob undelete \
    --account-name "fundrbolt-production-storage" \
    --container-name "backups" \
    --name "deleted-file.dat"
```

3. **Option B: Restore from blob version** (Storage Account)

```bash
# List blob versions
az storage blob list \
    --account-name "fundrbolt-production-storage" \
    --container-name "backups" \
    --include v \
    --output table

# Copy previous version
az storage blob copy start \
    --account-name "fundrbolt-production-storage" \
    --destination-container "backups" \
    --destination-blob "restored-file.dat" \
    --source-container "backups" \
    --source-blob "file.dat" \
    --source-blob-version-id "<version-id>"
```

4. **Option C: Database point-in-time restore** (see Scenario 1)

**Expected RTO**: 5-10 minutes (soft delete/version), 45-60 minutes (database PITR)
**Expected RPO**: 0 minutes (version/soft delete), 15 minutes (database)

## Testing & Validation

### Quarterly DR Drill Schedule

Execute comprehensive DR tests quarterly to validate procedures and maintain team readiness:

**Q1 (January)**:
- Database restore to staging
- Verify data integrity
- Measure restore time

**Q2 (April)**:
- Redis export/import test
- Full application stack recovery
- Regional failover simulation (tabletop)

**Q3 (July)**:
- Storage account recovery
- Blob version restoration
- Documentation review and updates

**Q4 (October)**:
- Complete production DR drill
- Multi-component failure simulation
- RTO/RPO compliance validation

### DR Drill Checklist

Use this checklist for each DR drill:

- [ ] Schedule drill with team (avoid business hours)
- [ ] Notify stakeholders of test
- [ ] Run test-disaster-recovery.sh script
- [ ] Document actual vs. expected RTO/RPO
- [ ] Test restore data integrity
- [ ] Verify application functionality post-restore
- [ ] Document issues and lessons learned
- [ ] Update procedures based on findings
- [ ] Archive test report and logs
- [ ] Clean up test resources

### Automated DR Testing

Run automated DR tests using the test script:

```bash
# Test database restore from production to staging
./infrastructure/scripts/test-disaster-recovery.sh production staging

# Review test results
cat dr-test-*.log
```

## Monitoring & Alerting

### Backup Monitoring

Monitor backup health to ensure DR readiness:

```bash
# Check PostgreSQL backup status
az postgres flexible-server backup list \
    --resource-group "fundrbolt-production-rg" \
    --server-name "fundrbolt-production-db"

# Verify latest backup timestamp
az postgres flexible-server show \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --query "backup.earliestRestoreDate"

# Check Redis persistence
az redis show \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --query "redisConfiguration.\"aof-backup-enabled\""
```

### Alert Configuration

Configure Azure Monitor alerts for backup failures:

- PostgreSQL backup failure alert
- Redis persistence disabled alert
- Storage account replication lag alert
- Geo-redundant backup lag alert (>30 minutes)

## Troubleshooting

### Database Restore Fails

```bash
# Check subscription quota
az postgres flexible-server list \
    --query "length(@)" -o tsv

# Verify source database is healthy
az postgres flexible-server show \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --query "state"

# Check available restore points
az postgres flexible-server show \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --query "backup.earliestRestoreDate"
```

### Redis Import Fails

```bash
# Verify RDB file format
# Check storage account connectivity
# Ensure Redis tier supports import (Standard/Premium)

# Check Redis status
az redis show \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --query "provisioningState"
```

### Geo-Restore Not Available

Geo-restore requires:
- Geo-redundant backup enabled (production only)
- Backup older than 12 hours
- Target region must be Azure paired region

```bash
# Verify geo-redundant backup enabled
az postgres flexible-server show \
    --name "fundrbolt-production-db" \
    --resource-group "fundrbolt-production-rg" \
    --query "backup.geoRedundantBackup"
```

## Related Documentation

- [Architecture Overview](architecture.md)
- [Backup Configuration (Bicep modules)](../infrastructure/bicep/modules/)
- [Rollback Procedures](rollback-procedures.md)
- [Secret Rotation](secret-rotation.md)
- [DR Test Script](../infrastructure/scripts/test-disaster-recovery.sh)

#!/bin/bash

# Disaster Recovery Testing Script
# Tests backup restore procedures and validates RTO/RPO compliance
# Usage: ./test-disaster-recovery.sh <source-env> <target-env>

set -e

SOURCE_ENV=$1
TARGET_ENV=$2

if [ -z "$SOURCE_ENV" ] || [ -z "$TARGET_ENV" ]; then
    echo "Usage: $0 <source-env> <target-env>"
    echo "Example: $0 production staging"
    echo ""
    echo "This script tests disaster recovery by:"
    echo "  1. Creating a snapshot of source environment database"
    echo "  2. Restoring to target environment"
    echo "  3. Validating data integrity"
    echo "  4. Measuring restore time (RTO)"
    echo "  5. Generating DR test report"
    exit 1
fi

# Validate environments
if [[ ! "$SOURCE_ENV" =~ ^(dev|staging|production)$ ]] || [[ ! "$TARGET_ENV" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Environments must be dev, staging, or production"
    exit 1
fi

if [ "$SOURCE_ENV" == "$TARGET_ENV" ]; then
    echo "Error: Source and target environments must be different"
    exit 1
fi

echo "🧪 Disaster Recovery Test"
echo "========================="
echo "Source: $SOURCE_ENV"
echo "Target: $TARGET_ENV"
echo "Test Date: $(date -Iseconds)"
echo ""

# Resource names
SOURCE_RG="fundrbolt-${SOURCE_ENV}-rg"
TARGET_RG="fundrbolt-${TARGET_ENV}-rg"
SOURCE_DB="fundrbolt-${SOURCE_ENV}-db"
TARGET_DB="fundrbolt-${TARGET_ENV}-db"
TARGET_DB_RESTORE="${TARGET_DB}-restore-test"
SOURCE_REDIS="fundrbolt-${SOURCE_ENV}-cache"
TARGET_REDIS="fundrbolt-${TARGET_ENV}-cache"

# Test results
TEST_START=$(date +%s)
RESULTS_FILE="dr-test-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "$1" | tee -a "$RESULTS_FILE"
}

log ""
log "=== PostgreSQL Backup & Restore Test ==="
log ""

# Step 1: Verify source database exists and get size
log "📊 Checking source database..."
SOURCE_DB_INFO=$(az postgres flexible-server show \
    --name "$SOURCE_DB" \
    --resource-group "$SOURCE_RG" \
    --query "{name:name,state:state,version:version,storageSizeGB:storage.storageSizeGB}" -o json)

if [ -z "$SOURCE_DB_INFO" ]; then
    log "❌ Error: Source database not found"
    exit 1
fi

log "✅ Source database found"
log "$SOURCE_DB_INFO"

# Step 2: Check available backups
log ""
log "🔍 Checking available backups..."
BACKUPS=$(az postgres flexible-server backup list \
    --resource-group "$SOURCE_RG" \
    --server-name "$SOURCE_DB" \
    --query "length(@)" -o tsv)

log "✅ Found $BACKUPS available backups"

# Get earliest restore point
EARLIEST_RESTORE=$(az postgres flexible-server show \
    --name "$SOURCE_DB" \
    --resource-group "$SOURCE_RG" \
    --query "backup.earliestRestoreDate" -o tsv)

log "📅 Earliest restore point: $EARLIEST_RESTORE"

# Step 3: Create test restore (Point-in-Time Restore)
log ""
log "⏳ Creating point-in-time restore (this may take 10-15 minutes)..."
RESTORE_START=$(date +%s)

# Restore to current time (latest data)
RESTORE_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

az postgres flexible-server restore \
    --resource-group "$TARGET_RG" \
    --name "$TARGET_DB_RESTORE" \
    --source-server "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$SOURCE_RG/providers/Microsoft.DBforPostgreSQL/flexibleServers/$SOURCE_DB" \
    --restore-time "$RESTORE_TIME" \
    --no-wait

# Wait for restore to complete
log "⏳ Waiting for restore operation to complete..."
az postgres flexible-server wait \
    --name "$TARGET_DB_RESTORE" \
    --resource-group "$TARGET_RG" \
    --created \
    --timeout 1800

RESTORE_END=$(date +%s)
RESTORE_TIME_SECONDS=$((RESTORE_END - RESTORE_START))
RESTORE_TIME_MINUTES=$((RESTORE_TIME_SECONDS / 60))

log "✅ Database restored in ${RESTORE_TIME_MINUTES} minutes (${RESTORE_TIME_SECONDS} seconds)"

# Step 4: Validate restored database
log ""
log "✔️  Validating restored database..."

RESTORED_DB_INFO=$(az postgres flexible-server show \
    --name "$TARGET_DB_RESTORE" \
    --resource-group "$TARGET_RG" \
    --query "{name:name,state:state,version:version,storageSizeGB:storage.storageSizeGB}" -o json)

log "$RESTORED_DB_INFO"

# Get connection details
RESTORED_DB_HOST=$(az postgres flexible-server show \
    --name "$TARGET_DB_RESTORE" \
    --resource-group "$TARGET_RG" \
    --query "fullyQualifiedDomainName" -o tsv)

log "✅ Restored database host: $RESTORED_DB_HOST"

# Step 5: Basic data integrity check
log ""
log "🔬 Performing data integrity checks..."

# Note: This requires database credentials and psql
# For automated testing, you would connect and run:
# - SELECT COUNT(*) FROM users;
# - SELECT COUNT(*) FROM roles;
# - SELECT COUNT(*) FROM sessions;
# - Verify data matches source (within RPO window)

log "⚠️  Manual verification required:"
log "  1. Connect to restored database: psql -h $RESTORED_DB_HOST -U fundrbolt_admin -d fundrbolt"
log "  2. Verify table counts match source database"
log "  3. Check recent transactions are present (within 15-minute RPO)"
log "  4. Test application connectivity to restored database"

# Step 6: Cleanup test restore
log ""
log "🧹 Cleanup test restore database? (keeping for manual validation)"
log "   To delete: az postgres flexible-server delete --name $TARGET_DB_RESTORE --resource-group $TARGET_RG --yes"

log ""
log "=== Redis Backup & Restore Test ==="
log ""

# Redis backup/restore testing
log "📊 Checking Redis cache..."

REDIS_INFO=$(az redis show \
    --name "$SOURCE_REDIS" \
    --resource-group "$SOURCE_RG" \
    --query "{name:name,provisioningState:provisioningState,sku:sku,enableNonSslPort:enableNonSslPort}" -o json)

if [ -z "$REDIS_INFO" ]; then
    log "❌ Error: Source Redis cache not found"
    exit 1
fi

log "✅ Source Redis cache found"
log "$REDIS_INFO"

# Check if AOF persistence is enabled (production only)
if [ "$SOURCE_ENV" == "production" ]; then
    AOF_ENABLED=$(az redis show \
        --name "$SOURCE_REDIS" \
        --resource-group "$SOURCE_RG" \
        --query "redisConfiguration.\"aof-backup-enabled\"" -o tsv)

    if [ "$AOF_ENABLED" == "true" ]; then
        log "✅ AOF persistence enabled (production)"
    else
        log "⚠️  AOF persistence not enabled"
    fi
fi

# Export Redis data
log ""
log "📤 Exporting Redis data..."

# Get storage account for backup
STORAGE_ACCOUNT=$(az storage account list \
    --resource-group "$SOURCE_RG" \
    --query "[?contains(name, 'fundrbolt')].name" -o tsv | head -1)

if [ -z "$STORAGE_ACCOUNT" ]; then
    log "❌ Error: Storage account not found"
    exit 1
fi

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
    --resource-group "$SOURCE_RG" \
    --account-name "$STORAGE_ACCOUNT" \
    --query "[0].value" -o tsv)

# Export Redis data to storage account
BACKUP_PREFIX="redis-dr-test-$(date +%Y%m%d-%H%M%S)"

log "⏳ Exporting Redis data to storage account..."
az redis export \
    --name "$SOURCE_REDIS" \
    --resource-group "$SOURCE_RG" \
    --container "backups" \
    --prefix "$BACKUP_PREFIX" \
    --file-format "rdb" \
    --storage-account-name "$STORAGE_ACCOUNT" \
    --storage-account-key "$STORAGE_KEY"

log "✅ Redis data exported to: backups/$BACKUP_PREFIX"

# Note: Redis import would be done with:
# az redis import --name $TARGET_REDIS --resource-group $TARGET_RG \
#   --files "backups/$BACKUP_PREFIX.rdb" \
#   --storage-account-name $STORAGE_ACCOUNT \
#   --storage-account-key $STORAGE_KEY

log ""
log "⚠️  Redis restore manual steps:"
log "  1. Stop application to prevent cache updates"
log "  2. Run: az redis import --name $TARGET_REDIS --resource-group $TARGET_RG \\"
log "       --files \"backups/$BACKUP_PREFIX.rdb\" \\"
log "       --storage-account-name $STORAGE_ACCOUNT"
log "  3. Verify cache data (check key counts, sample keys)"
log "  4. Restart application"

# Calculate test duration
TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))
TEST_DURATION_MINUTES=$((TEST_DURATION / 60))

log ""
log "=== Disaster Recovery Test Summary ==="
log ""
log "Test Duration: ${TEST_DURATION_MINUTES} minutes (${TEST_DURATION} seconds)"
log "Database Restore Time: ${RESTORE_TIME_MINUTES} minutes (${RESTORE_TIME_SECONDS} seconds)"
log ""
log "RTO/RPO Targets:"
log "  - RTO (Recovery Time Objective): 1 hour"
log "  - RPO (Recovery Point Objective): 15 minutes"
log ""

# RTO Compliance
if [ $RESTORE_TIME_MINUTES -le 60 ]; then
    log "✅ RTO COMPLIANCE: Database restored in $RESTORE_TIME_MINUTES min (target: 60 min)"
else
    log "❌ RTO VIOLATION: Database restore took $RESTORE_TIME_MINUTES min (target: 60 min)"
fi

# RPO Compliance (manual verification required)
log "⚠️  RPO COMPLIANCE: Manual verification required"
log "   - Check restored data timestamps"
log "   - Verify data loss is within 15-minute window"
log "   - Compare latest transactions in source vs restored database"

log ""
log "📝 Next Steps:"
log "  1. Review restored database at: $RESTORED_DB_HOST"
log "  2. Validate data integrity and completeness"
log "  3. Test application connectivity to restored database"
log "  4. Document any data loss or issues"
log "  5. Clean up test resources after validation"
log ""
log "Test report saved to: $RESULTS_FILE"
log ""
log "🎉 Disaster Recovery Test Complete!"

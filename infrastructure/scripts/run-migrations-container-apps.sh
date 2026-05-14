#!/usr/bin/env bash
# run-migrations-container-apps.sh
# Runs Alembic database migrations using a temporary Azure Container Apps Job.
# Designed to be called from the backend-deploy.yml GitHub Actions workflow.
#
# Usage:
#   ./infrastructure/scripts/run-migrations-container-apps.sh \
#       <resource-group> <container-apps-env-name> <image>
#
# Prerequisites:
#   - Azure CLI authenticated (az login / OIDC in CI)
#   - The Container Apps Environment must already exist
#   - Key Vault secrets must be populated (DATABASE_URL, REDIS_URL, etc.)
#
# The job uses the same container image and Key Vault secrets as the API container.

set -euo pipefail

RESOURCE_GROUP="${1:?'Usage: $0 <resource-group> <container-apps-env-name> <image>'}"
CAE_NAME="${2:?'Usage: $0 <resource-group> <container-apps-env-name> <image>'}"
IMAGE="${3:?'Usage: $0 <resource-group> <container-apps-env-name> <image>'}"

JOB_NAME="fundrbolt-production-migration"
# Derive Key Vault name from resource group following the naming convention:
# <appName>-<env>-rg  →  <appName>-<env>-kv
KV_NAME="${RESOURCE_GROUP%-rg}-kv"
KEY_VAULT_URI=$(az keyvault show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$KV_NAME" \
  --query 'properties.vaultUri' -o tsv)

echo "==> Running database migrations"
echo "    Resource Group : $RESOURCE_GROUP"
echo "    Container Env  : $CAE_NAME"
echo "    Image          : $IMAGE"
echo "    Key Vault      : $KEY_VAULT_URI"

# Create or update the migration job.
# Uses the same secrets configuration as the API container app.
SUBSCRIPTION=$(az account show --query id -o tsv)

if az containerapp job show \
    --name "$JOB_NAME" \
    --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  # Update the existing job via REST API (PATCH).
  # Cannot use `az containerapp job delete` because the resource group has CanNotDelete locks.
  # Cannot use `az containerapp job update --secrets` because it does not support --secrets.
  # REST API PATCH is allowed under CanNotDelete locks (only DELETE is blocked).
  echo "==> Updating existing migration job via REST API..."
  PATCH_BODY=$(python3 -c "
import json, sys
body = {
    'properties': {
        'configuration': {
            'secrets': [
                {'name': 'database-url', 'keyVaultUrl': '${KEY_VAULT_URI}secrets/DATABASE-URL', 'identity': 'system'},
                {'name': 'secret-key', 'keyVaultUrl': '${KEY_VAULT_URI}secrets/SECRET-KEY', 'identity': 'system'},
                {'name': 'super-admin-password', 'keyVaultUrl': '${KEY_VAULT_URI}secrets/SUPER-ADMIN-PASSWORD', 'identity': 'system'}
            ]
        },
        'template': {
            'containers': [
                {
                    'name': 'migration',
                    'image': '$IMAGE',
                    'env': [
                        {'name': 'DATABASE_URL', 'secretRef': 'database-url'},
                        {'name': 'ENVIRONMENT', 'value': 'production'},
                        {'name': 'LOG_LEVEL', 'value': 'INFO'},
                        {'name': 'SUPER_ADMIN_EMAIL', 'value': 'admin@fundrbolt.com'},
                        {'name': 'SUPER_ADMIN_PASSWORD', 'secretRef': 'super-admin-password'}
                    ]
                }
            ]
        }
    }
}
print(json.dumps(body))
")
  echo "$PATCH_BODY" > /tmp/migration-patch.json
  az rest --method patch \
    --url "https://management.azure.com/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/jobs/${JOB_NAME}?api-version=2024-03-01" \
    --body @/tmp/migration-patch.json
  # Wait for provisioning to complete
  for i in $(seq 1 12); do
    STATE=$(az containerapp job show --name "$JOB_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.provisioningState' -o tsv 2>/dev/null || echo "Unknown")
    echo "    Provisioning: $STATE (attempt $i/12)"
    [ "$STATE" = "Succeeded" ] && break
    sleep 5
  done
else
  # Create new job from scratch
  echo "==> Creating migration job..."
  az containerapp job create \
      --name "$JOB_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --environment "$CAE_NAME" \
      --trigger-type Manual \
      --replica-timeout 300 \
      --replica-retry-limit 1 \
      --replica-completion-count 1 \
      --parallelism 1 \
      --image "$IMAGE" \
      --cpu 0.5 \
      --memory 1Gi \
      --command "alembic" \
      --args "upgrade" "head" \
      --mi-system-assigned \
      --secrets \
        "database-url=keyvaultref:${KEY_VAULT_URI}secrets/DATABASE-URL,identityref:system" \
        "secret-key=keyvaultref:${KEY_VAULT_URI}secrets/SECRET-KEY,identityref:system" \
        "super-admin-password=keyvaultref:${KEY_VAULT_URI}secrets/SUPER-ADMIN-PASSWORD,identityref:system" \
      --env-vars \
        "DATABASE_URL=secretref:database-url" \
        "ENVIRONMENT=production" \
        "LOG_LEVEL=INFO" \
        "SUPER_ADMIN_EMAIL=admin@fundrbolt.com" \
        "SUPER_ADMIN_PASSWORD=secretref:super-admin-password"
fi

# Assign Key Vault Secrets User role to the migration job's managed identity
MIGRATION_PRINCIPAL=$(az containerapp job show \
  --name "$JOB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query 'identity.principalId' -o tsv)

KV_ID=$(az keyvault show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$KV_NAME" \
  --query 'id' -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id "$MIGRATION_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal \
  --scope "$KV_ID" 2>/dev/null || true  # Ignore if already assigned

# Start the migration job
echo "==> Starting migration job execution..."
EXECUTION_NAME=$(az containerapp job start \
  --name "$JOB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query 'name' -o tsv)

echo "    Execution: $EXECUTION_NAME"

# Poll until the execution completes (max 5 minutes)
echo "==> Waiting for migrations to complete..."
MAX_ATTEMPTS=60
for i in $(seq 1 $MAX_ATTEMPTS); do
  STATUS=$(az containerapp job execution show \
    --name "$JOB_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --job-execution-name "$EXECUTION_NAME" \
    --query 'properties.status' -o tsv 2>/dev/null || echo "Running")

  echo "    Attempt $i/$MAX_ATTEMPTS: status=$STATUS"

  case "$STATUS" in
    Succeeded)
      echo "==> Migrations completed successfully."
      exit 0
      ;;
    Failed|Stopped)
      echo "ERROR: Migration job failed with status: $STATUS"
      echo "==> Fetching migration job logs..."
      az containerapp job execution logs show \
        --name "$JOB_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --execution "$EXECUTION_NAME" 2>/dev/null || true
      exit 1
      ;;
  esac

  sleep 5
done

echo "ERROR: Migration job timed out after $((MAX_ATTEMPTS * 5)) seconds."
exit 1

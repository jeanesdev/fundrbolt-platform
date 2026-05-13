#!/usr/bin/env bash
# 05-populate-keyvault.sh
# Populates Azure Key Vault with all secrets required by the backend Container Apps.
#
# Secrets set:
#   DATABASE-URL          — PostgreSQL connection string (from deployed server)
#   REDIS-URL             — Redis connection string (from deployed cache)
#   SECRET-KEY            — JWT signing secret (generated if not provided)
#   AZURE-STORAGE-CONNECTION-STRING   — Blob storage (from deployed account)
#   AZURE-COMMUNICATION-CONNECTION-STRING — ACS email (from deployed service)
#   SENTRY-DSN            — Sentry DSN (set to empty string; update later after Sentry setup)
#   SUPER-ADMIN-EMAIL     — Initial super admin account
#   SUPER-ADMIN-PASSWORD  — Initial super admin password (generated if not provided)
#
# Usage: ./scripts/setup/05-populate-keyvault.sh
#   Optional: SENTRY_DSN=https://... ./scripts/setup/05-populate-keyvault.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "✗  Run 04-deploy-infrastructure.sh first (state file not found)"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

echo "=========================================="
echo " FundrBolt Beta — Populate Key Vault"
echo "=========================================="
echo ""
echo "   Key Vault: $KV_NAME"
echo "   Resource Group: $RESOURCE_GROUP"
echo ""

# ── Helper: set or update a KV secret ─────────────────────────────────────
kv_set() {
  local secret_name="$1"
  local secret_value="$2"
  if az keyvault secret show --vault-name "$KV_NAME" --name "$secret_name" &>/dev/null; then
    echo "→  Updating $secret_name"
  else
    echo "→  Creating $secret_name"
  fi
  az keyvault secret set \
    --vault-name "$KV_NAME" \
    --name "$secret_name" \
    --value "$secret_value" \
    --output none
  echo "✓  $secret_name set"
}

# ── DATABASE-URL ───────────────────────────────────────────────────────────
POSTGRES_SERVER="${POSTGRES_SERVER:-fundrbolt-production-postgres}"
POSTGRES_HOST="${POSTGRES_SERVER}.postgres.database.azure.com"
POSTGRES_ADMIN_USER="fundrboltadmin"
POSTGRES_DB="fundrbolt"

DB_URL="postgresql+asyncpg://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}/${POSTGRES_DB}?ssl=require"
kv_set "DATABASE-URL" "$DB_URL"

# ── REDIS-URL ──────────────────────────────────────────────────────────────
REDIS_NAME="${REDIS_NAME:-fundrbolt-production-redis}"
echo "→  Fetching Redis primary key..."
REDIS_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query primaryKey -o tsv)
REDIS_HOST_FQDN="${REDIS_NAME}.redis.cache.windows.net"
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST_FQDN}:6380/0"
kv_set "REDIS-URL" "$REDIS_URL"

# Save Redis URL to state for Celery
cat >> "$STATE_FILE" <<EOF
REDIS_URL=$REDIS_URL
REDIS_HOST_FQDN=$REDIS_HOST_FQDN
EOF

# ── SECRET-KEY (JWT signing) ───────────────────────────────────────────────
if [[ -z "${JWT_SECRET_KEY:-}" ]]; then
  JWT_SECRET_KEY=$(openssl rand -hex 32)
  echo "JWT_SECRET_KEY=$JWT_SECRET_KEY" >> "$STATE_FILE"
fi
kv_set "SECRET-KEY" "$JWT_SECRET_KEY"

# ── AZURE-STORAGE-CONNECTION-STRING ───────────────────────────────────────
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-fundrboltproductionstorage}"
# Azure storage account names must be ≤24 chars (all lowercase, no hyphens)
# Matches the Bicep: take(replace('${appName}${env}storage', '-', ''), 24)
# = take('fundrboltproductionstorage', 24) = 'fundrboltproductionstorag'
STORAGE_ACCOUNT="$(echo "fundrboltproductionstorage" | head -c 24)"
echo "→  Fetching Storage connection string for $STORAGE_ACCOUNT..."
STORAGE_CONN=$(az storage account show-connection-string \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --query connectionString -o tsv)
kv_set "AZURE-STORAGE-CONNECTION-STRING" "$STORAGE_CONN"

# ── AZURE-COMMUNICATION-CONNECTION-STRING ─────────────────────────────────
ACS_NAME="fundrbolt-production-acs"
echo "→  Fetching ACS connection string for $ACS_NAME..."
ACS_CONN=$(az communication show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACS_NAME" \
  --query dataLocation -o tsv 2>/dev/null || echo "")

if [[ -z "$ACS_CONN" ]]; then
  # ACS doesn't have a simple "show-connection-string" — fetch from list-keys
  ACS_CONN=$(az communication list-key \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACS_NAME" \
    --query primaryConnectionString -o tsv 2>/dev/null || echo "PLACEHOLDER_ACS_CONNECTION_STRING")
fi
kv_set "AZURE-COMMUNICATION-CONNECTION-STRING" "$ACS_CONN"

# ── SENTRY-DSN ────────────────────────────────────────────────────────────
# Set to empty string for now; update after creating Sentry project
SENTRY_DSN_VALUE="${SENTRY_DSN:-}"
kv_set "SENTRY-DSN" "$SENTRY_DSN_VALUE"
if [[ -z "$SENTRY_DSN_VALUE" ]]; then
  echo "   ℹ  SENTRY-DSN set to empty (Sentry disabled until you add a real DSN)"
fi

# ── SUPER-ADMIN-EMAIL / PASSWORD ──────────────────────────────────────────
# Used by the seed/migration scripts for the initial superuser account
SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@fundrbolt.com}"
if [[ -z "${SUPER_ADMIN_PASSWORD:-}" ]]; then
  SUPER_ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "SUPER_ADMIN_EMAIL=$SUPER_ADMIN_EMAIL" >> "$STATE_FILE"
  echo "SUPER_ADMIN_PASSWORD=$SUPER_ADMIN_PASSWORD" >> "$STATE_FILE"
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════╗"
  echo "  ║  IMPORTANT — Save your admin credentials NOW:           ║"
  echo "  ║  Email:    $SUPER_ADMIN_EMAIL                   ║"
  echo "  ║  Password: $SUPER_ADMIN_PASSWORD                      ║"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  echo ""
fi
kv_set "SUPER-ADMIN-EMAIL" "$SUPER_ADMIN_EMAIL"
kv_set "SUPER-ADMIN-PASSWORD" "$SUPER_ADMIN_PASSWORD"

echo ""
echo "=========================================="
echo " Key Vault populated!"
echo ""
echo " Secrets set:"
az keyvault secret list --vault-name "$KV_NAME" --query '[].name' -o tsv | sort | sed 's/^/   - /'
echo ""
echo " Next: run ./scripts/setup/06-set-github-secrets.sh"
echo "=========================================="

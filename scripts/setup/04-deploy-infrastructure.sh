#!/usr/bin/env bash
# 04-deploy-infrastructure.sh
# Deploys the full FundrBolt Azure infrastructure via Bicep (subscription scope).
# Generates a strong PostgreSQL password if one isn't already saved in state.
#
# Idempotent — re-running updates resources to match desired state.
#
# Duration: ~10–20 minutes on first run.
#
# Usage: ./scripts/setup/04-deploy-infrastructure.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "✗  Run 01-azure-login.sh first (state file not found)"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

echo "=========================================="
echo " FundrBolt Beta — Deploy Infrastructure"
echo "=========================================="
echo ""
echo "   Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo ""

# ── Generate PostgreSQL password if not already saved ─────────────────────
if [[ -z "${POSTGRES_ADMIN_PASSWORD:-}" ]]; then
  echo "→  Generating PostgreSQL admin password..."
  # Azure PostgreSQL requires: 8–128 chars, upper+lower+digit, no special: / \ @ "
  POSTGRES_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d '/+\\@"' | head -c 28)
  cat >> "$STATE_FILE" <<EOF
POSTGRES_ADMIN_PASSWORD=$POSTGRES_ADMIN_PASSWORD
EOF
  echo "✓  Password generated and saved to .azure-setup-state"
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════╗"
  echo "  ║  IMPORTANT — Save this password somewhere safe NOW:     ║"
  echo "  ║  PostgreSQL Password: $POSTGRES_ADMIN_PASSWORD        ║"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  echo ""
else
  echo "✓  Using existing PostgreSQL password from state"
fi

# ── Run Bicep deployment ──────────────────────────────────────────────────
DEPLOYMENT_NAME="fundrbolt-production-beta-$(date +%Y%m%d%H%M)"

echo "→  Deploying Bicep (this takes ~10–20 minutes)..."
echo "   Deployment name: $DEPLOYMENT_NAME"
echo ""

az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location eastus2 \
  --template-file "$REPO_ROOT/infrastructure/bicep/main-beta.bicep" \
  --parameters "$REPO_ROOT/infrastructure/bicep/parameters/production-beta.bicepparam" \
  --parameters postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
  --output json | tee "$REPO_ROOT/.azure-deployment-output.json"

echo ""
echo "✓  Deployment complete!"

# ── Extract key outputs ───────────────────────────────────────────────────
OUTPUTS="$REPO_ROOT/.azure-deployment-output.json"

extract_output() {
  jq -r ".properties.outputs.$1.value // empty" "$OUTPUTS" 2>/dev/null || echo ""
}

RESOURCE_GROUP=$(extract_output "resourceGroupName")
BACKEND_FQDN=$(extract_output "apiAppFqdn")
ADMIN_SWA_HOSTNAME=$(extract_output "adminWebAppHostname")
DONOR_SWA_HOSTNAME=$(extract_output "donorWebAppHostname")
LANDING_SWA_HOSTNAME=$(extract_output "landingWebAppHostname")
KV_URI=$(extract_output "keyVaultUri")

# Derive names from known conventions (appName=fundrbolt, env=production)
APP_NAME="fundrbolt"
ENV_NAME="production"
KV_NAME="${APP_NAME}-${ENV_NAME}-kv"
POSTGRES_SERVER="${APP_NAME}-${ENV_NAME}-postgres"
REDIS_NAME="${APP_NAME}-${ENV_NAME}-redis"

# Save outputs to state
cat >> "$STATE_FILE" <<EOF
RESOURCE_GROUP=$RESOURCE_GROUP
BACKEND_FQDN=$BACKEND_FQDN
ADMIN_SWA_HOSTNAME=$ADMIN_SWA_HOSTNAME
DONOR_SWA_HOSTNAME=$DONOR_SWA_HOSTNAME
LANDING_SWA_HOSTNAME=$LANDING_SWA_HOSTNAME
KV_NAME=$KV_NAME
KV_URI=$KV_URI
POSTGRES_SERVER=$POSTGRES_SERVER
REDIS_NAME=$REDIS_NAME
EOF

echo ""
echo "=========================================="
echo " Infrastructure deployed!"
echo ""
echo "   Resource Group:  $RESOURCE_GROUP"
echo "   Backend FQDN:    $BACKEND_FQDN"
echo "   Admin SWA:       $ADMIN_SWA_HOSTNAME"
echo "   Donor SWA:       $DONOR_SWA_HOSTNAME"
echo "   Landing SWA:     $LANDING_SWA_HOSTNAME"
echo "   Key Vault:       $KV_NAME"
echo ""
echo " Next: run ./scripts/setup/05-populate-keyvault.sh"
echo "=========================================="

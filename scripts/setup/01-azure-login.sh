#!/usr/bin/env bash
# 01-azure-login.sh
# Logs in to Azure, lists subscriptions, and lets you choose one.
# Writes the chosen subscription ID to .azure-setup-state so later scripts can read it.
#
# Usage: ./scripts/setup/01-azure-login.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

echo "=========================================="
echo " FundrBolt Beta — Azure Login"
echo "=========================================="
echo ""

# ── Login ─────────────────────────────────────────────────────────────────
if az account show &>/dev/null; then
  CURRENT=$(az account show --query '[name, id]' -o tsv)
  echo "✓  Already logged in to Azure."
  echo "   Current account: $CURRENT"
  echo ""
  read -rp "Use this account? [Y/n] " yn
  if [[ "${yn,,}" == "n" ]]; then
    az login
  fi
else
  echo "→  Opening Azure login in browser..."
  az login
fi

# ── List and select subscription ──────────────────────────────────────────
echo ""
echo "Available subscriptions:"
az account list --query '[].{Name:name, ID:id, State:state}' -o table

echo ""
read -rp "Enter the Subscription ID to use: " SUB_ID
az account set --subscription "$SUB_ID"

SUB_NAME=$(az account show --query name -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
echo "✓  Selected: $SUB_NAME ($SUB_ID)"
echo "   Tenant:   $TENANT_ID"

# ── Persist state ─────────────────────────────────────────────────────────
cat > "$STATE_FILE" <<EOF
SUBSCRIPTION_ID=$SUB_ID
SUBSCRIPTION_NAME="$SUB_NAME"
TENANT_ID=$TENANT_ID
EOF
echo ""
echo "✓  State saved to .azure-setup-state"
echo ""
echo "=========================================="
echo " Next: run ./scripts/setup/02-register-providers.sh"
echo "=========================================="

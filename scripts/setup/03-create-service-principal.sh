#!/usr/bin/env bash
# 03-create-service-principal.sh
# Creates an Azure AD application + service principal with OIDC federated credentials
# for GitHub Actions. No long-lived secrets — uses workload identity federation.
#
# Grants: Contributor + User Access Administrator at subscription scope.
# (User Access Admin is required so Bicep can create Key Vault role assignments.)
#
# Usage: ./scripts/setup/03-create-service-principal.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "✗  Run 01-azure-login.sh first (state file not found)"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

GH_REPO="${GH_REPO:-jeanesdev/fundrbolt-platform}"
APP_DISPLAY_NAME="fundrbolt-github-actions"

echo "=========================================="
echo " FundrBolt Beta — Create Service Principal"
echo "=========================================="
echo ""
echo "   Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo "   Tenant:       $TENANT_ID"
echo "   GitHub repo:  $GH_REPO"
echo ""

# ── Create or reuse app registration ──────────────────────────────────────
EXISTING_APP_ID=$(az ad app list \
  --display-name "$APP_DISPLAY_NAME" \
  --query '[0].appId' -o tsv 2>/dev/null || true)

if [[ -n "$EXISTING_APP_ID" && "$EXISTING_APP_ID" != "None" ]]; then
  echo "✓  App registration already exists: $EXISTING_APP_ID"
  APP_ID="$EXISTING_APP_ID"
else
  echo "→  Creating app registration '$APP_DISPLAY_NAME'..."
  APP_ID=$(az ad app create \
    --display-name "$APP_DISPLAY_NAME" \
    --query appId -o tsv)
  echo "✓  Created app: $APP_ID"
fi

# ── Create or reuse service principal ─────────────────────────────────────
SP_OBJ_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || true)
if [[ -z "$SP_OBJ_ID" || "$SP_OBJ_ID" == "None" ]]; then
  echo "→  Creating service principal..."
  SP_OBJ_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
  echo "✓  Service principal object ID: $SP_OBJ_ID"
else
  echo "✓  Service principal already exists: $SP_OBJ_ID"
fi

SCOPE="/subscriptions/$SUBSCRIPTION_ID"

# ── Contributor role ──────────────────────────────────────────────────────
EXISTING_CONTRIB=$(az role assignment list \
  --assignee "$SP_OBJ_ID" \
  --role Contributor \
  --scope "$SCOPE" \
  --query '[0].id' -o tsv 2>/dev/null || true)

if [[ -n "$EXISTING_CONTRIB" && "$EXISTING_CONTRIB" != "None" ]]; then
  echo "✓  Contributor role already assigned"
else
  echo "→  Assigning Contributor role..."
  az role assignment create \
    --role Contributor \
    --assignee-object-id "$SP_OBJ_ID" \
    --assignee-principal-type ServicePrincipal \
    --scope "$SCOPE"
  echo "✓  Contributor assigned"
fi

# ── User Access Administrator role ────────────────────────────────────────
EXISTING_UAA=$(az role assignment list \
  --assignee "$SP_OBJ_ID" \
  --role "User Access Administrator" \
  --scope "$SCOPE" \
  --query '[0].id' -o tsv 2>/dev/null || true)

if [[ -n "$EXISTING_UAA" && "$EXISTING_UAA" != "None" ]]; then
  echo "✓  User Access Administrator role already assigned"
else
  echo "→  Assigning User Access Administrator role..."
  az role assignment create \
    --role "User Access Administrator" \
    --assignee-object-id "$SP_OBJ_ID" \
    --assignee-principal-type ServicePrincipal \
    --scope "$SCOPE"
  echo "✓  User Access Administrator assigned"
fi

# ── OIDC federated credentials ────────────────────────────────────────────
setup_federated_credential() {
  local name="$1"
  local subject="$2"

  EXISTING=$(az ad app federated-credential list \
    --id "$APP_ID" \
    --query "[?name=='$name'].id" -o tsv 2>/dev/null || true)

  if [[ -n "$EXISTING" ]]; then
    echo "✓  Federated credential '$name' already exists"
  else
    echo "→  Creating federated credential '$name'..."
    az ad app federated-credential create \
      --id "$APP_ID" \
      --parameters "{
        \"name\": \"$name\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"$subject\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
      }"
    echo "✓  Created '$name'"
  fi
}

setup_federated_credential \
  "fundrbolt-main-branch" \
  "repo:${GH_REPO}:ref:refs/heads/main"

setup_federated_credential \
  "fundrbolt-pull-requests" \
  "repo:${GH_REPO}:pull_request"

setup_federated_credential \
  "fundrbolt-dev-environment" \
  "repo:${GH_REPO}:environment:dev"

setup_federated_credential \
  "fundrbolt-production-environment" \
  "repo:${GH_REPO}:environment:production"

# ── Save to state ─────────────────────────────────────────────────────────
cat >> "$STATE_FILE" <<EOF
AZURE_CLIENT_ID=$APP_ID
SP_OBJ_ID=$SP_OBJ_ID
EOF

echo ""
echo "=========================================="
echo " Service principal ready!"
echo ""
echo "   AZURE_CLIENT_ID:      $APP_ID"
echo "   AZURE_TENANT_ID:      $TENANT_ID"
echo "   AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo ""
echo " Next: run ./scripts/setup/04-deploy-infrastructure.sh"
echo "=========================================="

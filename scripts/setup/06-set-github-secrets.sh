#!/usr/bin/env bash
# 06-set-github-secrets.sh
# Sets all GitHub Actions secrets needed for CI/CD using the gh CLI.
# Reads values from .azure-setup-state (written by previous setup scripts).
#
# Secrets set:
#   Azure OIDC:
#     AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID
#   Azure infrastructure (for infrastructure-deploy.yml):
#     POSTGRES_ADMIN_PASSWORD
#   Static Web App deploy tokens (one per SWA):
#     AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN_PROD
#     AZURE_STATIC_WEB_APPS_API_TOKEN_DONOR_PROD
#     AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING_PROD
#   Sentry (placeholders — update after Sentry setup):
#     SENTRY_AUTH_TOKEN, SENTRY_ORG
#     VITE_SENTRY_DSN_ADMIN, VITE_SENTRY_DSN_DONOR, VITE_SENTRY_DSN_LANDING
#
# Usage: ./scripts/setup/06-set-github-secrets.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "✗  Run previous setup scripts first (state file not found)"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

GH_REPO="${GH_REPO:-jeanesdev/fundrbolt-platform}"

echo "=========================================="
echo " FundrBolt Beta — Set GitHub Secrets"
echo "=========================================="
echo ""
echo "   GitHub repo: $GH_REPO"
echo ""

# ── Helper ────────────────────────────────────────────────────────────────
gh_secret_set() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  ⚠  Skipping $name (empty value)"
    return
  fi
  echo "$value" | gh secret set "$name" --repo "$GH_REPO"
  echo "✓  $name"
}

# ── Azure OIDC ─────────────────────────────────────────────────────────────
echo "── Azure OIDC credentials ────────────────"
gh_secret_set "AZURE_CLIENT_ID"       "${AZURE_CLIENT_ID:-}"
gh_secret_set "AZURE_TENANT_ID"       "${TENANT_ID:-}"
gh_secret_set "AZURE_SUBSCRIPTION_ID" "${SUBSCRIPTION_ID:-}"

# ── Infrastructure secrets ─────────────────────────────────────────────────
echo ""
echo "── Infrastructure secrets ────────────────"
gh_secret_set "POSTGRES_ADMIN_PASSWORD" "${POSTGRES_ADMIN_PASSWORD:-}"

# ── Static Web App deploy tokens ──────────────────────────────────────────
echo ""
echo "── Static Web App deploy tokens ──────────"

# Admin PWA
ADMIN_SWA_NAME="fundrbolt-production-admin"
ADMIN_TOKEN=$(az staticwebapp secrets list \
  --resource-group "${RESOURCE_GROUP:-fundrbolt-production-rg}" \
  --name "$ADMIN_SWA_NAME" \
  --query "properties.apiKey" -o tsv 2>/dev/null || echo "")

if [[ -n "$ADMIN_TOKEN" ]]; then
  gh_secret_set "AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN_PROD" "$ADMIN_TOKEN"
else
  echo "  ⚠  Could not retrieve Admin SWA token — check resource name: $ADMIN_SWA_NAME"
fi

# Donor PWA
DONOR_SWA_NAME="fundrbolt-production-donor"
DONOR_TOKEN=$(az staticwebapp secrets list \
  --resource-group "${RESOURCE_GROUP:-fundrbolt-production-rg}" \
  --name "$DONOR_SWA_NAME" \
  --query "properties.apiKey" -o tsv 2>/dev/null || echo "")

if [[ -n "$DONOR_TOKEN" ]]; then
  gh_secret_set "AZURE_STATIC_WEB_APPS_API_TOKEN_DONOR_PROD" "$DONOR_TOKEN"
else
  echo "  ⚠  Could not retrieve Donor SWA token — check resource name: $DONOR_SWA_NAME"
fi

# Landing Site
LANDING_SWA_NAME="fundrbolt-production-landing"
LANDING_TOKEN=$(az staticwebapp secrets list \
  --resource-group "${RESOURCE_GROUP:-fundrbolt-production-rg}" \
  --name "$LANDING_SWA_NAME" \
  --query "properties.apiKey" -o tsv 2>/dev/null || echo "")

if [[ -n "$LANDING_TOKEN" ]]; then
  gh_secret_set "AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING_PROD" "$LANDING_TOKEN"
else
  echo "  ⚠  Could not retrieve Landing SWA token — check resource name: $LANDING_SWA_NAME"
fi

# Save tokens to state for reference
cat >> "$STATE_FILE" <<EOF
ADMIN_SWA_TOKEN=$ADMIN_TOKEN
DONOR_SWA_TOKEN=$DONOR_TOKEN
LANDING_SWA_TOKEN=$LANDING_TOKEN
EOF

# ── Sentry (placeholders) ──────────────────────────────────────────────────
echo ""
echo "── Sentry secrets (placeholders) ─────────"
echo "   Setting empty placeholders — update these after Sentry setup"

gh_secret_set "SENTRY_AUTH_TOKEN"        "${SENTRY_AUTH_TOKEN:-placeholder_update_after_sentry_setup}"
gh_secret_set "SENTRY_ORG"              "${SENTRY_ORG:-fundrbolt}"
gh_secret_set "VITE_SENTRY_DSN_ADMIN"   "${VITE_SENTRY_DSN_ADMIN:-}"
gh_secret_set "VITE_SENTRY_DSN_DONOR"   "${VITE_SENTRY_DSN_DONOR:-}"
gh_secret_set "VITE_SENTRY_DSN_LANDING" "${VITE_SENTRY_DSN_LANDING:-}"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "Current secrets in repo:"
gh secret list --repo "$GH_REPO" 2>/dev/null | grep -v "^Name" || true

echo ""
echo "=========================================="
echo " GitHub Secrets configured!"
echo ""
echo " ⚠  Remaining manual steps:"
echo "    1. Create Sentry account at https://sentry.io"
echo "    2. Create 4 Sentry projects: backend, admin-pwa, donor-pwa, landing-site"
echo "    3. Update these secrets with real DSNs:"
echo "       gh secret set SENTRY_AUTH_TOKEN --repo $GH_REPO"
echo "       gh secret set VITE_SENTRY_DSN_ADMIN --repo $GH_REPO"
echo "       gh secret set VITE_SENTRY_DSN_DONOR --repo $GH_REPO"
echo "       gh secret set VITE_SENTRY_DSN_LANDING --repo $GH_REPO"
echo "    4. Also update Key Vault SENTRY-DSN:"
echo "       az keyvault secret set --vault-name ${KV_NAME:-fundrbolt-production-kv} \\"
echo "         --name SENTRY-DSN --value 'https://your-dsn@sentry.io/...'"
echo ""
echo " Next: run ./scripts/setup/07-trigger-deployment.sh"
echo "=========================================="

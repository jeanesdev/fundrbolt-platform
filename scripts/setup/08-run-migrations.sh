#!/usr/bin/env bash
# 08-run-migrations.sh
# Runs database migrations on the production PostgreSQL via the migration Container App Job.
# Also seeds the initial super admin account.
#
# Usage: ./scripts/setup/08-run-migrations.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "✗  Run previous setup scripts first (state file not found)"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

RESOURCE_GROUP="${RESOURCE_GROUP:-fundrbolt-production-rg}"
MIGRATION_SCRIPT="$REPO_ROOT/infrastructure/scripts/run-migrations-container-apps.sh"

echo "=========================================="
echo " FundrBolt Beta — Run Migrations"
echo "=========================================="
echo ""
echo "   Resource Group: $RESOURCE_GROUP"
echo ""

if [[ ! -f "$MIGRATION_SCRIPT" ]]; then
  echo "✗  Migration script not found: $MIGRATION_SCRIPT"
  exit 1
fi

echo "→  Running database migrations..."
bash "$MIGRATION_SCRIPT" "$RESOURCE_GROUP"
echo "✓  Migrations complete"

echo ""
echo "→  Verifying backend is healthy..."
BACKEND_URL="https://${BACKEND_FQDN:-api.fundrbolt.com}"

# Wait up to 3 minutes for the API to be reachable
for i in {1..18}; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    echo "✓  Backend healthy at $BACKEND_URL"
    break
  fi
  echo "   Attempt $i/18: HTTP $HTTP_STATUS — waiting 10s..."
  sleep 10
done

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo ""
  echo "⚠  Backend not responding after 3 minutes."
  echo "   Check Container App logs:"
  echo "   az containerapp logs show -g $RESOURCE_GROUP -n fundrbolt-production-api"
  exit 1
fi

echo ""
echo "=========================================="
echo " Migrations complete!"
echo ""
echo " Backend API: $BACKEND_URL/docs"
echo " Health:      $BACKEND_URL/health"
echo ""
echo " Next steps:"
echo "   1. Add DNS CNAME records (see docs/046-beta-deployment-manual-setup.md)"
echo "   2. Set up Sentry (https://sentry.io) and update secrets"
echo "   3. Log in to admin panel: https://app.fundrbolt.com"
echo "      Email:    ${SUPER_ADMIN_EMAIL:-admin@fundrbolt.com}"
echo "      Password: ${SUPER_ADMIN_PASSWORD:-(see .azure-setup-state)}"
echo "=========================================="

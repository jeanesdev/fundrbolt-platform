#!/usr/bin/env bash
# run-setup.sh
# Master setup script — runs all numbered setup steps in sequence.
# Interactive: each step pauses and asks for confirmation before proceeding.
#
# Usage: ./scripts/setup/run-setup.sh
#
# To resume from a specific step:
#   ./scripts/setup/run-setup.sh --start 04

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

START_STEP="${2:-00}"

STEPS=(
  "00-install-prerequisites.sh"
  "01-azure-login.sh"
  "02-register-providers.sh"
  "03-create-service-principal.sh"
  "04-deploy-infrastructure.sh"
  "05-populate-keyvault.sh"
  "06-set-github-secrets.sh"
  "07-trigger-deployment.sh"
  "08-run-migrations.sh"
)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         FundrBolt Beta — Production Setup                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will run all setup steps to deploy FundrBolt to Azure."
echo ""
echo "Steps:"
for step in "${STEPS[@]}"; do
  prefix="${step:0:2}"
  if [[ "$prefix" < "$START_STEP" ]]; then
    echo "  [skip] $step"
  else
    echo "  [ ]    $step"
  fi
done
echo ""
read -rp "Proceed? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

for step in "${STEPS[@]}"; do
  prefix="${step:0:2}"
  if [[ "$prefix" < "$START_STEP" ]]; then
    echo ""
    echo "── Skipping $step (before start step $START_STEP) ──"
    continue
  fi

  echo ""
  echo "══════════════════════════════════════════"
  echo " Running: $step"
  echo "══════════════════════════════════════════"
  bash "$SCRIPT_DIR/$step"
  STATUS=$?

  if [[ $STATUS -ne 0 ]]; then
    echo ""
    echo "✗  Step $step failed with exit code $STATUS"
    echo "   Fix the issue and resume with:"
    echo "   ./scripts/setup/run-setup.sh --start $prefix"
    exit $STATUS
  fi

  echo ""
  read -rp "Continue to next step? [Y/n] " next
  if [[ "${next,,}" == "n" ]]; then
    NEXT_STEP=$(for s in "${STEPS[@]}"; do
      echo "${s:0:2}"
    done | grep -A1 "$prefix" | tail -1)
    echo ""
    echo "Paused. Resume with:"
    echo "   ./scripts/setup/run-setup.sh --start $NEXT_STEP"
    exit 0
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         FundrBolt Beta Setup Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "All automated steps finished."
echo ""
echo "Remaining manual steps:"
echo "  1. Set up Sentry (https://sentry.io/signup)"
echo "     - Create org and 4 projects: backend, admin-pwa, donor-pwa, landing-site"
echo "     - Update GitHub secrets: SENTRY_AUTH_TOKEN, VITE_SENTRY_DSN_*"
echo "     - Update Key Vault: az keyvault secret set --vault-name fundrbolt-production-kv"
echo "                           --name SENTRY-DSN --value 'https://...@sentry.io/...'"
echo ""
echo "  2. Configure DNS (at your domain registrar for fundrbolt.com):"
echo "     - api.fundrbolt.com  CNAME → fundrbolt-production-api.<region>.azurecontainerapps.io"
echo "     - app.fundrbolt.com  CNAME → <admin-swa-hostname>"
echo "     - give.fundrbolt.com CNAME → <donor-swa-hostname>"
echo "     - www.fundrbolt.com  CNAME → <landing-swa-hostname>"
echo "     DNS values are in .azure-setup-state after deployment."
echo ""
echo "  3. Verify everything works:"
echo "     - https://api.fundrbolt.com/health"
echo "     - https://app.fundrbolt.com"
echo "     - https://give.fundrbolt.com"
echo "     - https://fundrbolt.com"
echo ""
echo "  See docs/046-beta-deployment-manual-setup.md for complete testing checklist."

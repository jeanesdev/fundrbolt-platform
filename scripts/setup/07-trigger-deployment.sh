#!/usr/bin/env bash
# 07-trigger-deployment.sh
# Triggers the GitHub Actions deployment workflows after all secrets are set.
# Merges the 046-beta-deployment branch to main (or triggers workflows on main).
#
# IMPORTANT: Run this only after ALL previous setup scripts have succeeded.
#
# Usage: ./scripts/setup/07-trigger-deployment.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.azure-setup-state"

GH_REPO="${GH_REPO:-jeanesdev/fundrbolt-platform}"
PR_NUMBER="${PR_NUMBER:-108}"   # PR #108: 046-beta-deployment → main

echo "=========================================="
echo " FundrBolt Beta — Trigger Deployment"
echo "=========================================="
echo ""

# ── Verify GitHub secrets are set ─────────────────────────────────────────
echo "→  Checking required secrets..."
REQUIRED_SECRETS=(
  "AZURE_CLIENT_ID"
  "AZURE_TENANT_ID"
  "AZURE_SUBSCRIPTION_ID"
  "POSTGRES_ADMIN_PASSWORD"
  "AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN_PROD"
  "AZURE_STATIC_WEB_APPS_API_TOKEN_DONOR_PROD"
  "AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING_PROD"
)

EXISTING_SECRETS=$(gh secret list --repo "$GH_REPO" --json name --jq '.[].name')
MISSING=()
for s in "${REQUIRED_SECRETS[@]}"; do
  if echo "$EXISTING_SECRETS" | grep -q "^${s}$"; then
    echo "  ✓  $s"
  else
    echo "  ✗  $s  ← MISSING"
    MISSING+=("$s")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "✗  Missing secrets: ${MISSING[*]}"
  echo "   Run 06-set-github-secrets.sh first."
  exit 1
fi

echo ""
echo "✓  All required secrets present"
echo ""

# ── Check PR status ────────────────────────────────────────────────────────
echo "→  Checking PR #$PR_NUMBER checks..."
gh pr checks "$PR_NUMBER" --repo "$GH_REPO" | tail -5

echo ""
read -rp "Merge PR #$PR_NUMBER to main to trigger production deployment? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "Aborted."
  echo ""
  echo "To merge manually:"
  echo "  gh pr merge $PR_NUMBER --repo $GH_REPO --squash --auto"
  exit 0
fi

# ── Merge PR ───────────────────────────────────────────────────────────────
echo "→  Merging PR #$PR_NUMBER..."
gh pr merge "$PR_NUMBER" \
  --repo "$GH_REPO" \
  --squash \
  --subject "feat: beta deployment infrastructure and CI/CD pipeline"

echo "✓  PR merged to main"
echo ""
echo "→  Monitoring deployment workflows..."
echo "   (This may take 5–15 minutes)"
echo ""

# ── Watch workflows ────────────────────────────────────────────────────────
# Give GitHub a few seconds to trigger the workflows
sleep 10

echo "Active workflow runs:"
gh run list --repo "$GH_REPO" --limit 10 --json status,name,headBranch,url \
  --jq '.[] | select(.headBranch == "main") | "\(.status) | \(.name)"' 2>/dev/null || true

echo ""
echo "=========================================="
echo " Deployment triggered!"
echo ""
echo " Monitor progress:"
echo "   gh run list --repo $GH_REPO --limit 10"
echo "   gh run watch --repo $GH_REPO"
echo ""
echo " After deployment completes, run:"
echo "   ./scripts/setup/08-run-migrations.sh"
echo "=========================================="

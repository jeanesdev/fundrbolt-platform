#!/usr/bin/env bash
# 00-install-prerequisites.sh
# Installs Azure CLI and Bicep on Ubuntu/Debian.
# Run this first, before any other setup scripts.
#
# Usage: ./scripts/setup/00-install-prerequisites.sh

set -euo pipefail

echo "=========================================="
echo " FundrBolt Beta — Install Prerequisites"
echo "=========================================="
echo ""

# ── Azure CLI ──────────────────────────────────────────────────────────────
if command -v az &>/dev/null; then
  AZ_VERSION=$(az --version 2>/dev/null | head -1)
  echo "✓  Azure CLI already installed: $AZ_VERSION"
else
  echo "→  Installing Azure CLI..."
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  echo "✓  Azure CLI installed: $(az --version 2>/dev/null | head -1)"
fi

# ── Bicep (via Azure CLI extension) ───────────────────────────────────────
echo "→  Installing/upgrading Bicep CLI..."
az bicep install || az bicep upgrade
echo "✓  Bicep: $(az bicep version)"

# ── jq ────────────────────────────────────────────────────────────────────
if command -v jq &>/dev/null; then
  echo "✓  jq already installed: $(jq --version)"
else
  echo "→  Installing jq..."
  sudo apt-get install -y jq
  echo "✓  jq installed: $(jq --version)"
fi

# ── GitHub CLI check ──────────────────────────────────────────────────────
if command -v gh &>/dev/null; then
  echo "✓  GitHub CLI already installed: $(gh --version | head -1)"
else
  echo "✗  GitHub CLI not found — install from https://cli.github.com"
  exit 1
fi

# ── Verify gh is authenticated ────────────────────────────────────────────
if gh auth status &>/dev/null; then
  echo "✓  GitHub CLI authenticated as: $(gh api user --jq .login)"
else
  echo ""
  echo "→  GitHub CLI not authenticated. Running 'gh auth login'..."
  gh auth login
fi

echo ""
echo "=========================================="
echo " All prerequisites installed!"
echo " Next: run ./scripts/setup/01-azure-login.sh"
echo "=========================================="

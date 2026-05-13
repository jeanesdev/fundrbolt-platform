#!/usr/bin/env bash
# 02-register-providers.sh
# Registers all Azure resource providers needed by the Bicep deployment.
# Safe to re-run — already-registered providers are a no-op.
#
# Usage: ./scripts/setup/02-register-providers.sh

set -euo pipefail

echo "=========================================="
echo " FundrBolt Beta — Register Azure Providers"
echo "=========================================="
echo ""

PROVIDERS=(
  "Microsoft.App"                  # Container Apps
  "Microsoft.Web"                  # Static Web Apps
  "Microsoft.DBforPostgreSQL"      # PostgreSQL Flexible Server
  "Microsoft.Cache"                # Redis Cache
  "Microsoft.KeyVault"             # Key Vault
  "Microsoft.Storage"              # Storage Accounts
  "Microsoft.Insights"             # Application Insights
  "Microsoft.OperationalInsights"  # Log Analytics
  "Microsoft.Communication"        # Azure Communication Services (email)
  "Microsoft.AlertsManagement"     # Alert rules
  "Microsoft.Network"              # VNet / DNS zones
  "Microsoft.Consumption"          # Budget alerts
  "Microsoft.ContainerRegistry"    # (optional, GHCR used but good to have)
)

for ns in "${PROVIDERS[@]}"; do
  STATE=$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null || echo "NotFound")
  if [[ "$STATE" == "Registered" ]]; then
    echo "✓  $ns (already registered)"
  else
    echo "→  Registering $ns ..."
    az provider register --namespace "$ns" --wait
    echo "✓  $ns registered"
  fi
done

echo ""
echo "=========================================="
echo " All providers registered!"
echo " Next: run ./scripts/setup/03-create-service-principal.sh"
echo "=========================================="

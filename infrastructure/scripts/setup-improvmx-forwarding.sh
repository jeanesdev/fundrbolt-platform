#!/bin/bash
# Configure ImprovMX email forwarding (works with any DNS provider)
# ImprovMX is free and doesn't require changing nameservers

set -euo pipefail

ENVIRONMENT="${1:-dev}"
DOMAIN="fundrbolt.com"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"

echo "📧 Setting up ImprovMX Email Forwarding"
echo "======================================="
echo ""
echo "ImprovMX is a FREE email forwarding service that works with Azure DNS"
echo ""

# Remove CloudFlare MX records
echo "🗑️  Removing CloudFlare MX records..."
az network dns record-set mx delete \
    --zone-name "$DOMAIN" \
    --resource-group "$RESOURCE_GROUP" \
    --name @ \
    --yes 2>/dev/null || echo "No MX records to remove"

# Add ImprovMX MX records
echo "📝 Adding ImprovMX MX records..."
az network dns record-set mx create \
    --zone-name "$DOMAIN" \
    --resource-group "$RESOURCE_GROUP" \
    --name @ \
    --ttl 3600

az network dns record-set mx add-record \
    --zone-name "$DOMAIN" \
    --resource-group "$RESOURCE_GROUP" \
    --record-set-name @ \
    --preference 10 \
    --exchange "mx1.improvmx.com"

az network dns record-set mx add-record \
    --zone-name "$DOMAIN" \
    --resource-group "$RESOURCE_GROUP" \
    --record-set-name @ \
    --preference 20 \
    --exchange "mx2.improvmx.com"

echo ""
echo "✅ MX records configured for ImprovMX!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Go to: https://improvmx.com/"
echo ""
echo "2. Click 'Get Started' (no signup required initially)"
echo ""
echo "3. Enter your domain: fundrbolt.com"
echo ""
echo "4. Add forwarding rules:"
echo "   admin@fundrbolt.com    → jeanes.dev@gmail.com"
echo "   Legal@fundrbolt.com    → jeanes.dev@gmail.com"
echo "   Privacy@fundrbolt.com  → jeanes.dev@gmail.com"
echo "   DPO@fundrbolt.com      → jeanes.dev@gmail.com"
echo ""
echo "5. Optional: Add catch-all (*@fundrbolt.com → jeanes.dev@gmail.com)"
echo ""
echo "6. Verify your Gmail (ImprovMX will send verification email)"
echo ""
echo "💡 ImprovMX Features:"
echo "   ✅ Completely FREE (up to 10 aliases)"
echo "   ✅ Works with any DNS provider (Azure, CloudFlare, etc.)"
echo "   ✅ No nameserver changes needed"
echo "   ✅ Instant setup"
echo ""
echo "⏳ DNS propagation: 5-15 minutes"
echo "   After that, test by sending email to admin@fundrbolt.com"

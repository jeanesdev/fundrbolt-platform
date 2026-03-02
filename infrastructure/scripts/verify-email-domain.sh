#!/bin/bash
# Verify email domain configuration in Azure Communication Services
# Checks DNS records and triggers domain verification

set -euo pipefail

# Accept environment parameter (default: production)
ENVIRONMENT="${1:-production}"
DOMAIN="fundrbolt.com"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
EMAIL_SERVICE="fundrbolt-${ENVIRONMENT}-email"

echo "🔍 Checking DNS record propagation..."
echo ""

# Check TXT records for @ (root domain)
echo "1️⃣  Checking TXT records for @ (verification + SPF)..."
dig TXT "$DOMAIN" +short | grep -E "v=spf1|selector" || echo "⚠️  SPF/Verification records not yet propagated"

# Check DMARC record
echo "2️⃣  Checking DMARC record..."
dig TXT "_dmarc.$DOMAIN" +short || echo "⚠️  DMARC record not yet propagated"

# Check DKIM CNAME records
echo "3️⃣  Checking DKIM selector 1..."
dig CNAME "selector1-azurecomm-prod-net._domainkey.$DOMAIN" +short || echo "⚠️  DKIM selector 1 not yet propagated"

echo "4️⃣  Checking DKIM selector 2..."
dig CNAME "selector2-azurecomm-prod-net._domainkey.$DOMAIN" +short || echo "⚠️  DKIM selector 2 not yet propagated"

echo ""
echo "🔍 Checking Azure Communication Services domain verification status..."
echo ""

# Get current verification status
VERIFICATION_STATUS=$(az communication email domain show \
  --email-service-name "$EMAIL_SERVICE" \
  --domain-name "$DOMAIN" \
  --resource-group "$RESOURCE_GROUP" \
  --query "verificationStates" \
  --output json)

echo "📊 Current Verification Status:"
echo "$VERIFICATION_STATUS" | jq '.'

# Check each verification component
DOMAIN_STATUS=$(echo "$VERIFICATION_STATUS" | jq -r '.Domain.status // "Unknown"')
SPF_STATUS=$(echo "$VERIFICATION_STATUS" | jq -r '.SPF.status // "Unknown"')
DKIM_STATUS=$(echo "$VERIFICATION_STATUS" | jq -r '.DKIM.status // "Unknown"')
DMARC_STATUS=$(echo "$VERIFICATION_STATUS" | jq -r '.DMARC.status // "Unknown"')

echo ""
echo "📋 Verification Summary:"
echo "  Domain Verification: $DOMAIN_STATUS"
echo "  SPF Status:          $SPF_STATUS"
echo "  DKIM Status:         $DKIM_STATUS"
echo "  DMARC Status:        $DMARC_STATUS"
echo ""

# Check if all are verified
if [[ "$DOMAIN_STATUS" == "Verified" && "$SPF_STATUS" == "Verified" && "$DKIM_STATUS" == "Verified" && "$DMARC_STATUS" == "Verified" ]]; then
  echo "✅ All verification checks passed! Email domain is ready to use."
  echo ""
  echo "🎉 You can now send emails from:"
  echo "  - noreply@$DOMAIN"
  echo "  - support@$DOMAIN"
  echo "  - billing@$DOMAIN"
  echo "  - notifications@$DOMAIN"
  echo ""
  echo "🔄 Next step: Test email sending with ./infrastructure/scripts/test-email.sh"
else
  echo "⏳ Verification not complete yet. Common reasons:"
  echo "  1. DNS records still propagating (wait 5-30 minutes)"
  echo "  2. DNS records not added correctly"
  echo "  3. Need to manually trigger verification in Azure Portal"
  echo ""
  echo "🔄 You can re-run this script to check status again"
  echo "📖 Or manually verify in Azure Portal:"
  echo "   Communication Services → $EMAIL_SERVICE → Provision domains → $DOMAIN → Verify"
fi

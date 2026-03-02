#!/bin/bash
# Configure DNS records for Azure Communication Services email authentication
# This script adds the required DNS records for email verification and authentication

set -euo pipefail

# Accept environment parameter (default: production)
ENVIRONMENT="${1:-production}"
DOMAIN="fundrbolt.com"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
EMAIL_SERVICE="fundrbolt-${ENVIRONMENT}-email"
ZONE_NAME="fundrbolt.com"

echo "🔍 Retrieving email configuration from Azure Communication Services..."

# Get domain verification and DKIM information
DOMAIN_INFO=$(az communication email domain show \
  --email-service-name "$EMAIL_SERVICE" \
  --domain-name "$DOMAIN" \
  --resource-group "$RESOURCE_GROUP" \
  --output json)

# Extract verification records
VERIFICATION_TOKEN=$(echo "$DOMAIN_INFO" | jq -r '.verificationRecords.Domain.value // empty')
SPF_VALUE=$(echo "$DOMAIN_INFO" | jq -r '.verificationRecords.SPF.value // empty')
DKIM_SELECTOR1=$(echo "$DOMAIN_INFO" | jq -r '.verificationRecords.DKIM.value // empty')
DKIM_SELECTOR2=$(echo "$DOMAIN_INFO" | jq -r '.verificationRecords.DKIM2.value // empty')

if [ -z "$VERIFICATION_TOKEN" ]; then
  echo "❌ Error: Could not retrieve verification token. Is the email service deployed?"
  exit 1
fi

echo "✅ Retrieved configuration values"
echo ""
echo "📝 Adding DNS records to Azure DNS Zone..."
echo ""

# 1. Domain Verification TXT Record
echo "1️⃣  Adding domain verification TXT record..."
az network dns record-set txt add-record \
  --zone-name "$ZONE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --record-set-name @ \
  --value "$VERIFICATION_TOKEN" \
  --ttl 3600 || echo "⚠️  Verification TXT record may already exist"

# 2. SPF Record
echo "2️⃣  Adding SPF TXT record..."
az network dns record-set txt add-record \
  --zone-name "$ZONE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --record-set-name @ \
  --value "$SPF_VALUE" \
  --ttl 3600 || echo "⚠️  SPF TXT record may already exist"

# 3. DMARC Record
echo "3️⃣  Adding DMARC TXT record..."
az network dns record-set txt add-record \
  --zone-name "$ZONE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --record-set-name _dmarc \
  --value "v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN; pct=100; fo=1" \
  --ttl 3600 || echo "⚠️  DMARC TXT record may already exist"

# 4. DKIM Selector 1 CNAME
if [ -n "$DKIM_SELECTOR1" ]; then
  echo "4️⃣  Adding DKIM selector 1 CNAME record..."
  az network dns record-set cname set-record \
    --zone-name "$ZONE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --record-set-name selector1-azurecomm-prod-net._domainkey \
    --cname "$DKIM_SELECTOR1" \
    --ttl 3600 || echo "⚠️  DKIM selector 1 CNAME may already exist"
else
  echo "⚠️  DKIM selector 1 not found, skipping..."
fi

# 5. DKIM Selector 2 CNAME
if [ -n "$DKIM_SELECTOR2" ]; then
  echo "5️⃣  Adding DKIM selector 2 CNAME record..."
  az network dns record-set cname set-record \
    --zone-name "$ZONE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --record-set-name selector2-azurecomm-prod-net._domainkey \
    --cname "$DKIM_SELECTOR2" \
    --ttl 3600 || echo "⚠️  DKIM selector 2 CNAME may already exist"
else
  echo "⚠️  DKIM selector 2 not found, skipping..."
fi

echo ""
echo "✅ DNS records configured successfully!"
echo ""
echo "📋 Summary of DNS records added:"
echo "  1. TXT @ (Domain Verification): $VERIFICATION_TOKEN"
echo "  2. TXT @ (SPF): v=spf1 include:spf.protection.outlook.com include:spf.azurecomm.net ~all"
echo "  3. TXT _dmarc (DMARC): v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"
echo "  4. CNAME selector1-azurecomm-prod-net._domainkey: $DKIM_SELECTOR1"
echo "  5. CNAME selector2-azurecomm-prod-net._domainkey: $DKIM_SELECTOR2"
echo ""
echo "⏳ DNS propagation may take 5-30 minutes"
echo ""
echo "🔄 Next steps:"
echo "  1. Wait 5-10 minutes for DNS propagation"
echo "  2. Verify the domain: ./infrastructure/scripts/verify-email-domain.sh"
echo "  3. Test email sending: ./infrastructure/scripts/test-email.sh"

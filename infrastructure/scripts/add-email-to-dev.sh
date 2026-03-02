#!/bin/bash
# Add Azure Communication Services to existing dev environment
# Cost: FREE for first 100 emails/month, then $0.0012/email

set -euo pipefail

ENVIRONMENT="dev"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
LOCATION="eastus"
ACS_NAME="fundrbolt-${ENVIRONMENT}-acs"
EMAIL_SERVICE_NAME="fundrbolt-${ENVIRONMENT}-email"
DOMAIN="fundrbolt.com"

echo "📧 Adding Azure Communication Services to Dev Environment"
echo "=========================================================="
echo ""
echo "This will deploy:"
echo "  ✓ Azure Communication Services (global service)"
echo "  ✓ Email Services"
echo "  ✓ Custom domain configuration for $DOMAIN"
echo ""
echo "💰 Cost: FREE for first 100 emails/month"
echo "   Additional emails: \$0.0012 per email (~\$1 per 1000 emails)"
echo ""

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "❌ Resource group $RESOURCE_GROUP not found."
    echo "   Please run: ./infrastructure/scripts/deploy-minimal.sh first"
    exit 1
fi

echo "✅ Found resource group: $RESOURCE_GROUP"
echo ""

read -p "Deploy Azure Communication Services? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Creating Azure Communication Services..."

# Create Communication Services
az communication create \
    --name "$ACS_NAME" \
    --location "global" \
    --resource-group "$RESOURCE_GROUP" \
    --data-location "United States"

echo "✅ Communication Services created"
echo ""
echo "🚀 Creating Email Services..."

# Create Email Services
az communication email create \
    --name "$EMAIL_SERVICE_NAME" \
    --location "global" \
    --resource-group "$RESOURCE_GROUP" \
    --data-location "United States"

echo "✅ Email Services created"
echo ""
echo "🚀 Configuring custom email domain: $DOMAIN..."

# Add custom domain (will need verification)
az communication email domain create \
    --email-service-name "$EMAIL_SERVICE_NAME" \
    --domain-name "$DOMAIN" \
    --resource-group "$RESOURCE_GROUP" \
    --location "global" \
    --domain-management "CustomerManaged"

echo "✅ Email domain configured (requires DNS verification)"
echo ""

# Get connection string
echo "🔑 Retrieving connection string..."
CONNECTION_STRING=$(az communication list-key \
    --name "$ACS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "primaryConnectionString" -o tsv)

# Store in Key Vault
KEY_VAULT_NAME="fundrbolt-${ENVIRONMENT}-kv"
echo "🔐 Storing connection string in Key Vault: $KEY_VAULT_NAME..."

az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "acs-connection-string" \
    --value "$CONNECTION_STRING" \
    --output none

echo "✅ Connection string stored in Key Vault"
echo ""
echo "📋 Deployment Summary:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Communication Services: $ACS_NAME"
echo "  Email Services: $EMAIL_SERVICE_NAME"
echo "  Email Domain: $DOMAIN (verification required)"
echo "  Key Vault Secret: acs-connection-string"
echo ""
echo "🔄 Next Steps:"
echo ""
echo "1. Configure DNS records for email verification:"
echo "   ./infrastructure/scripts/configure-email-dns.sh dev"
echo ""
echo "2. Wait 5-30 minutes for DNS propagation"
echo ""
echo "3. Verify domain:"
echo "   ./infrastructure/scripts/verify-email-domain.sh dev"
echo ""
echo "4. Test email sending:"
echo "   ./infrastructure/scripts/test-email.sh your-email@example.com"
echo ""
echo "💡 Tip: For local development without DNS setup, you can use"
echo "   Azure-managed domain (*.azurecomm.net) instead:"
echo "   ./infrastructure/scripts/setup-azure-managed-email.sh"

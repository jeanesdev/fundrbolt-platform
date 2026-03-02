#!/bin/bash

# Secret Management Script
# Generates secure secrets and stores them in Azure Key Vault
# Usage: ./configure-secrets.sh <environment>

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 production"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Environment must be dev, staging, or production"
    exit 1
fi

echo "🔐 Configuring secrets for $ENVIRONMENT environment..."

# Resource names
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
KEY_VAULT_NAME="fundrbolt-${ENVIRONMENT}-kv"
APP_SERVICE_NAME="fundrbolt-${ENVIRONMENT}-api"
POSTGRES_SERVER="fundrbolt-${ENVIRONMENT}-postgres"
REDIS_CACHE="fundrbolt-${ENVIRONMENT}-redis"

# Check if Key Vault exists
if ! az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "❌ Error: Key Vault $KEY_VAULT_NAME not found"
    echo "Please deploy infrastructure first: ./infrastructure/scripts/provision.sh $ENVIRONMENT"
    exit 1
fi

echo "✅ Key Vault found: $KEY_VAULT_NAME"

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to store secret in Key Vault
store_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    echo "  📝 Storing secret: $secret_name"
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$secret_name" \
        --value "$secret_value" \
        --description "$description" \
        --output none
}

echo ""
echo "🔑 Generating and storing secrets..."
echo ""

# 1. JWT Secret
echo "1️⃣  JWT Signing Key"
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "jwt-secret" &> /dev/null; then
    echo "  ⏭️  JWT secret already exists, skipping..."
else
    JWT_SECRET=$(generate_secret)
    store_secret "jwt-secret" "$JWT_SECRET" "JWT signing key for authentication tokens"
    echo "  ✅ Generated and stored jwt-secret"
fi

# 2. Database Connection String
echo ""
echo "2️⃣  Database Connection String"
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "database-url" &> /dev/null; then
    echo "  ⏭️  Database URL already exists, skipping..."
else
    # Get PostgreSQL admin password (must be provided during infrastructure deployment)
    echo "  ℹ️  Note: PostgreSQL password was set during infrastructure deployment"
    read -sp "  Enter PostgreSQL admin password (or press Enter to skip): " POSTGRES_PASSWORD
    echo ""

    if [ -n "$POSTGRES_PASSWORD" ]; then
        # Get PostgreSQL FQDN
        POSTGRES_FQDN=$(az postgres flexible-server show \
            --resource-group "$RESOURCE_GROUP" \
            --name "$POSTGRES_SERVER" \
            --query "fullyQualifiedDomainName" -o tsv)

        DATABASE_URL="postgresql://fundrbolt_admin:${POSTGRES_PASSWORD}@${POSTGRES_FQDN}:5432/fundrbolt?sslmode=require"
        store_secret "database-url" "$DATABASE_URL" "PostgreSQL database connection string"
        echo "  ✅ Stored database-url"
    else
        echo "  ⚠️  Skipping database-url (no password provided)"
    fi
fi

# 3. Redis Connection String
echo ""
echo "3️⃣  Redis Connection String"
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "redis-url" &> /dev/null; then
    echo "  ⏭️  Redis URL already exists, skipping..."
else
    # Get Redis access key
    REDIS_KEY=$(az redis list-keys \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_CACHE" \
        --query "primaryKey" -o tsv)

    # Get Redis hostname
    REDIS_HOST=$(az redis show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_CACHE" \
        --query "hostName" -o tsv)

    REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0?ssl_cert_reqs=required"
    store_secret "redis-url" "$REDIS_URL" "Redis cache connection string with SSL"
    echo "  ✅ Stored redis-url"
fi

# 4. Azure Communication Services Connection String (if exists)
echo ""
echo "4️⃣  Azure Communication Services"
ACS_NAME="fundrbolt-${ENVIRONMENT}-acs"
if az communication show --name "$ACS_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "acs-connection-string" &> /dev/null; then
        echo "  ⏭️  ACS connection string already exists, skipping..."
    else
        ACS_CONNECTION_STRING=$(az communication list-key \
            --name "$ACS_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --query "primaryConnectionString" -o tsv)

        store_secret "acs-connection-string" "$ACS_CONNECTION_STRING" "Azure Communication Services connection string for email"
        echo "  ✅ Stored acs-connection-string"
    fi
else
    echo "  ℹ️  Azure Communication Services not deployed (optional for non-production)"
fi

# 5. Stripe API Key (manual input)
echo ""
echo "5️⃣  Stripe API Key"
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "stripe-api-key" &> /dev/null; then
    echo "  ⏭️  Stripe API key already exists, skipping..."
else
    read -p "  Enter Stripe API key (or press Enter to skip): " STRIPE_KEY
    if [ -n "$STRIPE_KEY" ]; then
        store_secret "stripe-api-key" "$STRIPE_KEY" "Stripe API key for payment processing"
        echo "  ✅ Stored stripe-api-key"
    else
        echo "  ⏭️  Skipping stripe-api-key"
    fi
fi

# 6. Twilio API Key (manual input)
echo ""
echo "6️⃣  Twilio API Key"
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "twilio-api-key" &> /dev/null; then
    echo "  ⏭️  Twilio API key already exists, skipping..."
else
    read -p "  Enter Twilio Account SID (or press Enter to skip): " TWILIO_SID
    if [ -n "$TWILIO_SID" ]; then
        read -sp "  Enter Twilio Auth Token: " TWILIO_TOKEN
        echo ""
        TWILIO_KEY="${TWILIO_SID}:${TWILIO_TOKEN}"
        store_secret "twilio-api-key" "$TWILIO_KEY" "Twilio API credentials for SMS"
        echo "  ✅ Stored twilio-api-key"
    else
        echo "  ⏭️  Skipping twilio-api-key"
    fi
fi

# 7. Email SMTP Configuration (if using external SMTP)
echo ""
echo "7️⃣  SMTP Configuration (optional)"
read -p "  Configure SMTP email? (y/N): " CONFIGURE_SMTP
if [[ "$CONFIGURE_SMTP" =~ ^[Yy]$ ]]; then
    read -p "  SMTP Host: " SMTP_HOST
    read -p "  SMTP User: " SMTP_USER
    read -sp "  SMTP Password: " SMTP_PASSWORD
    echo ""

    store_secret "email-smtp-host" "$SMTP_HOST" "SMTP server hostname"
    store_secret "email-smtp-user" "$SMTP_USER" "SMTP authentication username"
    store_secret "email-smtp-password" "$SMTP_PASSWORD" "SMTP authentication password"
    echo "  ✅ Stored SMTP secrets"
else
    echo "  ⏭️  Skipping SMTP configuration"
fi

echo ""
echo "✅ Secret configuration complete!"
echo ""
echo "📋 Secrets stored in Key Vault: $KEY_VAULT_NAME"
echo ""

# List all secrets
echo "🔍 Current secrets:"
az keyvault secret list \
    --vault-name "$KEY_VAULT_NAME" \
    --query "[].{Name:name, Updated:attributes.updated}" \
    --output table

echo ""
echo "🔗 Next steps:"
echo "  1. Configure App Service to use Key Vault references"
echo "  2. Verify managed identity permissions"
echo "  3. Restart App Service to load secrets"
echo ""
echo "Run: ./infrastructure/scripts/update-app-settings.sh $ENVIRONMENT"

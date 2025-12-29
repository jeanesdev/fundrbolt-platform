#!/bin/bash

# Update App Service Settings Script
# Configures App Service to use Key Vault references for secrets
# Usage: ./update-app-settings.sh <environment>

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

echo "⚙️  Updating App Service settings for $ENVIRONMENT environment..."

# Resource names
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
KEY_VAULT_NAME="fundrbolt-${ENVIRONMENT}-kv"
APP_SERVICE_NAME="fundrbolt-${ENVIRONMENT}-api"
STATIC_WEB_APP_NAME="fundrbolt-${ENVIRONMENT}-admin"

# Get Key Vault URI
KEY_VAULT_URI=$(az keyvault show \
    --name "$KEY_VAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.vaultUri" -o tsv)

echo "✅ Key Vault URI: $KEY_VAULT_URI"

# Function to create Key Vault reference
kv_ref() {
    local secret_name=$1
    echo "@Microsoft.KeyVault(SecretUri=${KEY_VAULT_URI}secrets/${secret_name}/)"
}

# Environment-specific frontend URL
case $ENVIRONMENT in
    dev)
        FRONTEND_URL="https://fundrbolt-dev-admin.azurestaticapps.net"
        CORS_ORIGINS="http://localhost:5173,https://fundrbolt-dev-admin.azurestaticapps.net"
        ;;
    staging)
        FRONTEND_URL="https://fundrbolt-staging-admin.azurestaticapps.net"
        CORS_ORIGINS="https://fundrbolt-staging-admin.azurestaticapps.net"
        ;;
    production)
        FRONTEND_URL="https://admin.fundrbolt.com"
        CORS_ORIGINS="https://admin.fundrbolt.com,https://fundrbolt.com"
        ;;
esac

echo ""
echo "📝 Configuring App Service settings..."

# Configure App Service application settings
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        ENVIRONMENT="$ENVIRONMENT" \
        DATABASE_URL="$(kv_ref database-url)" \
        REDIS_URL="$(kv_ref redis-url)" \
        JWT_SECRET="$(kv_ref jwt-secret)" \
        FRONTEND_URL="$FRONTEND_URL" \
        CORS_ORIGINS="$CORS_ORIGINS" \
        LOG_LEVEL="INFO" \
        SESSION_TIMEOUT="900" \
        ACCESS_TOKEN_EXPIRE_MINUTES="15" \
        REFRESH_TOKEN_EXPIRE_DAYS="7" \
        EMAIL_FROM="noreply@fundrbolt.com" \
        PYTHON_VERSION="3.11" \
        WEBSITES_PORT="8000" \
        WEBSITES_ENABLE_APP_SERVICE_STORAGE="false" \
        DOCKER_ENABLE_CI="true" \
    --output none

echo "  ✅ Basic settings configured"

# Add optional secrets if they exist in Key Vault
echo ""
echo "🔍 Checking for optional secrets..."

# Check for ACS connection string
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "acs-connection-string" &> /dev/null; then
    echo "  📧 Configuring Azure Communication Services..."
    az webapp config appsettings set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            ACS_CONNECTION_STRING="$(kv_ref acs-connection-string)" \
            EMAIL_PROVIDER="azure_communication_services" \
        --output none
    echo "  ✅ ACS configured"
fi

# Check for SMTP settings
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "email-smtp-host" &> /dev/null; then
    echo "  📧 Configuring SMTP email..."
    az webapp config appsettings set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            EMAIL_SMTP_HOST="$(kv_ref email-smtp-host)" \
            EMAIL_SMTP_USER="$(kv_ref email-smtp-user)" \
            EMAIL_SMTP_PASSWORD="$(kv_ref email-smtp-password)" \
            EMAIL_SMTP_PORT="587" \
            EMAIL_PROVIDER="smtp" \
        --output none
    echo "  ✅ SMTP configured"
fi

# Check for Stripe API key
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "stripe-api-key" &> /dev/null; then
    echo "  💳 Configuring Stripe..."
    az webapp config appsettings set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            STRIPE_API_KEY="$(kv_ref stripe-api-key)" \
        --output none
    echo "  ✅ Stripe configured"
fi

# Check for Twilio API key
if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "twilio-api-key" &> /dev/null; then
    echo "  📱 Configuring Twilio..."
    az webapp config appsettings set \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            TWILIO_API_KEY="$(kv_ref twilio-api-key)" \
        --output none
    echo "  ✅ Twilio configured"
fi

echo ""
echo "🔐 Verifying managed identity permissions..."

# Get App Service managed identity
PRINCIPAL_ID=$(az webapp identity show \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "principalId" -o tsv)

if [ -z "$PRINCIPAL_ID" ]; then
    echo "  ❌ Error: App Service does not have managed identity enabled"
    echo "  Run: az webapp identity assign --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP"
    exit 1
fi

echo "  ✅ Managed identity: $PRINCIPAL_ID"

# Check if Key Vault Secrets User role is assigned
ROLE_ASSIGNMENT=$(az role assignment list \
    --assignee "$PRINCIPAL_ID" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME" \
    --query "[?roleDefinitionName=='Key Vault Secrets User'].roleDefinitionName" -o tsv)

if [ -z "$ROLE_ASSIGNMENT" ]; then
    echo "  ⚠️  Key Vault Secrets User role not assigned, assigning now..."
    az role assignment create \
        --role "Key Vault Secrets User" \
        --assignee-object-id "$PRINCIPAL_ID" \
        --assignee-principal-type ServicePrincipal \
        --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME" \
        --output none
    echo "  ✅ Role assigned"
else
    echo "  ✅ Key Vault Secrets User role already assigned"
fi

echo ""
echo "♻️  Restarting App Service to load new settings..."
az webapp restart \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none

echo "  ✅ App Service restarted"

# Wait for app to start
echo ""
echo "⏳ Waiting for application to start (30 seconds)..."
sleep 30

# Health check
HEALTH_URL="https://${APP_SERVICE_NAME}.azurewebsites.net/health"
echo "🏥 Checking application health..."

if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo "  ✅ Application is healthy!"
    echo "  URL: $HEALTH_URL"
else
    echo "  ⚠️  Health check failed"
    echo "  Check logs: az webapp log tail --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP"
fi

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Configured settings:"
az webapp config appsettings list \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[].{Name:name, Value:value}" \
    --output table

echo ""
echo "🔒 Security notes:"
echo "  - All sensitive secrets are stored in Key Vault"
echo "  - App Service uses managed identity (no credentials needed)"
echo "  - Secret values never appear in logs or deployment history"
echo "  - Key Vault audit logs track all secret access"
echo ""
echo "📚 Next steps:"
echo "  1. Review audit logs: az monitor activity-log list --resource-group $RESOURCE_GROUP"
echo "  2. Test secret rotation: Update secret in Key Vault and restart app"
echo "  3. Review security compliance: See docs/operations/security-checklist.md"

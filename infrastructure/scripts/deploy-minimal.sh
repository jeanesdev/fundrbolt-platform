#!/bin/bash
# Deploy minimal Azure infrastructure for local development
# This costs less than $1/month

set -e

echo "🚀 Deploying Minimal Azure Infrastructure for Local Development"
echo "================================================================"
echo ""
echo "This will deploy only:"
echo "  ✓ Resource Group (free)"
echo "  ✓ Key Vault (~\$0.03/10k operations)"
echo "  ✓ Storage Account (first 5GB ~\$0.10/month)"
echo "  ✓ Application Insights (5GB/month free)"
echo "  ✓ Log Analytics (5GB/month free)"
echo ""
echo "Estimated cost: Less than \$1/month"
echo ""

# Check if user is logged in to Azure
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

# Get current subscription
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "📋 Using Azure Subscription:"
echo "   Name: $SUBSCRIPTION_NAME"
echo "   ID: $SUBSCRIPTION_ID"
echo ""

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🔨 Validating Bicep template..."
az deployment sub validate \
    --location eastus \
    --template-file infrastructure/bicep/main-minimal.bicep \
    --parameters infrastructure/bicep/parameters/dev-minimal.bicepparam \
    --query "properties.provisioningState" -o tsv

if [ $? -eq 0 ]; then
    echo "✅ Validation successful!"
else
    echo "❌ Validation failed. Please check the errors above."
    exit 1
fi

echo ""
echo "🚀 Deploying minimal infrastructure..."
DEPLOYMENT_NAME="fundrbolt-dev-minimal-$(date +%Y%m%d-%H%M%S)"

az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location eastus \
    --template-file infrastructure/bicep/main-minimal.bicep \
    --parameters infrastructure/bicep/parameters/dev-minimal.bicepparam

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment complete!"
    echo ""

    # Get outputs
    echo "📊 Deployment Outputs:"
    az deployment sub show \
        --name "$DEPLOYMENT_NAME" \
        --query "properties.outputs" -o json

    echo ""
    echo "🎉 Success! Next steps:"
    echo ""
    echo "1. Set up secrets in Key Vault:"
    echo "   ./infrastructure/scripts/configure-secrets.sh dev"
    echo ""
    echo "2. Start local PostgreSQL and Redis:"
    echo "   docker-compose up -d"
    echo ""
    echo "3. Run backend locally:"
    echo "   make dev-backend"
    echo ""
    echo "4. Run frontend locally (in another terminal):"
    echo "   make dev-frontend"
    echo ""
    echo "5. View costs (should be <\$1/month):"
    echo "   az costmanagement query --type ActualCost --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/fundrbolt-dev-rg --timeframe MonthToDate"
    echo ""

else
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi

#!/bin/bash

# Frontend deployment script
# Usage: ./deploy-frontend.sh <environment> <deployment-token>

set -e

ENVIRONMENT=$1
DEPLOYMENT_TOKEN=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$DEPLOYMENT_TOKEN" ]; then
    echo "Usage: $0 <environment> <deployment-token>"
    echo "Example: $0 dev abc123..."
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Environment must be dev, staging, or production"
    exit 1
fi

echo "Deploying frontend to $ENVIRONMENT environment..."

# Set API URL based on environment
case $ENVIRONMENT in
    dev)
        API_URL="https://fundrbolt-dev-api.azurewebsites.net"
        ;;
    staging)
        API_URL="https://fundrbolt-staging-api.azurewebsites.net"
        ;;
    production)
        API_URL="https://api.fundrbolt.com"
        ;;
esac

echo "Using API URL: $API_URL"

# Navigate to frontend directory
cd frontend/fundrbolt-admin

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build frontend
echo "Building frontend..."
VITE_API_URL="$API_URL" pnpm build

# Deploy using Azure Static Web Apps CLI
echo "Deploying to Azure Static Web Apps..."
npx @azure/static-web-apps-cli deploy \
    --deployment-token "$DEPLOYMENT_TOKEN" \
    --app-location "." \
    --output-location "dist" \
    --env "$ENVIRONMENT"

echo "✅ Frontend deployment completed successfully"

#!/bin/bash

# Backend deployment script
# Usage: ./deploy-backend.sh <environment> <image-tag>

set -e

ENVIRONMENT=$1
IMAGE_TAG=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ]; then
    echo "Usage: $0 <environment> <image-tag>"
    echo "Example: $0 dev v1.0.0"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Environment must be dev, staging, or production"
    exit 1
fi

echo "Deploying backend to $ENVIRONMENT environment..."
echo "Image tag: $IMAGE_TAG"

# Resource names
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
APP_NAME="fundrbolt-${ENVIRONMENT}-api"
IMAGE_NAME="ghcr.io/fundrbolt-platform/fundrbolt-backend:${IMAGE_TAG}"

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "Error: Resource group $RESOURCE_GROUP does not exist"
    echo "Please deploy infrastructure first"
    exit 1
fi

# For production, deploy to staging slot first
if [ "$ENVIRONMENT" == "production" ]; then
    echo "Deploying to staging slot for production..."

    # Configure container in staging slot
    az webapp config container set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --slot staging \
        --docker-custom-image-name "$IMAGE_NAME" \
        --docker-registry-server-url "https://ghcr.io"

    # Restart staging slot
    az webapp restart \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --slot staging

    echo "Waiting for staging slot to start..."
    sleep 30

    # Health check on staging slot
    STAGING_URL="https://${APP_NAME}-staging.azurewebsites.net/health"
    echo "Checking staging slot health: $STAGING_URL"

    MAX_RETRIES=10
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s "$STAGING_URL" > /dev/null; then
            echo "✅ Staging slot is healthy"
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
        sleep 10
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ Staging slot health check failed after $MAX_RETRIES attempts"
        exit 1
    fi

    echo "Swapping staging slot to production..."
    az webapp deployment slot swap \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --slot staging \
        --target-slot production

    echo "Waiting for production slot to settle..."
    sleep 10

else
    # Direct deployment for dev and staging environments
    echo "Deploying directly to $ENVIRONMENT..."

    # Configure container
    az webapp config container set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "$IMAGE_NAME" \
        --docker-registry-server-url "https://ghcr.io"

    # Restart app
    az webapp restart \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP"

    echo "Waiting for app to start..."
    sleep 30
fi

# Final health check
HEALTH_URL="https://${APP_NAME}.azurewebsites.net/health"
echo "Checking production health: $HEALTH_URL"

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        echo "✅ Deployment successful - application is healthy"
        exit 0
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
    sleep 10
done

echo "❌ Deployment failed - health check unsuccessful after $MAX_RETRIES attempts"
exit 1

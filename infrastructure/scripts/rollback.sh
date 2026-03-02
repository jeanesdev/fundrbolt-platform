#!/bin/bash

# Rollback script for production deployments
# Usage: ./rollback.sh <component> [image-tag]
#   component: backend or frontend
#   image-tag: (backend only) previous Docker image tag

set -e

COMPONENT=$1
IMAGE_TAG=$2

if [ -z "$COMPONENT" ]; then
    echo "Usage: $0 <component> [image-tag]"
    echo "  component: backend or frontend"
    echo "  image-tag: (backend only) previous Docker image tag"
    echo ""
    echo "Examples:"
    echo "  $0 backend v1.0.0"
    echo "  $0 frontend"
    exit 1
fi

# Validate component
if [[ ! "$COMPONENT" =~ ^(backend|frontend)$ ]]; then
    echo "Error: Component must be backend or frontend"
    exit 1
fi

ENVIRONMENT="production"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"

echo "Rolling back $COMPONENT in $ENVIRONMENT environment..."

if [ "$COMPONENT" == "backend" ]; then
    APP_NAME="fundrbolt-${ENVIRONMENT}-api"

    # Check if we should swap slots or redeploy
    if [ -z "$IMAGE_TAG" ]; then
        # Swap slots back (undo previous swap)
        echo "Swapping slots back to previous version..."
        az webapp deployment slot swap \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --slot staging \
            --target-slot production

        echo "Waiting for swap to complete..."
        sleep 10
    else
        # Redeploy specific image version
        echo "Redeploying previous image: $IMAGE_TAG"
        IMAGE_NAME="ghcr.io/fundrbolt-platform/fundrbolt-backend:${IMAGE_TAG}"

        # Deploy to staging slot first
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
            echo "❌ Staging slot health check failed"
            exit 1
        fi

        # Swap to production
        echo "Swapping staging to production..."
        az webapp deployment slot swap \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --slot staging \
            --target-slot production

        echo "Waiting for production slot to settle..."
        sleep 10
    fi

    # Final health check
    HEALTH_URL="https://${APP_NAME}.azurewebsites.net/health"
    echo "Checking production health: $HEALTH_URL"

    MAX_RETRIES=10
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            echo "✅ Rollback successful - application is healthy"
            exit 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
        sleep 10
    done

    echo "❌ Rollback verification failed - health check unsuccessful"
    exit 1

elif [ "$COMPONENT" == "frontend" ]; then
    echo "Frontend rollback requires redeploying previous build"
    echo "Please use the deploy-frontend.sh script with the previous version"
    echo "Or trigger the frontend-deploy workflow with the previous Git tag"
    exit 1
fi

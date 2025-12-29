#!/bin/bash

# Database migration script
# Usage: ./run-migrations.sh <environment>

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 dev"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "Error: Environment must be dev, staging, or production"
    exit 1
fi

echo "Running database migrations for $ENVIRONMENT environment..."

# Resource names
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
APP_NAME="fundrbolt-${ENVIRONMENT}-api"

# Get database connection string from App Service
echo "Retrieving database connection string..."
DATABASE_URL=$(az webapp config appsettings list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='DATABASE_URL'].value" \
    --output tsv)

if [ -z "$DATABASE_URL" ]; then
    echo "Error: Could not retrieve DATABASE_URL from App Service"
    exit 1
fi

# Export for Alembic
export DATABASE_URL

# Navigate to backend directory
cd backend

# Run migrations using Poetry
echo "Running Alembic migrations..."
poetry run alembic upgrade head

echo "✅ Database migrations completed successfully"

# Show current migration version
echo "Current database version:"
poetry run alembic current

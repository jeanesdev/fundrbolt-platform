#!/bin/bash

# Container startup script for Azure App Service

set -e

echo "Starting Fundrbolt backend..."
echo "Environment: $ENVIRONMENT"
echo "Python version: $(python --version)"

# Run database migrations
echo "Running database migrations..."
poetry run alembic upgrade head

# Start uvicorn server
echo "Starting uvicorn server on port ${WEBSITES_PORT:-8000}..."
exec poetry run uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${WEBSITES_PORT:-8000}" \
    --log-level info \
    --access-log \
    --proxy-headers \
    --forwarded-allow-ips='*'

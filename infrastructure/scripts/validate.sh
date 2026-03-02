#!/bin/bash
# Infrastructure validation script for Fundrbolt Platform
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_DIR="$(dirname "$SCRIPT_DIR")/bicep"

echo -e "${GREEN}=== Fundrbolt Platform Infrastructure Validation ===${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Validate Bicep syntax
echo -e "${YELLOW}1. Validating Bicep syntax...${NC}"
if az bicep build --file "$BICEP_DIR/main.bicep" --stdout > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Bicep syntax valid${NC}"
else
  echo -e "${RED}✗ Bicep syntax errors found${NC}"
  az bicep build --file "$BICEP_DIR/main.bicep"
  exit 1
fi

# Validate modules exist
echo -e "${YELLOW}2. Checking module files...${NC}"
MODULES=(
  "resource-group.bicep"
  "app-service-plan.bicep"
  "app-service.bicep"
  "static-web-app.bicep"
  "database.bicep"
  "redis.bicep"
  "key-vault.bicep"
  "log-analytics.bicep"
  "monitoring.bicep"
  "storage.bicep"
)

for module in "${MODULES[@]}"; do
  if [ -f "$BICEP_DIR/modules/$module" ]; then
    echo -e "${GREEN}✓ Found $module${NC}"
  else
    echo -e "${RED}✗ Missing $module${NC}"
    exit 1
  fi
done

# Run deployment validation (no actual deployment)
echo -e "${YELLOW}3. Running deployment validation...${NC}"

# Generate a random password for validation
TEMP_PASSWORD=$(openssl rand -base64 32)

az deployment sub validate \
  --location eastus \
  --template-file "$BICEP_DIR/main.bicep" \
  --parameters environment="$ENVIRONMENT" location=eastus postgresAdminPassword="$TEMP_PASSWORD" \
  --output none

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Deployment validation passed${NC}"
else
  echo -e "${RED}✗ Deployment validation failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== All Validations Passed ===${NC}"
echo "Infrastructure templates are ready for deployment."

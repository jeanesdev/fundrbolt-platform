#!/bin/bash
set -e

# Deploy minimal Fundrbolt resources (rename from Augeo)
# Only creates: Resource Group, Key Vault, Storage, Logs, Insights, Communication, DNS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Environment parameter (default: dev)
ENV="${1:-dev}"

echo -e "${BLUE}=== Fundrbolt Minimal Deployment (Rename) ===${NC}"
echo -e "${YELLOW}Environment: ${ENV}${NC}"
echo ""

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'. Must be dev, staging, or production${NC}"
    exit 1
fi

# Check Azure CLI login
echo -e "${BLUE}Checking Azure CLI authentication...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Error: Not logged in to Azure CLI${NC}"
    echo "Run: az login"
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in to subscription: ${SUBSCRIPTION_NAME}${NC}"
echo ""

# Bicep files
BICEP_MAIN="$PROJECT_ROOT/infrastructure/bicep/main-minimal-rename.bicep"
BICEP_PARAMS="$PROJECT_ROOT/infrastructure/bicep/parameters/${ENV}-minimal-rename.bicepparam"

# Validate Bicep files exist
if [[ ! -f "$BICEP_MAIN" ]]; then
    echo -e "${RED}Error: Bicep template not found: $BICEP_MAIN${NC}"
    exit 1
fi

if [[ ! -f "$BICEP_PARAMS" ]]; then
    echo -e "${RED}Error: Parameters file not found: $BICEP_PARAMS${NC}"
    exit 1
fi

# Deployment name
DEPLOYMENT_NAME="fundrbolt-${ENV}-minimal-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}Deployment Configuration:${NC}"
echo "  Template: main-minimal-rename.bicep"
echo "  Parameters: ${ENV}-minimal-rename.bicepparam"
echo "  Deployment: $DEPLOYMENT_NAME"
echo ""

# What-If analysis
echo -e "${YELLOW}Running What-If analysis...${NC}"
az deployment sub what-if \
    --name "$DEPLOYMENT_NAME" \
    --location eastus \
    --template-file "$BICEP_MAIN" \
    --parameters "$BICEP_PARAMS" \
    --no-pretty-print

echo ""
read -p "Continue with deployment? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Deploy
echo ""
echo -e "${BLUE}Deploying infrastructure...${NC}"
az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location eastus \
    --template-file "$BICEP_MAIN" \
    --parameters "$BICEP_PARAMS" \
    --output table

# Get outputs
echo ""
echo -e "${BLUE}Deployment Outputs:${NC}"
az deployment sub show \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs' \
    --output json | jq -r 'to_entries[] | "\(.key): \(.value.value)"'

echo ""
echo -e "${GREEN}✓ Minimal deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Migrate Key Vault secrets from augeo-${ENV}-kv to fundrbolt-${ENV}-kv"
echo "2. Copy storage data from augeo${ENV}stor to fundrbolt${ENV}stor"
echo "3. Update DNS records at your domain registrar"
echo "4. Configure Communication Services email domain"
echo "5. Run full deployment when ready for App Service, PostgreSQL, Redis"

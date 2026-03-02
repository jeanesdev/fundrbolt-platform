#!/bin/bash
set -e

# Migrate Key Vault secrets from augeo-* to fundrbolt-*

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Environment parameter (default: dev)
ENV="${1:-dev}"

echo -e "${BLUE}=== Key Vault Migration: augeo → fundrbolt ===${NC}"
echo -e "${YELLOW}Environment: ${ENV}${NC}"
echo ""

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'. Must be dev, staging, or production${NC}"
    exit 1
fi

# Key Vault names
SOURCE_KV="augeo-${ENV}-kv"
TARGET_KV="fundrbolt-${ENV}-kv"

# Check Azure CLI login
if ! az account show &>/dev/null; then
    echo -e "${RED}Error: Not logged in to Azure CLI${NC}"
    echo "Run: az login"
    exit 1
fi

echo -e "${BLUE}Source Key Vault: ${SOURCE_KV}${NC}"
echo -e "${BLUE}Target Key Vault: ${TARGET_KV}${NC}"
echo ""

# Check if source Key Vault exists
if ! az keyvault show --name "$SOURCE_KV" &>/dev/null; then
    echo -e "${RED}Error: Source Key Vault '$SOURCE_KV' not found${NC}"
    exit 1
fi

# Check if target Key Vault exists
if ! az keyvault show --name "$TARGET_KV" &>/dev/null; then
    echo -e "${RED}Error: Target Key Vault '$TARGET_KV' not found${NC}"
    echo "Run the minimal deployment first: ./scripts/deploy-minimal-rename.sh $ENV"
    exit 1
fi

# Get all secret names from source
echo -e "${BLUE}Fetching secrets from ${SOURCE_KV}...${NC}"
SECRET_NAMES=$(az keyvault secret list --vault-name "$SOURCE_KV" --query '[].name' -o tsv)

if [[ -z "$SECRET_NAMES" ]]; then
    echo -e "${YELLOW}No secrets found in source Key Vault${NC}"
    exit 0
fi

SECRET_COUNT=$(echo "$SECRET_NAMES" | wc -l)
echo -e "${GREEN}Found ${SECRET_COUNT} secrets to migrate${NC}"
echo ""

# Confirm migration
echo -e "${YELLOW}Secrets to migrate:${NC}"
echo "$SECRET_NAMES" | sed 's/^/  - /'
echo ""
read -p "Continue with migration? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

# Migrate each secret
echo ""
echo -e "${BLUE}Migrating secrets...${NC}"
MIGRATED=0
FAILED=0

while IFS= read -r SECRET_NAME; do
    echo -ne "  Migrating ${SECRET_NAME}... "

    # Get secret value from source
    SECRET_VALUE=$(az keyvault secret show \
        --vault-name "$SOURCE_KV" \
        --name "$SECRET_NAME" \
        --query 'value' -o tsv 2>/dev/null)

    if [[ -z "$SECRET_VALUE" ]]; then
        echo -e "${RED}FAILED (couldn't read)${NC}"
        ((FAILED++))
        continue
    fi

    # Set secret in target
    if az keyvault secret set \
        --vault-name "$TARGET_KV" \
        --name "$SECRET_NAME" \
        --value "$SECRET_VALUE" \
        --output none 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((MIGRATED++))
    else
        echo -e "${RED}FAILED (couldn't write)${NC}"
        ((FAILED++))
    fi
done <<< "$SECRET_NAMES"

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo "  Migrated: ${MIGRATED}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "  ${RED}Failed: ${FAILED}${NC}"
fi
echo ""

# Verify migration
echo -e "${BLUE}Verifying migration...${NC}"
TARGET_COUNT=$(az keyvault secret list --vault-name "$TARGET_KV" --query 'length(@)' -o tsv)
echo -e "${GREEN}Target Key Vault now has ${TARGET_COUNT} secrets${NC}"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test application with new Key Vault: $TARGET_KV"
echo "2. Update app settings to reference new Key Vault"
echo "3. After verification, delete old Key Vault: $SOURCE_KV"
echo ""
echo "To delete old Key Vault (after verification):"
echo "  az keyvault delete --name $SOURCE_KV"
echo "  az keyvault purge --name $SOURCE_KV  # Permanent deletion"

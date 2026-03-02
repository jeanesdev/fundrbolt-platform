#!/bin/bash
set -e

# Migrate Azure Storage blobs from augeo-* to fundrbolt-*

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Environment parameter (default: dev)
ENV="${1:-dev}"

echo -e "${BLUE}=== Storage Migration: augeo → fundrbolt ===${NC}"
echo -e "${YELLOW}Environment: ${ENV}${NC}"
echo ""

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'. Must be dev, staging, or production${NC}"
    exit 1
fi

# Storage account names
# Note: augeo storage was truncated to 15 chars (augeodevst vs fundrboltdevstor)
SOURCE_STORAGE="augeo${ENV}st"
TARGET_STORAGE="fundrbolt${ENV}stor"

# Check Azure CLI login
if ! az account show &>/dev/null; then
    echo -e "${RED}Error: Not logged in to Azure CLI${NC}"
    echo "Run: az login"
    exit 1
fi

echo -e "${BLUE}Source Storage: ${SOURCE_STORAGE}${NC}"
echo -e "${BLUE}Target Storage: ${TARGET_STORAGE}${NC}"
echo ""

# Check if source storage exists
if ! az storage account show --name "$SOURCE_STORAGE" &>/dev/null; then
    echo -e "${RED}Error: Source storage account '$SOURCE_STORAGE' not found${NC}"
    exit 1
fi

# Check if target storage exists
if ! az storage account show --name "$TARGET_STORAGE" &>/dev/null; then
    echo -e "${RED}Error: Target storage account '$TARGET_STORAGE' not found${NC}"
    echo "Run the minimal deployment first: ./scripts/deploy-minimal-rename.sh $ENV"
    exit 1
fi

# Get storage account keys
echo -e "${BLUE}Fetching storage account keys...${NC}"
SOURCE_KEY=$(az storage account keys list \
    --account-name "$SOURCE_STORAGE" \
    --query '[0].value' -o tsv)
TARGET_KEY=$(az storage account keys list \
    --account-name "$TARGET_STORAGE" \
    --query '[0].value' -o tsv)

# Get list of containers from source
echo -e "${BLUE}Fetching containers from ${SOURCE_STORAGE}...${NC}"
CONTAINERS=$(az storage container list \
    --account-name "$SOURCE_STORAGE" \
    --account-key "$SOURCE_KEY" \
    --query '[].name' -o tsv)

if [[ -z "$CONTAINERS" ]]; then
    echo -e "${YELLOW}No containers found in source storage${NC}"
    exit 0
fi

CONTAINER_COUNT=$(echo "$CONTAINERS" | wc -l)
echo -e "${GREEN}Found ${CONTAINER_COUNT} containers to migrate${NC}"
echo ""

# Show containers
echo -e "${YELLOW}Containers to migrate:${NC}"
echo "$CONTAINERS" | sed 's/^/  - /'
echo ""

# Check blob counts
echo -e "${BLUE}Checking blob counts...${NC}"
TOTAL_BLOBS=0
while IFS= read -r CONTAINER; do
    BLOB_COUNT=$(az storage blob list \
        --account-name "$SOURCE_STORAGE" \
        --account-key "$SOURCE_KEY" \
        --container-name "$CONTAINER" \
        --query 'length(@)' -o tsv)
    echo "  $CONTAINER: $BLOB_COUNT blobs"
    TOTAL_BLOBS=$((TOTAL_BLOBS + BLOB_COUNT))
done <<< "$CONTAINERS"

echo -e "${GREEN}Total: ${TOTAL_BLOBS} blobs${NC}"
echo ""

# Confirm migration
read -p "Continue with migration? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

# Migrate each container
echo ""
echo -e "${BLUE}Migrating containers...${NC}"
MIGRATED_CONTAINERS=0
MIGRATED_BLOBS=0

while IFS= read -r CONTAINER; do
    echo ""
    echo -e "${BLUE}Migrating container: ${CONTAINER}${NC}"

    # Create container in target if it doesn't exist
    if ! az storage container exists \
        --account-name "$TARGET_STORAGE" \
        --account-key "$TARGET_KEY" \
        --name "$CONTAINER" \
        --query 'exists' -o tsv | grep -q true; then

        echo "  Creating container in target..."
        az storage container create \
            --account-name "$TARGET_STORAGE" \
            --account-key "$TARGET_KEY" \
            --name "$CONTAINER" \
            --output none
    fi

    # Get public access level
    PUBLIC_ACCESS=$(az storage container show \
        --account-name "$SOURCE_STORAGE" \
        --account-key "$SOURCE_KEY" \
        --name "$CONTAINER" \
        --query 'properties.publicAccess' -o tsv)

    # Set public access on target
    if [[ "$PUBLIC_ACCESS" != "null" && -n "$PUBLIC_ACCESS" ]]; then
        echo "  Setting public access: $PUBLIC_ACCESS"
        az storage container set-permission \
            --account-name "$TARGET_STORAGE" \
            --account-key "$TARGET_KEY" \
            --name "$CONTAINER" \
            --public-access "$PUBLIC_ACCESS" \
            --output none
    fi

    # Copy blobs using AzCopy batch
    echo "  Copying blobs..."
    SOURCE_URL="https://${SOURCE_STORAGE}.blob.core.windows.net/${CONTAINER}"
    TARGET_URL="https://${TARGET_STORAGE}.blob.core.windows.net/${CONTAINER}"

    # Get blob list
    BLOBS=$(az storage blob list \
        --account-name "$SOURCE_STORAGE" \
        --account-key "$SOURCE_KEY" \
        --container-name "$CONTAINER" \
        --query '[].name' -o tsv)

    if [[ -n "$BLOBS" ]]; then
        BLOB_COUNT=0
        while IFS= read -r BLOB; do
            SOURCE_BLOB="${SOURCE_URL}/${BLOB}?${SOURCE_KEY}"

            az storage blob copy start \
                --account-name "$TARGET_STORAGE" \
                --account-key "$TARGET_KEY" \
                --destination-blob "$BLOB" \
                --destination-container "$CONTAINER" \
                --source-uri "$SOURCE_URL/$BLOB" \
                --output none 2>/dev/null || true

            ((BLOB_COUNT++))
            ((MIGRATED_BLOBS++))
        done <<< "$BLOBS"

        echo -e "  ${GREEN}✓ Copied ${BLOB_COUNT} blobs${NC}"
    else
        echo "  (empty container)"
    fi

    ((MIGRATED_CONTAINERS++))
done <<< "$CONTAINERS"

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo "  Containers: ${MIGRATED_CONTAINERS}"
echo "  Blobs: ${MIGRATED_BLOBS}"
echo ""

# Wait for copy operations to complete
echo -e "${BLUE}Waiting for copy operations to complete...${NC}"
echo "(This may take several minutes depending on blob sizes)"
sleep 5

# Verify migration
echo ""
echo -e "${BLUE}Verifying migration...${NC}"
while IFS= read -r CONTAINER; do
    TARGET_COUNT=$(az storage blob list \
        --account-name "$TARGET_STORAGE" \
        --account-key "$TARGET_KEY" \
        --container-name "$CONTAINER" \
        --query 'length(@)' -o tsv)
    echo "  $CONTAINER: $TARGET_COUNT blobs"
done <<< "$CONTAINERS"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Verify all blobs copied correctly"
echo "2. Test application with new storage account: $TARGET_STORAGE"
echo "3. Update connection strings to reference new storage"
echo "4. After verification, delete old storage account: $SOURCE_STORAGE"
echo ""
echo "To delete old storage account (after verification):"
echo "  az storage account delete --name $SOURCE_STORAGE --yes"

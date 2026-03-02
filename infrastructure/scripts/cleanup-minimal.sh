#!/bin/bash
# Cleanup minimal Azure infrastructure
# Deletes the resource group and all contained resources

set -e

RESOURCE_GROUP="fundrbolt-dev-rg"

echo "⚠️  WARNING: This will DELETE the following resource group and ALL its resources:"
echo "   Resource Group: $RESOURCE_GROUP"
echo ""

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "✅ Resource group $RESOURCE_GROUP does not exist. Nothing to clean up."
    exit 0
fi

echo "📋 Resources that will be deleted:"
az resource list --resource-group "$RESOURCE_GROUP" --query "[].{Name:name, Type:type}" -o table

echo ""
read -p "Are you sure you want to DELETE these resources? (type 'yes' to confirm): " -r
echo

if [[ "$REPLY" != "yes" ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting resource group $RESOURCE_GROUP..."
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo ""
echo "✅ Deletion initiated. Resources will be removed in the background."
echo "   This may take 5-10 minutes to complete."
echo ""
echo "To check deletion status:"
echo "   az group show --name $RESOURCE_GROUP"
echo ""

# Minimal Azure Setup for Local Development

This guide helps you deploy only the essential Azure resources needed for local development, keeping costs under $2/month.

## What Gets Deployed

| Resource | Purpose | Cost |
|----------|---------|------|
| Resource Group | Container for all resources | Free |
| Key Vault | Store secrets (JWT keys, etc.) | ~$0.03 per 10k operations |
| Storage Account | Backups, logs (if needed) | ~$0.10/month for first 5GB |
| Application Insights | Telemetry and monitoring | First 5GB/month free |
| Log Analytics | Log storage | First 5GB/month free |
| **DNS Zone** | Manage fundrbolt.com domain | **$0.50/month + $0.40 per million queries** |

**Total Estimated Cost: ~$1.50/month**

> **Note**: DNS zone is included so you can configure your Namecheap domain nameservers immediately after deployment. The zone will be ready when you deploy production infrastructure later.

## What You'll Use Locally (Free)

- **PostgreSQL**: Docker container (via docker-compose)
- **Redis**: Docker container (via docker-compose)
- **Backend API**: Local FastAPI server
- **Frontend**: Local Vite dev server

## Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   az account show  # Verify you're logged in
   ```

2. **Docker** installed and running:
   ```bash
   docker --version
   docker-compose --version
   ```

3. **Development tools**:
   - Python 3.11+ with Poetry
   - Node.js 22+ with pnpm

## Deployment Steps

### 1. Deploy Minimal Azure Resources

```bash
# From project root
./infrastructure/scripts/deploy-minimal.sh
```

This will:
- Validate the Bicep template
- Show you what will be deployed (including DNS zone for fundrbolt.com)
- Ask for confirmation
- Deploy resources (takes 3-5 minutes)
- **Output Azure nameservers for your domain**

### 2. Configure Nameservers at Namecheap

After deployment completes, you'll see 4 Azure nameservers. Configure them at Namecheap:

1. Login to [Namecheap](https://www.namecheap.com/)
2. Go to **Domain List** → **Manage** (for fundrbolt.com)
3. Find **NAMESERVERS** section
4. Select **Custom DNS**
5. Add all 4 Azure nameservers (e.g., ns1-01.azure-dns.com, ns2-01.azure-dns.net, etc.)
6. **Save** changes

**DNS propagation takes 24-48 hours**. Verify with:
```bash
dig NS fundrbolt.com
# Should show Azure nameservers after propagation
```

### 3. Configure Secrets in Key Vault

Generate and store secrets:

```bash
# Generate JWT secret and store in Key Vault
JWT_SECRET=$(openssl rand -base64 32)
az keyvault secret set \
    --vault-name fundrbolt-dev-kv \
    --name jwt-secret \
    --value "$JWT_SECRET"

# You'll add database and Redis URLs after starting Docker
```

### 4. Start Local Services

Start PostgreSQL and Redis in Docker:

```bash
# Start services
docker-compose up -d

# Verify they're running
docker-compose ps

# Get PostgreSQL connection string
echo "postgresql://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_db"

# Get Redis connection string
echo "redis://localhost:6379"
```

### 4. Store Local Connection Strings in Key Vault

```bash
# Store database URL
az keyvault secret set \
    --vault-name fundrbolt-dev-kv \
    --name database-url \
    --value "postgresql://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_db"

# Store Redis URL
az keyvault secret set \
    --vault-name fundrbolt-dev-kv \
    --name redis-url \
    --value "redis://localhost:6379"
```

### 5. Run Database Migrations

```bash
cd backend
poetry install
poetry run alembic upgrade head
```

### 6. Start Backend Server

```bash
# In one terminal
make dev-backend

# Or manually:
cd backend
poetry run uvicorn app.main:app --reload
```

Backend will be available at: http://localhost:8000

### 7. Start Frontend Server

```bash
# In another terminal
make dev-frontend

# Or manually:
cd frontend/fundrbolt-admin
pnpm install
pnpm dev
```

Frontend will be available at: http://localhost:5173

## Get Application Insights Connection String

To enable telemetry in your local backend:

```bash
# Get connection string
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app fundrbolt-dev-insights \
    --resource-group fundrbolt-dev-rg \
    --query connectionString -o tsv)

# Add to backend/.env file
echo "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING" >> backend/.env
```

## Monitoring Your Costs

Check current month costs:

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# View costs for dev resource group
az costmanagement query \
    --type ActualCost \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/fundrbolt-dev-rg" \
    --timeframe MonthToDate \
    --dataset-aggregation name=PreTaxCost function=Sum

# Expected result: < $1/month
```

## Common Operations

### View Resources

```bash
# List all resources in dev resource group
az resource list \
    --resource-group fundrbolt-dev-rg \
    --output table
```

### Access Key Vault Secrets

```bash
# List secrets
az keyvault secret list \
    --vault-name fundrbolt-dev-kv \
    --output table

# Get a secret value
az keyvault secret show \
    --vault-name fundrbolt-dev-kv \
    --name jwt-secret \
    --query value -o tsv
```

### View Application Insights Data

```bash
# View recent requests
az monitor app-insights query \
    --app fundrbolt-dev-insights \
    --resource-group fundrbolt-dev-rg \
    --analytics-query "requests | where timestamp > ago(1h) | top 10 by timestamp desc"

# View recent exceptions
az monitor app-insights query \
    --app fundrbolt-dev-insights \
    --resource-group fundrbolt-dev-rg \
    --analytics-query "exceptions | where timestamp > ago(1h) | top 10 by timestamp desc"
```

### Stop Local Services

```bash
# Stop Docker services (keeps data)
docker-compose stop

# Stop and remove containers (removes data)
docker-compose down

# Stop and remove containers + volumes (complete cleanup)
docker-compose down -v
```

## Cleanup Azure Resources

If you want to delete all Azure resources (you can always redeploy later):

```bash
./infrastructure/scripts/cleanup-minimal.sh
```

This will:
- Show you what will be deleted
- Ask for confirmation (type 'yes')
- Delete the resource group and all resources

## Cost Optimization Tips

**Expected Monthly Costs**:
- Key Vault: ~$0.03 (at low operation volume)
- Storage Account: ~$0.10 (first 5GB)
- DNS Zone: $0.50/month + ~$0.01 for queries
- Application Insights: Free (under 5GB/month)
- Log Analytics: Free (under 5GB/month)
- **Total: ~$1.50/month**

1. **Use Application Insights Sampling**:
   - Already configured to 100% for dev (it's free up to 5GB)
   - Reduces ingestion if you exceed free tier

2. **Clean Up Old Logs**:
   ```bash
   # Storage retention is set to 30 days for dev
   # Old logs automatically deleted
   ```

3. **Monitor Daily**:
   ```bash
   # Add this to your .bashrc or .zshrc
   alias azure-costs='az costmanagement query --type ActualCost --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/fundrbolt-dev-rg" --timeframe MonthToDate'
   ```

4. **Delete When Not Needed**:
   - If you're not using the project for a while, run the cleanup script
   - You can redeploy in 2-3 minutes when needed

## Troubleshooting

### "Key Vault not found" Error

Make sure you're logged in and have access:

```bash
az login
az keyvault show --name fundrbolt-dev-kv --resource-group fundrbolt-dev-rg
```

If you get permission errors, you may need to add yourself:

```bash
# Get your user object ID
USER_ID=$(az ad signed-in-user show --query id -o tsv)

# Grant yourself Key Vault Secrets Officer role
az role assignment create \
    --assignee $USER_ID \
    --role "Key Vault Secrets Officer" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/fundrbolt-dev-rg/providers/Microsoft.KeyVault/vaults/fundrbolt-dev-kv"
```

### Database Connection Errors

Verify Docker is running:

```bash
docker-compose ps
docker-compose logs postgres
```

### Backend Can't Connect to Database

Make sure the database URL in Key Vault points to localhost:

```bash
az keyvault secret show \
    --vault-name fundrbolt-dev-kv \
    --name database-url \
    --query value -o tsv
```

Should be: `postgresql://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_db`

## Next Steps

Once you're ready to deploy staging or production:

1. Review the full deployment guide: [Infrastructure README](../README.md)
2. Deploy full infrastructure: `make deploy-infra ENV=staging TAG=v1.0.0`
3. Configure CI/CD: [CI/CD Guide](../../docs/operations/ci-cd-guide.md)

## Related Documentation

- [Quick Reference Guide](../../docs/operations/quick-reference.md)
- [Cost Optimization](../../docs/operations/cost-optimization.md)
- [Architecture Overview](../../docs/operations/architecture.md)

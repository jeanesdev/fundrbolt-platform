# Azure Dashboards & Workbooks

Exportable dashboard and workbook definitions for Azure Portal visualization.

## Available Dashboards

### 1. System Health Dashboard

**File**: `system-health-dashboard.json`

**Purpose**: Real-time application performance monitoring

**Metrics**:

- Request rate (requests/minute)
- Response time percentiles (avg, P50, P95, P99)
- Error rate percentage
- Availability uptime
- Top endpoints by request count
- Slowest endpoints by P95 latency
- Failed requests by HTTP status code
- Database response time
- Redis cache hit rate
- Active user count

**Time Range**: Last hour (configurable)

**Refresh**: Auto-refresh every 30 seconds

### 2. Infrastructure Health Workbook

**File**: `infrastructure-workbook.json`

**Purpose**: Comprehensive infrastructure resource monitoring

**Sections**:

1. **App Service Health**
   - CPU percentage (warning: 70%, critical: 80%)
   - Memory percentage (warning: 70%, critical: 80%)
   - HTTP 5xx errors
   - Response time

2. **PostgreSQL Database Health**
   - Active connections
   - CPU percent (warning: 70%, critical: 80%)
   - Memory percent (warning: 70%, critical: 80%)
   - Storage used
   - Failed connections

3. **Redis Cache Health**
   - Cache hits vs misses (hit rate percentage)
   - Server load (warning: 70%, critical: 80%)
   - Used memory
   - Connected clients
   - Evicted keys

4. **Storage Account**
   - Blob transactions
   - Used capacity
   - Availability percentage

**Time Range**: Last 24 hours (configurable)

## Import Instructions

### Import Dashboard to Azure Portal

1. **Navigate to Azure Portal**:
   - Go to [portal.azure.com](https://portal.azure.com)
   - Click "Dashboard" in the left menu
   - Click "+ New dashboard" > "Upload"

2. **Upload JSON**:
   - Select `system-health-dashboard.json`
   - Update resource IDs to match your environment
   - Save dashboard

3. **Pin to Home**:
   - Click "Share" to make available to team
   - Pin dashboard to Azure Portal home

### Import Workbook to Application Insights

1. **Navigate to Application Insights**:
   - Go to your Application Insights resource
   - Click "Workbooks" in the left menu
   - Click "+ New" > "Advanced Editor"

2. **Paste JSON**:
   - Copy contents of `infrastructure-workbook.json`
   - Paste into gallery template editor
   - Click "Apply"

3. **Configure Parameters**:
   - Update resource group name
   - Select time range
   - Save workbook

### Programmatic Import (Azure CLI)

```bash
# Import dashboard
az portal dashboard create \
    --name "fundrbolt-system-health" \
    --resource-group "fundrbolt-production-rg" \
    --input-path "./system-health-dashboard.json" \
    --location "eastus"

# Import workbook
az workbook create \
    --name "fundrbolt-infrastructure-health" \
    --resource-group "fundrbolt-production-rg" \
    --location "eastus" \
    --category "workbook" \
    --template-data @infrastructure-workbook.json
```

## Customization

### Update Resource IDs

Replace placeholders in JSON files with your actual resource IDs:

```bash
# Get Application Insights resource ID
az monitor app-insights component show \
    --app "fundrbolt-production-ai" \
    --resource-group "fundrbolt-production-rg" \
    --query "id" -o tsv

# Get Log Analytics workspace ID
az monitor log-analytics workspace show \
    --workspace-name "fundrbolt-production-logs" \
    --resource-group "fundrbolt-production-rg" \
    --query "id" -o tsv
```

### Modify Queries

KQL queries can be customized in the JSON files:

1. Test query in Application Insights > Logs
2. Copy validated query
3. Update JSON file with new query
4. Re-import dashboard/workbook

### Adjust Thresholds

Warning and critical thresholds are defined in the workbook JSON:

```json
"threshold": {
  "warning": 70,
  "critical": 80
}
```

Modify values based on your performance requirements.

## Best Practices

1. **Dashboard Organization**:
   - Create separate dashboards for different audiences (dev, ops, management)
   - Use consistent time ranges across related metrics
   - Group related metrics together

2. **Workbook Design**:
   - Start with overview metrics, drill down to details
   - Include baselines for comparison
   - Add annotations for deployments and incidents

3. **Query Optimization**:
   - Use time filters to limit data scope
   - Aggregate before projecting fields
   - Cache frequently accessed queries

4. **Maintenance**:
   - Review dashboards monthly
   - Remove unused metrics
   - Update queries when schema changes
   - Version control dashboard JSON files

## Exporting Dashboards

### Export from Azure Portal

1. **Dashboard**:
   - Open dashboard
   - Click "..." menu > "Download"
   - Save JSON file

2. **Workbook**:
   - Open workbook
   - Click "Advanced Editor" button
   - Copy JSON content
   - Save to file

### Automate Export

```bash
# Export dashboard
az portal dashboard show \
    --name "fundrbolt-system-health" \
    --resource-group "fundrbolt-production-rg" \
    > system-health-dashboard.json

# Export workbook
az workbook show \
    --name "fundrbolt-infrastructure-health" \
    --resource-group "fundrbolt-production-rg" \
    > infrastructure-workbook.json
```

## Related Documentation

- [Monitoring Guide](../monitoring-guide.md)
- [Application Insights KQL Reference](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [Azure Monitor Workbooks](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview)

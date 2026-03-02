# Cost Optimization Guide

Comprehensive guide for optimizing Azure costs for the Fundrbolt Platform.

## Table of Contents

1. [Overview](#overview)
2. [Cost Budgets & Alerts](#cost-budgets--alerts)
3. [Auto-scaling Configuration](#auto-scaling-configuration)
4. [Resource Tagging](#resource-tagging)
5. [Right-sizing Resources](#right-sizing-resources)
6. [Reserved Instances](#reserved-instances)
7. [Cost Analysis Queries](#cost-analysis-queries)
8. [Optimization Strategies](#optimization-strategies)
9. [Cost Monitoring](#cost-monitoring)

## Overview

The Fundrbolt Platform is designed with cost optimization in mind, implementing multiple strategies to minimize Azure spending while maintaining performance and reliability.

### Monthly Budget Targets

| Environment | Monthly Budget | Alert Threshold (80%) | Critical Threshold (100%) |
|-------------|----------------|----------------------|---------------------------|
| Development | $100           | $80                  | $100                      |
| Staging     | $300           | $240                 | $300                      |
| Production  | $1,000         | $800                 | $1,000                    |

### Cost Breakdown Estimate

**Production Environment (Monthly)**:
- App Service Plan (Standard S1): ~$73
- PostgreSQL (GeneralPurpose D2s_v3): ~$200
- Redis Cache (Standard C1): ~$75
- Azure Storage (with redundancy): ~$50
- Application Insights (5GB/day cap): ~$200
- Static Web Apps: ~$9
- Key Vault: ~$3
- DNS & Email Services: ~$40
- **Total**: ~$650/month (35% under budget)

## Cost Budgets & Alerts

### Budget Configuration

Budgets are automatically deployed via Bicep templates with three alert types:

1. **80% Warning Alert**: Actual spending reaches 80% of monthly budget
2. **100% Critical Alert**: Actual spending reaches 100% of monthly budget
3. **90% Forecasted Alert**: Projected spending forecasted to exceed 90%

### Alert Recipients

- **Dev**: devops@fundrbolt.com
- **Staging**: ops@fundrbolt.com, devops@fundrbolt.com
- **Production**: ops@fundrbolt.com, engineering@fundrbolt.com

### Managing Budgets

```bash
# View current budget status
az consumption budget list \
    --resource-group fundrbolt-production-rg

# Update budget amount
az deployment sub create \
    --template-file infrastructure/bicep/main.bicep \
    --parameters infrastructure/bicep/parameters/production.bicepparam \
    --parameters monthlyBudget=1200
```

## Auto-scaling Configuration

Auto-scaling reduces costs by dynamically adjusting capacity based on demand.

### Scaling Rules

**Scale Out** (Increase Instances):
- Trigger: Average CPU > 70% for 5 minutes
- Action: Add 1 instance
- Cooldown: 5 minutes

**Scale In** (Decrease Instances):
- Trigger: Average CPU < 30% for 10 minutes
- Action: Remove 1 instance
- Cooldown: 10 minutes

### Capacity Limits

| Environment | Min Instances | Max Instances | Auto-scaling Enabled |
|-------------|---------------|---------------|----------------------|
| Development | 1             | 2             | No                   |
| Staging     | 1             | 5             | Yes                  |
| Production  | 2             | 10            | Yes                  |

### Cost Impact

Auto-scaling saves approximately **30-50%** on compute costs during off-peak hours:
- Peak hours (9 AM - 6 PM): 4-6 instances
- Off-peak hours (6 PM - 9 AM): 2-3 instances
- Weekends: 2 instances

**Monthly Savings**: ~$150-200 in production

### Manual Scaling

```bash
# Check current instance count
az appservice plan show \
    --name fundrbolt-production-asp \
    --resource-group fundrbolt-production-rg \
    --query "sku.capacity"

# Manually scale (overrides auto-scale temporarily)
az appservice plan update \
    --name fundrbolt-production-asp \
    --resource-group fundrbolt-production-rg \
    --number-of-workers 4
```

## Resource Tagging

Tags enable cost tracking and allocation across teams and projects.

### Standard Tags

All resources are tagged with:
- **Environment**: dev, staging, production
- **Project**: fundrbolt-platform
- **Owner**: Team responsible (devops-team, platform-team)
- **CostCenter**: Cost allocation (engineering, operations)
- **ManagedBy**: Bicep (infrastructure as code)

### Cost Allocation by Tag

```bash
# View costs by environment
az costmanagement query \
    --type Usage \
    --dataset-aggregation name=PreTaxCost function=Sum \
    --dataset-grouping name=ResourceGroup type=Dimension

# Export cost report with tags
az costmanagement export create \
    --name monthly-cost-by-tag \
    --scope /subscriptions/{subscription-id} \
    --schedule-recurrence Daily \
    --schedule-status Active
```

## Right-sizing Resources

### Current SKU Selections

#### App Service Plan
- **Dev**: Basic B1 (1 core, 1.75 GB) - $13/month
- **Staging**: Standard S1 (1 core, 1.75 GB) - $73/month
- **Production**: Standard S1 (1 core, 1.75 GB) × 2-10 instances

#### PostgreSQL Database
- **Dev**: Burstable B1ms (1 vCore, 2 GB) - $15/month
- **Staging**: GeneralPurpose D2s_v3 (2 vCore, 8 GB) - $100/month
- **Production**: GeneralPurpose D2s_v3 (2 vCore, 8 GB) - $200/month (with HA)

#### Redis Cache
- **Dev**: Basic C0 (250 MB) - $16/month
- **Staging**: Standard C1 (1 GB) - $75/month
- **Production**: Standard C1 (1 GB) - $75/month

### Optimization Recommendations

1. **Monitor Actual Usage**:
   - Check CPU/memory utilization weekly
   - Scale down if consistently below 40% utilization
   - Scale up if consistently above 80% utilization

2. **Consider Burstable Tiers**:
   - PostgreSQL Burstable tier for dev/staging saves 70%
   - Only use GeneralPurpose for production

3. **Redis Cache Sizing**:
   - Monitor memory usage and hit rate
   - Eviction rate > 10% indicates undersized cache
   - Hit rate < 80% may indicate over-caching

## Reserved Instances

Reserved instances offer 30-72% savings for predictable workloads.

### Recommended Reservations

**Production Environment** (1-year reserved):
- App Service Plan (S1): Save ~$26/month (35% off)
- PostgreSQL (D2s_v3): Save ~$70/month (35% off)
- Redis Cache (C1): Save ~$26/month (35% off)

**Total Annual Savings**: ~$1,464 (or $122/month)

### Purchasing Reserved Instances

```bash
# View available reservations
az reservations catalog show \
    --subscription-id {subscription-id} \
    --reserved-resource-type VirtualMachines \
    --location eastus

# Purchase reservation (requires billing admin)
az reservations reservation-order purchase \
    --reservation-order-id {order-id} \
    --sku Standard_D2s_v3 \
    --quantity 1 \
    --term P1Y \
    --billing-scope {subscription-id}
```

### Reservation Management

- Review utilization monthly via Azure Portal > Reservations
- Exchange underutilized reservations (within 30 days)
- Enable auto-renewal for continuously used resources

## Cost Analysis Queries

### KQL Queries for Cost Tracking

#### Daily Cost Trend

```kusto
AzureDiagnostics
| where TimeGenerated >= ago(30d)
| where Category == "Billing"
| summarize Cost = sum(todouble(Cost_s)) by bin(TimeGenerated, 1d)
| render timechart
```

#### Cost by Resource Type

```kusto
AzureDiagnostics
| where Category == "Billing"
| summarize TotalCost = sum(todouble(Cost_s)) by ResourceType = tostring(ResourceType_s)
| order by TotalCost desc
| render piechart
```

#### Top 10 Most Expensive Resources

```kusto
AzureDiagnostics
| where Category == "Billing"
| summarize Cost = sum(todouble(Cost_s)) by Resource = tostring(Resource_s)
| top 10 by Cost desc
```

### Azure CLI Cost Queries

```bash
# Current month costs
az costmanagement query \
    --type ActualCost \
    --scope /subscriptions/{subscription-id}/resourceGroups/fundrbolt-production-rg \
    --timeframe MonthToDate \
    --dataset-aggregation name=PreTaxCost function=Sum

# Forecasted costs
az costmanagement query \
    --type Usage \
    --scope /subscriptions/{subscription-id} \
    --timeframe MonthToDate \
    --dataset-granularity Daily \
    --forecast
```

## Optimization Strategies

### 1. Application Insights Sampling

**Current Configuration**:
- Production: 10% sampling (reduces ingestion by 90%)
- Staging: 100% sampling (full telemetry)
- Dev: 100% sampling

**Daily Ingestion Caps**:
- Production: 5 GB/day (~$200/month)
- Staging: 1 GB/day (~$40/month)
- Dev: No cap

**Optimization**:
- Enable adaptive sampling for production (automatically adjusts 5-100%)
- Set alerts when approaching daily cap
- Export to Log Analytics for long-term storage (cheaper)

### 2. Storage Lifecycle Management

**Blob Storage Tiers**:
- Hot: Frequent access (logs, active backups)
- Cool: Infrequent access (30-90 days) - 50% cheaper
- Archive: Rarely accessed (>90 days) - 95% cheaper

**Lifecycle Policy**:
```bicep
// Automatically implemented in storage.bicep
- Move to Cool tier after 30 days
- Move to Archive tier after 90 days
- Delete after 365 days (production) or 90 days (dev/staging)
```

**Monthly Savings**: ~$20-30

### 3. Database Optimization

**Query Performance**:
- Enable slow query log and optimize queries >1s
- Add indexes for frequently queried columns
- Use connection pooling (reduces connection overhead)

**Backup Optimization**:
- Dev: 7-day retention (vs 30-day) saves $10/month
- Use geo-redundant backup only in production

**Storage Optimization**:
- Monitor database size monthly
- Archive old data to Blob Storage (95% cheaper)
- Vacuum and analyze regularly to reclaim space

### 4. Redis Cache Optimization

**Eviction Policy**:
- `allkeys-lru`: Evict least recently used keys
- Monitor eviction rate (should be <5%)

**Connection Pooling**:
- Reuse Redis connections (reduces connection overhead)
- Set connection timeout to 5 seconds

**Data Structure**:
- Use Redis hashes for grouped data (more memory efficient)
- Set TTL on all cache keys (prevents memory bloat)

### 5. Network Egress Optimization

**Data Transfer Costs**:
- Within same region: Free
- Cross-region: $0.02/GB
- To internet: $0.05-0.087/GB (first 5GB free)

**Optimization**:
- Keep all resources in same region (eastus)
- Use Azure CDN for static assets (reduces egress)
- Compress API responses (reduces bandwidth 70%)

## Cost Monitoring

### Daily Monitoring Tasks

1. **Check Budget Status**: Azure Portal > Cost Management
2. **Review Alert Emails**: Check for budget alerts
3. **Monitor Resource Utilization**: CPU/memory metrics in Application Insights

### Weekly Monitoring Tasks

1. **Cost Analysis**: Review week-over-week cost trends
2. **Resource Right-sizing**: Check for over/under-provisioned resources
3. **Auto-scaling Metrics**: Verify scaling working correctly

### Monthly Monitoring Tasks

1. **Budget Reconciliation**: Compare actual vs budget
2. **Reserved Instance Review**: Check utilization and adjust
3. **Cost Allocation**: Review costs by team/project
4. **Optimization Opportunities**: Identify new ways to reduce costs

### Cost Monitoring Dashboard

Create custom dashboard in Azure Portal:
1. Go to Azure Portal > Dashboard
2. Add tiles:
   - Current month spend
   - Budget vs actual
   - Cost by resource type
   - Cost trend (30 days)
   - Top 5 expensive resources
3. Share with team for visibility

### Alerting on Cost Anomalies

```bash
# Create cost anomaly alert
az monitor metrics alert create \
    --name high-cost-anomaly \
    --resource-group fundrbolt-production-rg \
    --scopes /subscriptions/{subscription-id} \
    --condition "total Cost > 50" \
    --description "Alert when daily cost exceeds $50" \
    --evaluation-frequency 1d \
    --window-size 1d \
    --severity 2
```

## Cost Optimization Checklist

### Infrastructure

- [x] Budget alerts configured (80%, 100%, 90% forecasted)
- [x] Auto-scaling enabled (staging, production)
- [x] Resource tagging (Environment, Project, Owner, CostCenter)
- [x] Right-sized SKUs for each environment
- [ ] Reserved instances purchased for production (recommended after 3 months)
- [x] Storage lifecycle policies configured

### Application

- [x] Application Insights sampling (10% production)
- [x] Daily ingestion caps (5GB production, 1GB staging)
- [x] Connection pooling (database, Redis)
- [x] Response compression enabled
- [x] Redis eviction policy configured

### Monitoring

- [x] Budget alerts configured with email notifications
- [x] Cost dashboards created
- [ ] Weekly cost review scheduled
- [ ] Monthly cost reconciliation process
- [ ] Reserved instance utilization monitoring

## Related Documentation

- [Monitoring Guide](./monitoring-guide.md) - Application Insights configuration
- [Disaster Recovery](./disaster-recovery.md) - Backup retention and costs
- [Architecture](./architecture.md) - Resource architecture and dependencies

# Monitoring Guide

Comprehensive guide for monitoring the Fundrbolt platform using Azure Application Insights and Log Analytics.

## Overview

The Fundrbolt platform uses Azure Application Insights for application performance monitoring (APM) and Azure Log Analytics for centralized log aggregation. This provides:

- **Real-time metrics**: Request rate, response time, error rate, dependencies
- **Distributed tracing**: End-to-end request tracing across services
- **Custom dashboards**: System health, infrastructure, deployments, costs
- **Automated alerting**: Proactive notifications for critical issues
- **Log querying**: KQL (Kusto Query Language) for advanced analysis

## Configuration

### Application Insights

**Sampling Rates** (controls data ingestion volume):

- Development: 100% (full telemetry)
- Staging: 100% (full telemetry for testing)
- Production: 10% (statistical sampling to reduce costs)

**Daily Ingestion Caps**:

- Development: No cap (unlimited for testing)
- Staging: 1 GB/day
- Production: 5 GB/day

### Availability Tests

**Backend Health Endpoint** (`/health`):

- Frequency: 5 minutes
- Timeout: 30 seconds
- Test locations: East US, West US, North Europe
- Expected status: 200 OK
- Alert threshold: 2 consecutive failures from any location

**Frontend Homepage**:

- Frequency: 5 minutes
- Timeout: 30 seconds
- Test locations: East US, West US, North Europe
- Expected status: 200 OK
- Alert threshold: 2 consecutive failures from any location

## Alert Rules

### Critical Alerts (Severity 1)

#### High Error Rate

**Condition**: Error rate > 5% for 5 consecutive minutes

**Query**:

```kql
requests
| where success == false
| summarize errorCount = count() by bin(timestamp, 1m)
| extend totalRequests = toscalar(requests | summarize count() by bin(timestamp, 1m) | summarize sum(count_))
| extend errorRate = (errorCount * 100.0) / totalRequests
| where errorRate > 5
```

**Response Procedure**:

1. Check Application Insights for error details
2. Review recent deployments (potential bad release)
3. Check external dependencies (database, Redis, APIs)
4. Consider rollback if error rate continues to climb
5. Create incident ticket and notify team

#### High Latency (P95 > 500ms)

**Condition**: 95th percentile latency > 500ms for 5 consecutive minutes

**Query**:

```kql
requests
| summarize p95 = percentile(duration, 95) by bin(timestamp, 1m)
| where p95 > 500
```

**Response Procedure**:

1. Identify slow endpoints in Application Insights
2. Check database query performance
3. Review Redis cache hit rate
4. Investigate external API dependencies
5. Consider scaling up if resource-constrained

#### Backend Availability Failure

**Condition**: Backend health endpoint fails from 2+ test locations

**Response Procedure**:

1. Verify App Service is running: `az webapp show --name fundrbolt-production-api --resource-group fundrbolt-production-rg --query state`
2. Check App Service logs for errors
3. Verify database connectivity
4. Check Redis connectivity
5. Restart App Service if needed: `az webapp restart --name fundrbolt-production-api --resource-group fundrbolt-production-rg`

#### Frontend Availability Failure

**Condition**: Frontend homepage fails from 2+ test locations

**Response Procedure**:

1. Verify Static Web App is running
2. Check CDN status
3. Review deployment logs
4. Test manual browser access
5. Redeploy if needed

## Dashboards

### System Health Dashboard

Access: Azure Portal > Application Insights > Dashboards

**Key Metrics**:

- **Request Rate**: Requests per minute (live stream)
- **Response Time**: Average, P50, P95, P99 latencies
- **Error Rate**: Percentage of failed requests
- **Availability**: Uptime percentage from availability tests
- **Dependency Health**: Database, Redis, external API response times

**Sample KQL Queries**:

```kql
// Request rate by endpoint
requests
| summarize count() by name, bin(timestamp, 5m)
| render timechart

// Response time percentiles
requests
| summarize
    avg = avg(duration),
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99)
    by bin(timestamp, 5m)
| render timechart

// Error rate trend
requests
| summarize
    total = count(),
    failed = countif(success == false)
    by bin(timestamp, 5m)
| extend errorRate = (failed * 100.0) / total
| render timechart
```

### Infrastructure Health Workbook

**CPU Usage**:

```kql
// App Service CPU percentage
AzureMetrics
| where ResourceProvider == "MICROSOFT.WEB"
| where MetricName == "CpuPercentage"
| summarize avg(Average) by bin(TimeGenerated, 5m)
| render timechart
```

**Memory Usage**:

```kql
// App Service memory percentage
AzureMetrics
| where ResourceProvider == "MICROSOFT.WEB"
| where MetricName == "MemoryPercentage"
| summarize avg(Average) by bin(TimeGenerated, 5m)
| render timechart
```

**Database Connections**:

```kql
// PostgreSQL active connections
AzureMetrics
| where ResourceProvider == "MICROSOFT.DBFORPOSTGRESQL"
| where MetricName == "active_connections"
| summarize avg(Average), max(Maximum) by bin(TimeGenerated, 5m)
| render timechart
```

**Redis Cache Performance**:

```kql
// Redis cache hit rate
AzureMetrics
| where ResourceProvider == "MICROSOFT.CACHE"
| where MetricName in ("cachehits", "cachemisses")
| summarize hits = sumif(Total, MetricName == "cachehits"),
            misses = sumif(Total, MetricName == "cachemisses")
            by bin(TimeGenerated, 5m)
| extend hitRate = (hits * 100.0) / (hits + misses)
| render timechart
```

### Deployment History Workbook

**Recent Deployments**:

```kql
// Track deployments via custom events
customEvents
| where name == "Deployment"
| project timestamp, deployment_env = tostring(customDimensions.environment),
          version = tostring(customDimensions.version),
          status = tostring(customDimensions.status)
| order by timestamp desc
```

**Deployment Impact Analysis**:

```kql
// Compare error rate before/after deployment
let deploymentTime = datetime(2025-10-27T18:00:00Z);
requests
| extend period = iff(timestamp < deploymentTime, "Before", "After")
| summarize
    total = count(),
    failed = countif(success == false)
    by period
| extend errorRate = (failed * 100.0) / total
```

### Cost Tracking Workbook

**Daily Costs by Service**:

```kql
// Azure consumption data
AzureDiagnostics
| where Category == "Billing"
| summarize cost = sum(todouble(BillingAmount)) by Resource, bin(TimeGenerated, 1d)
| render columnchart
```

**Monthly Cost Trend**:

```kql
// Cost over time
AzureDiagnostics
| where Category == "Billing"
| summarize monthlyCost = sum(todouble(BillingAmount)) by bin(TimeGenerated, 30d)
| render areachart
```

**Cost by Resource Type**:

```kql
// Breakdown by Azure service
AzureDiagnostics
| where Category == "Billing"
| summarize cost = sum(todouble(BillingAmount)) by ResourceProvider
| order by cost desc
```

## Common KQL Queries

### User Activity

```kql
// Active users by hour
customEvents
| where name == "UserLogin"
| summarize users = dcount(tostring(customDimensions.userId)) by bin(timestamp, 1h)
| render timechart
```

### Top Slowest Endpoints

```kql
// Identify performance bottlenecks
requests
| summarize
    count = count(),
    avg_duration = avg(duration),
    p95_duration = percentile(duration, 95)
    by name
| where count > 10
| order by p95_duration desc
| take 10
```

### Failed Requests by Type

```kql
// Error analysis
requests
| where success == false
| summarize count() by resultCode, name
| order by count_ desc
```

### Database Query Performance

```kql
// Slow database queries
dependencies
| where type == "SQL"
| where duration > 1000
| summarize count() by name, avg_duration = avg(duration)
| order by avg_duration desc
```

### External API Failures

```kql
// Third-party service issues
dependencies
| where type == "HTTP"
| where success == false
| summarize failures = count() by target, resultCode
| order by failures desc
```

### Session Duration Analysis

```kql
// User session metrics
customEvents
| where name in ("SessionStart", "SessionEnd")
| summarize arg_min(timestamp, *) by session_id = tostring(customDimensions.sessionId)
| extend duration_minutes = (arg_max(timestamp, *) - arg_min(timestamp, *)) / 1m
| summarize avg_duration = avg(duration_minutes), max_duration = max(duration_minutes)
```

## Alert Response Procedures

### 1. Receive Alert Notification

- Check email for alert details (severity, metric, threshold)
- Note alert timestamp and duration
- Access Azure Portal > Application Insights > Alerts

### 2. Assess Impact

**Quick Health Check**:

```bash
# Backend health
curl -f https://api.fundrbolt.com/health/detailed

# Frontend availability
curl -I https://admin.fundrbolt.com

# Check service status
az webapp show --name fundrbolt-production-api --resource-group fundrbolt-production-rg --query state
```

**Metrics Check**:

- Current error rate vs. threshold
- Affected user count (if available)
- Geographic distribution of failures

### 3. Initial Triage

**High Error Rate**:

1. Recent deployments? Check deployment history
2. External dependencies down? Check status pages
3. Database issues? Check PostgreSQL metrics
4. Rate limiting triggered? Check Redis metrics

**High Latency**:

1. Database slow queries? Check query performance
2. Cache misses? Check Redis hit rate
3. External API timeouts? Check dependency duration
4. Resource exhaustion? Check CPU/memory

**Availability Failure**:

1. Service stopped? Restart if needed
2. Configuration error? Check App Service logs
3. Network issue? Verify connectivity
4. Certificate expired? Check SSL/TLS

### 4. Mitigation Actions

**Immediate**:

- Rollback recent deployment if error rate spiked post-deploy
- Restart affected services
- Scale up resources if under load
- Enable maintenance mode if critical

**Short-term**:

- Apply hotfix if root cause identified
- Adjust rate limits if needed
- Clear problematic cache entries
- Update external API configurations

**Long-term**:

- Create incident post-mortem
- Implement fixes to prevent recurrence
- Update monitoring thresholds if needed
- Improve alerting granularity

### 5. Communication

**During Incident**:

- Notify team via Slack/Teams
- Update status page if user-facing
- Communicate ETA for resolution

**After Resolution**:

- Send all-clear notification
- Document incident timeline
- Schedule post-mortem meeting

## Troubleshooting

### No Telemetry Data

**Check**:

- Application Insights connection string configured
- Instrumentation key valid
- Network connectivity to Azure
- Firewall rules allow telemetry egress

**Solution**:

```bash
# Verify App Service application settings
az webapp config appsettings list \
    --name fundrbolt-production-api \
    --resource-group fundrbolt-production-rg \
    --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].value"
```

### High Ingestion Costs

**Check**:

- Sampling rate (should be 10% for production)
- Daily cap configuration
- Verbose logging disabled in production
- Dependency tracking scope

**Solution**:

```bash
# Check current ingestion volume
az monitor app-insights component show \
    --app fundrbolt-production-ai \
    --resource-group fundrbolt-production-rg \
    --query "properties.{sampling:SamplingPercentage,cap:IngestionMode}"
```

### Alert Not Triggering

**Check**:

- Alert rule enabled
- Evaluation frequency and window size
- Action group configured
- Email address verified

**Solution**:

```bash
# List alert rules
az monitor metrics alert list \
    --resource-group fundrbolt-production-rg

# Check alert rule status
az monitor metrics alert show \
    --name fundrbolt-production-ai-high-error-rate \
    --resource-group fundrbolt-production-rg
```

### Slow Query Performance

**Check**:

- Database indexes
- Query execution plans
- Connection pool exhaustion
- Lock contention

**KQL Query**:

```kql
dependencies
| where type == "SQL"
| where duration > 1000
| project timestamp, name, duration, resultCode, data
| order by timestamp desc
| take 20
```

## Best Practices

### Application Instrumentation

1. **Use structured logging**: JSON format with consistent fields
2. **Include context**: Request ID, user ID, session ID
3. **Track custom metrics**: Business-specific KPIs
4. **Instrument critical paths**: Login, checkout, payment processing
5. **Avoid logging sensitive data**: PII, passwords, tokens

### Alert Configuration

1. **Set appropriate thresholds**: Balance false positives vs. detection time
2. **Use multiple severity levels**: Critical, warning, info
3. **Test alerts regularly**: Verify notification delivery
4. **Document response procedures**: Runbooks for each alert type
5. **Review and adjust**: Tune thresholds based on historical data

### Dashboard Design

1. **Focus on actionable metrics**: What requires immediate action?
2. **Use consistent time ranges**: Last hour, 24 hours, 7 days
3. **Include baselines**: Compare to historical average
4. **Drill-down capability**: Link to detailed queries
5. **Share with team**: Pin to Azure Portal home

### Query Optimization

1. **Use time filters**: Limit query scope to relevant period
2. **Aggregate early**: Summarize before projecting
3. **Cache common queries**: Save frequently used queries
4. **Use sampling**: For large datasets, sample before analysis
5. **Optimize joins**: Minimize cross-workspace queries

## Related Documentation

- [Architecture Overview](architecture.md)
- [Alert Rules (Bicep)](../infrastructure/bicep/modules/monitoring.bicep)
- [Disaster Recovery](disaster-recovery.md)
- [Troubleshooting Guide](troubleshooting.md)

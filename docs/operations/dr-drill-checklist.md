# Disaster Recovery Drill Checklist

Quarterly disaster recovery drill procedures to validate backup and restore capabilities.

## Drill Schedule

Execute DR drills quarterly according to this schedule:

| Quarter | Month | Focus Area | Duration |
|---------|-------|-----------|----------|
| Q1 | January | Database Restore | 2-3 hours |
| Q2 | April | Redis + Application Stack | 3-4 hours |
| Q3 | July | Storage Account + Documentation | 2-3 hours |
| Q4 | October | Full Production DR Simulation | 4-6 hours |

## Pre-Drill Preparation

### 1 Week Before Drill

- [ ] Schedule drill date and time (non-business hours preferred)
- [ ] Notify all stakeholders (engineering, operations, management)
- [ ] Reserve staging environment for testing
- [ ] Review and update DR procedures documentation
- [ ] Verify access to Azure Portal and CLI for all participants
- [ ] Confirm backup retention policies are active
- [ ] Check latest backup timestamps (database, Redis, storage)

### 1 Day Before Drill

- [ ] Send reminder to all participants with drill agenda
- [ ] Verify Azure subscription has sufficient quota for restore resources
- [ ] Prepare communication channels (Slack, Teams, email)
- [ ] Create drill log document for recording observations
- [ ] Test Azure CLI authentication for all participants
- [ ] Verify access to monitoring dashboards (Application Insights)

## Drill Execution Checklist

### Q1: Database Restore Drill (January)

**Objective**: Validate PostgreSQL backup and restore procedures

**Scenario**: Database corruption detected at 10:00 AM, restore to previous day

#### Pre-Drill

- [ ] Document current database state (row counts, latest timestamps)
- [ ] Identify test restore point (24 hours prior)
- [ ] Prepare staging environment for restore testing

#### Execution

- [ ] **Step 1**: Check backup availability (5 min)

```bash
az postgres flexible-server backup list \
    --resource-group "fundrbolt-production-rg" \
    --server-name "fundrbolt-production-db"
```

- [ ] **Step 2**: Initiate point-in-time restore to staging (15 min)

```bash
./infrastructure/scripts/test-disaster-recovery.sh production staging
```

- [ ] **Step 3**: Wait for restore completion (10-15 min)
- [ ] **Step 4**: Verify restored database connectivity (5 min)
- [ ] **Step 5**: Validate data integrity (10 min)
  - [ ] Check table row counts match expected values
  - [ ] Verify recent transactions are present
  - [ ] Test sample queries against restored data
- [ ] **Step 6**: Measure and record restore time
- [ ] **Step 7**: Document any issues or deviations

#### Post-Drill

- [ ] Calculate actual RTO vs. target (60 minutes)
- [ ] Calculate actual RPO vs. target (15 minutes)
- [ ] Clean up test restore resources
- [ ] Update procedures based on findings
- [ ] Generate drill report and share with stakeholders

### Q2: Redis + Application Stack Drill (April)

**Objective**: Validate Redis backup/restore and full application recovery

**Scenario**: Redis cache failure, restore from backup and redeploy application

#### Pre-Drill

- [ ] Export current Redis data to storage account
- [ ] Document current Redis key count and sample keys
- [ ] Prepare staging environment for testing

#### Execution

- [ ] **Step 1**: Export Redis data to blob storage (10 min)

```bash
az redis export \
    --name "fundrbolt-production-cache" \
    --resource-group "fundrbolt-production-rg" \
    --container "backups" \
    --prefix "redis-drill-$(date +%Y%m%d)"
```

- [ ] **Step 2**: Simulate Redis data loss (flush cache)
- [ ] **Step 3**: Import Redis data from backup (15 min)

```bash
az redis import \
    --name "fundrbolt-staging-cache" \
    --resource-group "fundrbolt-staging-rg" \
    --files "backups/redis-drill-*.rdb"
```

- [ ] **Step 4**: Verify Redis key count matches pre-flush count (5 min)
- [ ] **Step 5**: Test session functionality with restored cache
- [ ] **Step 6**: Redeploy application to staging (10 min)
- [ ] **Step 7**: Verify application health and functionality (10 min)
- [ ] **Step 8**: Measure and record recovery time

#### Post-Drill

- [ ] Calculate actual RTO vs. target (45 minutes)
- [ ] Test application performance with restored cache
- [ ] Document any cache warming requirements
- [ ] Update Redis backup procedures if needed
- [ ] Generate drill report

### Q3: Storage Account + Documentation Drill (July)

**Objective**: Validate blob versioning, soft delete, and documentation accuracy

**Scenario**: Accidental blob deletion, restore from soft delete and versions

#### Pre-Drill

- [ ] Upload test blobs to storage account
- [ ] Create multiple versions of test blobs
- [ ] Review and update all DR documentation

#### Execution

- [ ] **Step 1**: Soft delete test scenario (5 min)
  - [ ] Delete test blob
  - [ ] List deleted blobs
  - [ ] Undelete blob
  - [ ] Verify blob contents intact

- [ ] **Step 2**: Blob version restore scenario (5 min)
  - [ ] Modify test blob (create new version)
  - [ ] List blob versions
  - [ ] Restore previous version
  - [ ] Verify previous content restored

- [ ] **Step 3**: Documentation review (60 min)
  - [ ] Review disaster-recovery.md for accuracy
  - [ ] Test each code snippet in documentation
  - [ ] Verify all commands execute successfully
  - [ ] Update outdated information or screenshots

- [ ] **Step 4**: Lifecycle policy verification (10 min)
  - [ ] Check lifecycle rules are active
  - [ ] Verify archive and deletion timelines
  - [ ] Test manual blob archival

#### Post-Drill

- [ ] Calculate blob restore time (target: 5 minutes)
- [ ] Update documentation with findings
- [ ] Create issues for any doc inaccuracies
- [ ] Generate drill report

### Q4: Full Production DR Simulation (October)

**Objective**: Validate complete disaster recovery with multi-component failure

**Scenario**: Regional Azure outage, full environment recovery to paired region

#### Pre-Drill

- [ ] Schedule extended maintenance window (4-6 hours)
- [ ] Notify all users of planned drill
- [ ] Prepare failover region (westus2)
- [ ] Document complete production state

#### Execution

- [ ] **Step 1**: Assess simulated outage scope (10 min)
  - [ ] Check Azure status dashboard
  - [ ] Identify affected services
  - [ ] Estimate recovery strategy

- [ ] **Step 2**: Geo-restore database to paired region (30 min)

```bash
az postgres flexible-server geo-restore \
    --resource-group "fundrbolt-production-rg-dr" \
    --name "fundrbolt-production-db-dr" \
    --source-server "<source-server-id>" \
    --location "westus2"
```

- [ ] **Step 3**: Deploy infrastructure to failover region (20 min)

```bash
./infrastructure/scripts/provision.sh production-dr westus2
```

- [ ] **Step 4**: Deploy application stack (30 min)
  - [ ] Deploy backend container
  - [ ] Deploy frontend to Static Web Apps
  - [ ] Configure secrets and environment variables

- [ ] **Step 5**: Import Redis data (if needed) (15 min)
- [ ] **Step 6**: Update DNS records to failover region (15 min)

```bash
az network dns record-set a update \
    --resource-group "fundrbolt-production-rg" \
    --zone-name "fundrbolt.com" \
    --name "api" \
    --set aRecords[0].ipv4Address="<new-ip>"
```

- [ ] **Step 7**: Verify DNS propagation (10 min)

```bash
nslookup api.fundrbolt.com
curl https://api.fundrbolt.com/health
```

- [ ] **Step 8**: Test complete application functionality (30 min)
  - [ ] User login
  - [ ] NPO creation
  - [ ] Session persistence
  - [ ] Database queries
  - [ ] Email sending

- [ ] **Step 9**: Measure total recovery time
- [ ] **Step 10**: Document all issues and observations

#### Post-Drill

- [ ] Calculate actual RTO vs. target (4 hours)
- [ ] Calculate actual RPO vs. target (15 minutes)
- [ ] Clean up failover resources
- [ ] Restore DNS to primary region
- [ ] Generate comprehensive drill report
- [ ] Present findings to leadership
- [ ] Update DR procedures based on lessons learned

## Metrics & Reporting

### Key Metrics to Capture

For each drill, record these metrics:

- **Restore Time**: Actual time to restore service
- **Data Loss**: Amount of data lost (if any)
- **RTO Achievement**: Did we meet the 1-hour target?
- **RPO Achievement**: Was data loss within 15-minute window?
- **Issues Encountered**: List all problems and resolutions
- **Team Coordination**: Communication effectiveness rating (1-5)

### Drill Report Template

```markdown
# DR Drill Report - Q[X] [Year]

**Date**: [Date]
**Drill Type**: [Database/Redis/Storage/Full]
**Duration**: [Actual time]
**Participants**: [Names]

## Executive Summary
[Brief overview of drill success/failure]

## Metrics
- RTO Target: 60 minutes
- Actual RTO: [X] minutes
- RPO Target: 15 minutes
- Actual RPO: [X] minutes
- Data Loss: [None/Description]

## What Went Well
- [Success 1]
- [Success 2]

## Issues Encountered
1. [Issue description]
   - Impact: [High/Medium/Low]
   - Resolution: [How it was fixed]
   - Prevention: [How to avoid in future]

## Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Procedure Updates
- [List any doc updates needed]

## Recommendations
- [Improvement 1]
- [Improvement 2]

## Conclusion
[Overall assessment and confidence level]
```

## Continuous Improvement

### After Each Drill

1. **Immediate Actions** (within 24 hours)
   - Share drill report with all participants
   - Document lessons learned in knowledge base
   - Create GitHub issues for procedure updates

2. **Short-term Actions** (within 1 week)
   - Update DR procedures documentation
   - Fix any identified automation issues
   - Improve monitoring and alerting based on findings

3. **Long-term Actions** (before next drill)
   - Implement automation for manual steps
   - Enhance backup strategies if needed
   - Conduct additional training if gaps identified

### Success Criteria

A drill is considered successful if:

- [ ] All planned scenarios were executed
- [ ] RTO achieved within target (60 minutes)
- [ ] RPO achieved within target (15 minutes)
- [ ] No data loss occurred (or within acceptable limits)
- [ ] All participants understood their roles
- [ ] Documentation was accurate and complete
- [ ] Issues were documented and assigned owners
- [ ] Stakeholders were kept informed throughout

## Related Documentation

- [Disaster Recovery Procedures](disaster-recovery.md)
- [Backup Configuration](../infrastructure/bicep/modules/database.bicep)
- [DR Test Script](../infrastructure/scripts/test-disaster-recovery.sh)
- [Rollback Procedures](rollback-procedures.md)

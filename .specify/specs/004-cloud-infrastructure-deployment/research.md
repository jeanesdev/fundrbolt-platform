# Research: Cloud Infrastructure & Deployment

**Feature**: Cloud Infrastructure & Deployment
**Date**: 2025-10-27
**Phase**: 0 - Research & Technology Selection

## Research Questions

### Q1: Infrastructure as Code - Bicep vs Terraform?

**Decision**: Azure Bicep

**Rationale**:
- **Native Azure integration**: Bicep is Microsoft's first-party IaC language with same-day support for new Azure features
- **Simpler syntax**: Bicep provides cleaner, more concise templates compared to Terraform's HCL for Azure resources
- **No state management**: Bicep uses Azure Resource Manager's native state tracking, eliminating need for separate state file storage/locking
- **Type safety**: Strong typing with IntelliSense support in VS Code via official extension
- **Learning curve**: Easier for Azure-focused projects; team already familiar with Azure portal/CLI concepts
- **Deployment speed**: Direct ARM template compilation often faster than Terraform's plan/apply cycle

**Alternatives Considered**:
- **Terraform**: Multi-cloud portability, mature ecosystem, extensive community modules
  - Rejected because: Project is Azure-only (no multi-cloud requirement), state management adds operational complexity, slightly more verbose for Azure resources
- **Azure CLI scripts**: Simple imperative approach with `az` commands
  - Rejected because: Not declarative (hard to track drift), difficult to maintain for complex infrastructure, no preview/what-if capability
- **ARM Templates (JSON)**: Native Azure IaC before Bicep
  - Rejected because: Verbose JSON syntax, Bicep is ARM's successor with better DX

**Implementation Notes**:
- Use Bicep modules for reusable resource definitions (database, app service, etc.)
- Separate parameter files per environment (dev/staging/production)
- Leverage Bicep's `@secure()` decorator for sensitive parameters
- Use `what-if` deployments in CI/CD to preview changes before applying

---

### Q2: Container Hosting - App Service vs Container Apps vs AKS?

**Decision**: Azure App Service (Linux containers)

**Rationale**:
- **Simplicity**: Fully managed PaaS with built-in CI/CD, auto-scaling, deployment slots, zero infrastructure management
- **Cost-effective**: Standard S1 tier ($70/month) sufficient for MVP; no cluster overhead like AKS
- **Fast deployment**: Docker container deployment via GitHub Actions in minutes
- **Built-in features**: Custom domains, SSL certificates, logging, monitoring all included
- **Aligns with constitution**: "Solo Developer Efficiency" - managed services over operational complexity

**Alternatives Considered**:
- **Azure Container Apps**: Serverless container platform with KEDA-based scaling
  - Rejected because: Overkill for current scale, less mature than App Service, higher complexity for database connection management
- **Azure Kubernetes Service (AKS)**: Full Kubernetes cluster for microservices
  - Rejected because: Constitution says "modular monolith" not microservices, massive operational overhead (cluster management, networking, security), minimum $200/month just for control plane
- **Azure Container Instances**: Simple container execution without orchestration
  - Rejected because: No auto-scaling, no deployment slots, requires custom load balancing, not production-grade

**Implementation Notes**:
- Use deployment slots for zero-downtime blue-green deployments
- Configure auto-scaling rules based on CPU/memory metrics
- Enable Application Insights for container-level telemetry
- Use managed identity for Key Vault access (no connection strings in config)

---

### Q3: Frontend Hosting - Static Web Apps vs App Service vs CDN + Storage?

**Decision**: Azure Static Web Apps (with fallback to App Service if needed)

**Rationale**:
- **Built for SPAs**: Optimized for React/Vue/Angular with automatic routing, API integration, preview environments
- **Global CDN**: Built-in Azure CDN for sub-100ms latency worldwide
- **Free tier for staging**: Generous free tier for development/staging, only pay for production
- **GitHub integration**: Automatic builds and deployments from GitHub Actions
- **Custom domains + SSL**: Free managed SSL certificates with auto-renewal
- **Staging slots**: Built-in preview environments for pull requests

**Alternatives Considered**:
- **Azure App Service**: Full web server for frontend
  - Use as fallback if: Static Web Apps lacks specific feature (e.g., advanced routing, server-side logic)
  - Tradeoff: Higher cost ($70/month vs $9/month), manual CDN setup, but more flexibility
- **Azure Storage + CDN**: Manual static hosting with Blob Storage
  - Rejected because: Requires manual CDN configuration, no automatic SSL, no preview environments, more operational overhead
- **Netlify/Vercel**: Third-party static hosting platforms
  - Rejected because: Keep all infrastructure in Azure for cost tracking, single vendor, unified monitoring

**Implementation Notes**:
- Use `staticwebapp.config.json` for routing rules and security headers
- Configure custom domain with Azure DNS for seamless SSL
- Set up preview environments for pull requests (auto-cleanup after merge)
- Cache static assets (JS/CSS/images) with long TTL (1 year + versioned filenames)

---

### Q4: Database Configuration - High Availability vs Single Server?

**Decision**: PostgreSQL Flexible Server with Zone-Redundant High Availability (for production)

**Rationale**:
- **99.99% uptime SLA**: Zone-redundant HA provides automatic failover within 60 seconds
- **Zero data loss**: Synchronous replication to standby server in different availability zone
- **Automatic failover**: Transparent to application - connection string remains same
- **Cost justification**: +50% cost ($140/month vs $95/month) acceptable for production reliability, single server acceptable for dev/staging
- **Meets constitution SLO**: 99.9% uptime target exceeded with 99.99% HA configuration

**Alternatives Considered**:
- **Single Server (no HA)**: Save $45/month per environment
  - Use for dev/staging only: Acceptable downtime for non-production environments
  - Rejected for production: Risk of multi-hour outages during zone failures
- **Read Replicas**: Horizontal scaling with read-only replicas
  - Defer to Phase 2: Current scale (1000 users) doesn't require read scaling, focus on availability first

**Implementation Notes**:
- Production: General Purpose, 2 vCores, 8GB RAM, Zone-Redundant HA
- Staging: General Purpose, 2 vCores, 8GB RAM, Single Server (save cost)
- Dev: Burstable, 1 vCore, 2GB RAM, Single Server (save cost)
- Enable automated backups (7-day retention minimum, 30 days for production)
- Configure firewall to allow App Service subnet only (private endpoint in Phase 2)
- Use connection pooling in application (SQLAlchemy pool size: 20)

---

### Q5: Email Service - Azure Communication Services vs SendGrid vs Mailgun?

**Decision**: Azure Communication Services (Email)

**Rationale**:
- **Native Azure integration**: Unified billing, monitoring, and access control with other Azure resources
- **Cost-effective**: $0.0012 per email (first 10,000/month free), vs SendGrid $15/month minimum
- **Custom domain support**: Full email authentication (SPF, DKIM, DMARC) with Azure DNS integration
- **Regulatory compliance**: Data residency in Azure region, GDPR/SOC 2 aligned
- **Managed identity**: No API keys needed when accessing from App Service

**Alternatives Considered**:
- **SendGrid**: Mature email platform with extensive features
  - Rejected because: Higher cost at scale, separate vendor to manage, API keys to rotate, less Azure integration
- **Mailgun**: Developer-friendly email API
  - Rejected because: Similar reasons as SendGrid, no cost advantage, another external dependency
- **Direct SMTP (Azure VM + Postfix)**: Self-hosted email server
  - Rejected because: Massive operational overhead, deliverability challenges, requires email infrastructure expertise

**Implementation Notes**:
- Configure custom domain in Azure DNS (e.g., `noreply@fundrbolt.app`)
- Set up DNS records: SPF, DKIM (auto-generated by ACS), DMARC with `p=quarantine`
- Verify domain ownership before enabling production sending
- Monitor email deliverability with Azure Monitor metrics
- Implement exponential backoff retry logic for transient failures (constitution requirement)

---

### Q6: CI/CD Strategy - GitHub Actions vs Azure DevOps?

**Decision**: GitHub Actions

**Rationale**:
- **Source of truth**: Code already in GitHub, workflows live alongside code
- **Free for public repos**: 2000 minutes/month free for private repos (sufficient for project)
- **Native Azure integration**: Official Azure actions for login, resource deployment, container deployment
- **OIDC authentication**: Federated credentials with Azure AD workload identity (no secrets to rotate)
- **Matrix builds**: Parallel testing across environments with build matrix syntax
- **Community actions**: Extensive marketplace for common tasks (setup-node, docker/build-push-action, etc.)

**Alternatives Considered**:
- **Azure DevOps Pipelines**: Microsoft's enterprise CI/CD platform
  - Rejected because: Separate platform from code hosting, less modern YAML syntax, overkill for solo developer project
- **GitLab CI**: Integrated CI/CD in GitLab
  - Rejected because: Would require migrating code to GitLab, project already uses GitHub

**Implementation Notes**:
- Use OIDC federation for Azure authentication (no service principal secrets)
- Separate workflows: `pr-checks.yml` (fast tests on PR), `deploy-backend.yml` (main branch), `deploy-frontend.yml` (main branch)
- Environment-specific secrets in GitHub repository secrets (dev/staging/production)
- Manual approval required for production deployments (`environment: production` with protection rules)
- Implement deployment status checks with health check endpoint validation

---

### Q7: Monitoring & Alerting - Application Insights vs Grafana/Prometheus?

**Decision**: Azure Application Insights (with Prometheus metrics export)

**Rationale**:
- **Managed service**: Zero infrastructure to maintain, automatic scaling, built-in retention
- **Deep Azure integration**: Auto-discovery of dependencies (database, Redis, external APIs)
- **Application-level insights**: Request tracing, exception tracking, performance profiling, user analytics
- **Cost-effective**: Pay-per-GB ingestion ($2.30/GB), free tier 5GB/month, log sampling to reduce costs
- **Workbooks & dashboards**: Pre-built templates for web apps, custom dashboards with KQL queries
- **Prometheus export**: Can export metrics to Prometheus if needed for custom Grafana dashboards later

**Alternatives Considered**:
- **Grafana + Prometheus + Loki**: Self-hosted observability stack
  - Rejected because: Requires VM or AKS cluster, operational overhead, storage costs, not aligned with "managed services" principle
- **Datadog/New Relic**: Third-party APM platforms
  - Rejected because: Higher cost ($15-31/host/month), separate vendor, no native Azure integration

**Implementation Notes**:
- Enable auto-instrumentation for FastAPI and React apps
- Configure structured JSON logging to Application Insights
- Set up alert rules: error rate >5%, p95 latency >500ms, CPU >80%, failed deployments
- Create custom workbooks for: system health, deployment history, cost tracking
- Use Log Analytics workspace for long-term retention (90 days default, 2 years for audit logs)

---

### Q8: Backup & Disaster Recovery - Azure Backup vs Manual Scripts?

**Decision**: Azure-native automated backups with quarterly DR drills

**Rationale**:
- **Built-in for PostgreSQL**: Automated daily backups with 7-30 day retention, point-in-time restore (PITR)
- **Built-in for Redis**: RDB persistence to Azure Blob Storage with configurable snapshot frequency
- **Zero maintenance**: No backup scripts to maintain, automatic pruning of old backups
- **Fast recovery**: Database restore in minutes via Azure portal or CLI
- **Cost included**: Backup storage included in database pricing (up to 1x provisioned storage)

**Alternatives Considered**:
- **Custom backup scripts**: Cron jobs with `pg_dump` to Blob Storage
  - Rejected because: Adds operational overhead, requires monitoring, error-prone, reinventing Azure's built-in capability
- **Third-party backup**: Veeam, Rubrik for Azure
  - Rejected because: Overkill for database backups, higher cost, additional vendor

**Implementation Notes**:
- PostgreSQL: Enable automated backups with 30-day retention for production, 7 days for dev/staging
- Redis: Enable AOF (Append-Only File) persistence + hourly RDB snapshots to Blob Storage
- Document disaster recovery procedures: RTO 4 hours, RPO 15 minutes (hourly Redis snapshots)
- Schedule quarterly DR drills: restore production backup to staging, validate data integrity, measure recovery time
- Create runbook: step-by-step recovery procedures for database, Redis, entire environment

---

### Q9: Secrets Management - Key Vault Access Patterns?

**Decision**: Managed Identity with Key Vault references in App Service configuration

**Rationale**:
- **Zero secrets in code**: App Service retrieves secrets at startup via managed identity (no passwords/keys needed)
- **Automatic rotation**: Update secrets in Key Vault, restart app - no code/config changes
- **Audit logging**: Every secret access logged with timestamp, identity, and IP address
- **Separation of duties**: Developers can't read production secrets, only deploy code
- **Environment isolation**: Separate Key Vault per environment (dev/staging/production)

**Alternatives Considered**:
- **App Service Application Settings**: Store secrets as environment variables
  - Use as fallback only: If Key Vault temporarily unavailable, cache secrets in App Service config as backup
  - Tradeoff: Less secure (visible in portal to all contributors), but provides circuit breaker pattern
- **Secrets in code/repo**: Encrypted secrets file committed to git
  - Rejected: Violates constitution ("never commit secrets"), difficult key rotation, audit trail gaps

**Implementation Notes**:
- Enable system-assigned managed identity on App Service
- Grant managed identity "Key Vault Secrets User" role on Key Vault
- Reference secrets in App Service config with `@Microsoft.KeyVault(SecretUri=...)` syntax
- Store: DATABASE_URL, REDIS_URL, JWT_SECRET, STRIPE_API_KEY, TWILIO_API_KEY
- Implement key rotation: 90-day rotation schedule, blue-green secret versioning (old + new active during transition)
- Add circuit breaker: if Key Vault unavailable at startup, fall back to cached App Service settings with warning log

---

### Q10: Cost Estimation & Budget Alerts?

**Decision**: Azure Cost Management + Budgets with 80% and 100% alerts

**Estimated Monthly Costs** (Production):

| Service | SKU/Tier | Estimated Cost |
|---------|----------|----------------|
| App Service Plan (Backend) | Standard S1 (1 instance) | $70 |
| App Service (Frontend) | Static Web Apps Standard | $9 |
| PostgreSQL Flexible Server | General Purpose 2 vCore, Zone-Redundant HA | $140 |
| Azure Cache for Redis | Standard C1 (1GB) | $55 |
| Azure Key Vault | Standard tier, <10k operations/month | $1 |
| Azure Communication Services | Email: first 10k free, 20k emails/month | $12 |
| Application Insights | 5GB/month (free tier) | $0 |
| Azure DNS | 1 hosted zone, <1M queries/month | $1 |
| Blob Storage | <10GB for backups | $1 |
| **Total (Production)** | | **~$289/month** |

**Dev Environment** (cost-optimized):
- App Service: F1 Free tier or B1 Basic ($13/month)
- PostgreSQL: Burstable B1ms 1 vCore ($12/month)
- Redis: Basic C0 250MB ($16/month)
- Other services: shared with production
- **Total (Dev): ~$42/month**

**Staging Environment**:
- Similar to production but single-server database (no HA): ~$240/month
- Can be shut down when not in use to save costs

**Annual Cost Estimate**: ~$3,500-4,000 (production + dev running 24/7, staging on-demand)

**Cost Optimization Strategies**:
- Use Azure Reservations for 1-year commitment (save 30-40% on compute)
- Shut down dev/staging environments overnight and weekends (save ~50% on those environments)
- Use Azure Spot instances for non-critical workloads (if available for App Service)
- Monitor unused resources with Azure Advisor recommendations

**Budget Configuration**:
- Set monthly budget: $350 (production) + $50 (dev) = $400/month
- Alert at 80% ($320) → notify ops team
- Alert at 100% ($400) → escalate to project owner
- Auto-tagging: `Environment`, `Project=fundrbolt`, `Owner=ops` for granular cost tracking

---

## Azure Best Practices Research

### App Service Configuration
- Use deployment slots for zero-downtime deployments (blue-green pattern)
- Enable "Always On" to prevent cold starts
- Configure health check endpoint (`/health`) for automatic instance replacement
- Use auto-scaling rules: scale out at CPU >70%, scale in at CPU <30%
- Set minimum 2 instances for production (avoid single point of failure)

### Database Security
- Enable SSL/TLS enforcement for all connections
- Use Azure AD authentication where possible (in addition to password auth)
- Configure firewall rules to allow App Service subnet only
- Enable threat detection and vulnerability assessments
- Rotate database admin password every 90 days

### Network Security
- Use VNet integration for App Service to access database/Redis privately
- Configure Network Security Groups (NSGs) to restrict traffic
- Enable DDoS Protection Standard for production (Phase 2)
- Use Azure Private Link for Key Vault access (Phase 2 - cost optimization)

### Deployment Best Practices
- Use `what-if` deployment mode to preview infrastructure changes
- Tag all resources with `Environment`, `Project`, `Owner`, `CostCenter`
- Implement resource locks on production resources (prevent accidental deletion)
- Use Azure Policy to enforce tagging and security standards
- Version all Bicep templates with Git tags

### Monitoring Best Practices
- Set up availability tests (ping tests every 5 minutes from multiple regions)
- Configure smart detection for anomalies (sudden spike in failures)
- Create action groups for alert notifications (email, Teams, PagerDuty)
- Use workbooks for custom dashboards (deployment history, cost trends)
- Enable diagnostic settings for all resources (send logs to Log Analytics)

---

## Decision Summary

| Decision Area | Choice | Key Rationale |
|---------------|--------|---------------|
| IaC Tool | Azure Bicep | Native Azure integration, simpler syntax, no state management |
| Backend Hosting | App Service (containers) | Fully managed PaaS, cost-effective, built-in features |
| Frontend Hosting | Static Web Apps | Optimized for SPAs, global CDN, preview environments |
| Database | PostgreSQL Flexible Server (Zone-Redundant HA for prod) | 99.99% SLA, automatic failover, managed service |
| Email | Azure Communication Services | Native integration, cost-effective, managed identity support |
| CI/CD | GitHub Actions | Native GitHub integration, OIDC auth, free tier sufficient |
| Monitoring | Application Insights | Managed service, deep Azure integration, cost-effective |
| Backups | Azure-native automated | Built-in, zero maintenance, fast recovery |
| Secrets | Key Vault + Managed Identity | Zero secrets in code, automatic rotation, audit logging |
| Estimated Cost | ~$289/month (production) | Balanced performance and cost for MVP scale |

---

## Next Steps (Phase 1)

1. Create `data-model.md` - Azure resource specifications and relationships
2. Generate Bicep templates in `contracts/` directory
3. Define GitHub Actions workflows for infrastructure deployment
4. Create deployment runbooks in `docs/operations/`
5. Write `quickstart.md` - Infrastructure setup guide for team

---

**Research Completed**: 2025-10-27
**Approved By**: Infrastructure specifications align with constitution requirements
**Ready for Phase 1**: ✅ All technical unknowns resolved, tool selections justified

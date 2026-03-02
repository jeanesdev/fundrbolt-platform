# Fundrbolt Platform Infrastructure

This directory contains the Infrastructure as Code (IaC) for deploying the Fundrbolt platform to Microsoft Azure.

## Structure

```
infrastructure/
├── bicep/                  # Azure Bicep templates
│   ├── main.bicep         # Main orchestration template
│   ├── common.bicep       # Common parameter definitions
│   ├── modules/           # Reusable Bicep modules
│   │   ├── resource-group.bicep
│   │   ├── app-service-plan.bicep
│   │   ├── app-service.bicep
│   │   ├── static-web-app.bicep
│   │   ├── database.bicep
│   │   ├── redis.bicep
│   │   ├── key-vault.bicep
│   │   ├── monitoring.bicep
│   │   ├── log-analytics.bicep
│   │   ├── storage.bicep
│   │   ├── dns.bicep
│   │   └── communication.bicep
│   └── parameters/        # Environment-specific parameters
│       ├── dev.bicepparam
│       ├── staging.bicepparam
│       └── production.bicepparam
└── scripts/               # Deployment and management scripts
    ├── provision.sh           # Main provisioning script
    ├── validate.sh            # Infrastructure validation
    ├── deploy-backend.sh      # Backend deployment with blue-green
    ├── deploy-frontend.sh     # Frontend deployment to Static Web Apps
    ├── run-migrations.sh      # Database migration execution
    ├── rollback.sh            # Production rollback procedures
    ├── configure-secrets.sh   # Secret generation and Key Vault storage
    ├── update-app-settings.sh # App Service Key Vault integration
    └── test-disaster-recovery.sh
```

## Prerequisites

- Azure CLI 2.78.0+
- Bicep CLI 0.38.33+
- Azure subscription with appropriate permissions
- GitHub repository with OIDC federated credentials configured

## Quick Start

See `/docs/operations/quickstart.md` for detailed setup instructions.

### Deploy Infrastructure

```bash
# Validate templates
./infrastructure/scripts/validate.sh dev

# Deploy to dev environment
./infrastructure/scripts/provision.sh dev

# Configure secrets in Key Vault
./infrastructure/scripts/configure-secrets.sh dev

# Update App Service to use Key Vault references
./infrastructure/scripts/update-app-settings.sh dev

# Deploy to production
./infrastructure/scripts/provision.sh production
```

## Technology Stack

- **IaC Tool**: Azure Bicep
- **Backend Hosting**: Azure App Service (Linux containers)
- **Frontend Hosting**: Azure Static Web Apps
- **Database**: PostgreSQL Flexible Server (Zone-Redundant HA for production)
- **Cache**: Azure Cache for Redis
- **Secrets**: Azure Key Vault with Managed Identity
- **Email**: Azure Communication Services
- **Monitoring**: Application Insights + Log Analytics
- **CI/CD**: GitHub Actions with OIDC authentication

## Cost Estimates

- **Development**: ~$42/month
- **Staging**: ~$100/month
- **Production**: ~$289/month

See `/specs/004-cloud-infrastructure-deployment/research.md` for detailed cost breakdown.

## Documentation

- **Architecture**: `/docs/operations/architecture.md`
- **Deployment Runbook**: `/docs/operations/deployment-runbook.md`
- **CI/CD Guide**: `/docs/operations/ci-cd-guide.md`
- **Rollback Procedures**: `/docs/operations/rollback-procedures.md`
- **Secret Rotation**: `/docs/operations/secret-rotation.md`
- **Security Checklist**: `/docs/operations/security-checklist.md`
- **DNS Configuration**: `/docs/operations/dns-configuration.md`
- **Email Configuration**: `/docs/operations/email-configuration.md`
- **Disaster Recovery**: `/docs/operations/disaster-recovery.md`
- **Monitoring Guide**: `/docs/operations/monitoring-guide.md`

## Security

- All secrets stored in Azure Key Vault
- Managed Identity for authentication (no hardcoded credentials)
- Network isolation with VNet integration
- Automated security scanning in CI/CD pipeline
- Resource locks on production resources

## Support

For operational issues, see `/docs/operations/troubleshooting.md`.

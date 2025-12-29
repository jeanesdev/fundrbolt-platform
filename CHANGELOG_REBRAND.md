# Brand Rename: Augeo → Fundrbolt

**Effective Date**: December 18, 2025
**Status**: Complete - Phase 1-4 MVP delivered, Phase 5-6 in progress

## Overview

The Augeo Platform has been rebranded to **Fundrbolt Platform**. This document details the changes and migration path for users, partners, and developers.

## What Changed

### User-Facing Changes
- **Product Name**: Augeo Platform → Fundrbolt Platform
- **Dashboard URLs**: URLs remain the same (e.g., `/admin`, `/events`) but branded as Fundrbolt
- **Email Sender**: `Augeo Support <support@augeo.app>` → `Fundrbolt Support <support@fundrbolt.com>`
- **OpenAPI Documentation**: Updated to Fundrbolt branding at `https://{your-domain}/docs`
- **PWA Applications**:
  - Admin Portal: "Augeo Admin" → "Fundrbolt Admin"
  - Donor Portal: "Augeo Donor" → "Fundrbolt Donor"
  - Landing Site: "Augeo" → "Fundrbolt"

### Developer/Infrastructure Changes
- **GitHub Repository**: `jeanesdev/augeo-platform` → `jeanesdev/fundrbolt-platform`
- **Azure Resources**: All resource names updated to use `fundrbolt-*` prefix
  - Storage: `augeo-{env}-storage` → `fundrbolt-{env}-storage`
  - Database: `augeo-{env}-db` → `fundrbolt-{env}-db`
  - Key Vault: `augeo-{env}-kv` → `fundrbolt-{env}-kv`
  - App Service: `augeo-{env}-api` → `fundrbolt-{env}-api`
  - Static Web Apps: `augeo-{env}-admin` → `fundrbolt-{env}-admin`
- **Metrics Names**: All Prometheus metrics updated from `augeo_*` to `fundrbolt_*`
  - `augeo_http_requests_total` → `fundrbolt_http_requests_total`
  - `augeo_db_failures_total` → `fundrbolt_db_failures_total`
  - etc.
- **Docker Images**: Updated to reference `fundrbolt-backend`, `fundrbolt-admin`, etc.
- **Environment Variables**: Package names and service references updated
- **Database**: All user-facing strings updated; data retention policies unchanged
- **API Responses**:
  - `X-Powered-By: Augeo` header → `X-Powered-By: Fundrbolt Platform`
  - OpenAPI title, description, contact email updated
- **GitHub Actions Workflows**: Updated to reference new repository name and resource naming conventions

### Documentation Changes
- All `/docs` markdown files updated from Augeo → Fundrbolt
- README files across repository updated
- `.specify` memory and specifications updated to reference Fundrbolt
- Deployment scripts and runbooks updated with new naming conventions

## What Stayed the Same

✅ **API Functionality**: No breaking changes to API endpoints or request/response formats
✅ **Database Schema**: No structural changes; all migrations idempotent
✅ **Feature Capabilities**: All features work identically
✅ **Data Integrity**: All user data, event data, and audit logs preserved
✅ **Deployment Process**: Infrastructure deployment scripts work with new resource names
✅ **Authentication & Authorization**: All existing sessions, tokens, and permissions remain valid
✅ **Audit Trail**: Historical records maintain Augeo references where appropriate for compliance

## For External API Consumers

### Email Notifications
- **Old Sender**: `support@augeo.app`
- **New Sender**: `support@fundrbolt.com`
- **Action Required**: Update email filters/whitelists if using old sender address

### Webhook Endpoints (if applicable)
- Webhook URLs remain functional with old paths
- New content will reference Fundrbolt in email subjects, body content
- Update email parsing logic if you relied on "Augeo" text patterns

### API Integrations
- No endpoint URL changes
- No authentication changes
- Update display logic to show "Fundrbolt" instead of "Augeo" if needed
- Metrics endpoint (`/metrics`) metrics names changed: `augeo_*` → `fundrbolt_*`

## Legacy URL Redirects

### Gradual Transition Period (1-3 months)
1. All documentation updated to reference Fundrbolt URLs
2. Old documentation links will redirect via nginx rules (if applicable)
3. Internal bookmarks and cached links may return 404s after cutover
4. Partners notified 2 weeks in advance of any URL changes

### Domain Transitions
- **Primary Domain**: `augeo.app` → `fundrbolt.com`
- **Redirect Strategy**: Legacy domain (if applicable) will redirect via 301 HTTP redirects
- **Sunset Timeline**: Old domain maintained for 3-6 months post-launch for backward compatibility

## Migration Checklist for Users

- [ ] Update email filters: `support@augeo.app` → `support@fundrbolt.com`
- [ ] Update bookmarks to new Fundrbolt URLs (if domain changes)
- [ ] Review email notifications for new branding
- [ ] Verify all integrations working post-rebrand
- [ ] Contact support if issues: `support@fundrbolt.com`

## Migration Checklist for Developers

- [ ] Update git remotes: `git remote set-url origin https://github.com/jeanesdev/fundrbolt-platform.git`
- [ ] Pull latest changes from new repository
- [ ] Update any local deployment scripts referencing old repo name
- [ ] Update CI/CD configurations if you have custom workflows
- [ ] Update documentation links in your codebase
- [ ] Test API integrations (Metrics endpoint metrics names changed)
- [ ] Update monitoring dashboards/alerts to track `fundrbolt_*` metrics

## Deployment Timeline

| Phase | Scope | Status | Date |
|-------|-------|--------|------|
| **Phase 1** | Setup & prerequisites | ✅ Complete | 2025-12-18 |
| **Phase 2** | Foundational infrastructure | ✅ Complete | 2025-12-18 |
| **Phase 3** | Customer-facing branding | ✅ Complete | 2025-12-18 |
| **Phase 4** | Operations & infrastructure | ✅ Complete | 2025-12-18 |
| **Phase 5** | Legacy redirects & docs | 🔄 In Progress | 2025-12-18 |
| **Phase 6** | Polish & production deploy | ⏳ Pending | 2025-12-19 |
| **Staging Deployment** | Full testing environment | ⏳ Pending | 2025-12-19 |
| **Production Deployment** | Live production | ⏳ Pending | 2025-12-20 |

## Support & Questions

- **Documentation**: See updated docs in `/docs` directory
- **Issue Reporting**: GitHub Issues at `jeanesdev/fundrbolt-platform`
- **Support Email**: `support@fundrbolt.com`

## Rollback Plan

If critical issues arise post-deployment:

1. **Immediate Rollback**: Restore previous version from git tag
2. **Database Rollback**: Migrations are idempotent; can restore from backup
3. **Stakeholder Notification**: Product & operations teams informed
4. **Incident Review**: Post-incident analysis and remediation

---

**Prepared by**: GitHub Copilot
**Last Updated**: 2025-12-18
**Next Review**: 2025-12-25

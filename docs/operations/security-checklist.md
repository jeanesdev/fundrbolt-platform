# Security Checklist

Comprehensive security checklist for production deployments of the Fundrbolt platform.

## 1. Secrets Management

### Azure Key Vault Configuration

- [ ] Key Vault deployed with unique name per environment
- [ ] RBAC authorization model enabled (not access policies)
- [ ] Soft delete enabled with 90-day retention (production)
- [ ] Purge protection enabled (production)
- [ ] Diagnostic settings configured to Log Analytics
- [ ] Network rules configured to restrict public access
- [ ] Private endpoint configured (production - optional)

### Secret Storage

- [ ] All sensitive credentials stored in Key Vault
- [ ] No secrets in source code or configuration files
- [ ] No secrets in environment variables (use Key Vault references)
- [ ] Secret descriptions include rotation date
- [ ] Secret names follow naming convention (kebab-case)
- [ ] Secrets have appropriate expiration dates

### App Service Configuration

- [ ] App Service uses system-assigned managed identity
- [ ] Managed identity has "Key Vault Secrets User" role
- [ ] Application settings use Key Vault references (@Microsoft.KeyVault syntax)
- [ ] No connection strings stored in App Service settings
- [ ] Startup script does not log secret values

## 2. Authentication & Authorization

### JWT Configuration

- [ ] JWT secret is 32+ bytes of random data
- [ ] Access tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days
- [ ] Token blacklist implemented in Redis
- [ ] Tokens use HS256 algorithm (HMAC with SHA-256)
- [ ] Token payload does not include sensitive data

### Password Security

- [ ] Bcrypt hashing with cost factor 12
- [ ] Password minimum length 8 characters
- [ ] Password reset tokens expire in 1 hour
- [ ] Email verification tokens expire in 24 hours
- [ ] Failed login attempts tracked and rate-limited
- [ ] Account lockout after 5 failed attempts

### OAuth2 & Session Management

- [ ] OAuth2 flows implemented correctly
- [ ] Session data stored in Redis (not memory)
- [ ] Session timeout configured (15 minutes)
- [ ] Session expiration warning in frontend (2 minutes before)
- [ ] Logout revokes refresh tokens
- [ ] Device tracking enabled (user-agent, IP)

## 3. Network Security

### Azure Resources

- [ ] PostgreSQL SSL required (sslmode=require)
- [ ] PostgreSQL public network access disabled (production)
- [ ] PostgreSQL firewall rules configured (Azure services only)
- [ ] Redis TLS 1.2+ enforced
- [ ] Redis public network access disabled (production)
- [ ] App Service HTTPS only enforced
- [ ] App Service TLS 1.2+ required

### CORS Configuration

- [ ] CORS origins whitelist configured
- [ ] No wildcard (*) origins in production
- [ ] CORS credentials allowed only for trusted origins
- [ ] Preflight requests handled correctly

### DNS & SSL/TLS

- [ ] Custom domain configured (production)
- [ ] SSL/TLS certificate auto-renewal enabled
- [ ] HSTS header configured (max-age=31536000)
- [ ] Certificate pinning considered (optional)

## 4. Database Security

### PostgreSQL Configuration

- [ ] Admin password 25+ characters, random
- [ ] Admin password rotated every 90 days
- [ ] Database user has minimal required permissions
- [ ] Automated backups enabled (7-30 days retention)
- [ ] Point-in-time restore tested
- [ ] Zone-redundant HA enabled (production)
- [ ] No public IP access (production)

### Data Protection

- [ ] Encryption at rest enabled (Azure default)
- [ ] Encryption in transit enforced (SSL)
- [ ] Sensitive fields encrypted in application (if needed)
- [ ] PII data handling compliant with regulations
- [ ] Soft deletes implemented (no hard deletes)

### Backup & Recovery

- [ ] Automated backups configured
- [ ] Backup retention period appropriate (30 days production)
- [ ] Backup restore tested quarterly
- [ ] Disaster recovery plan documented
- [ ] RTO/RPO defined and tested

## 5. Application Security

### Dependency Management

- [ ] Poetry lock file committed and up-to-date
- [ ] pnpm lock file committed and up-to-date
- [ ] No vulnerable dependencies (run npm audit, poetry audit)
- [ ] Dependabot enabled for automated updates
- [ ] Trivy security scanning in CI/CD pipeline

### Input Validation

- [ ] Pydantic models validate all inputs
- [ ] SQL injection protection (SQLAlchemy ORM)
- [ ] XSS protection (React auto-escapes)
- [ ] CSRF protection for state-changing operations
- [ ] File upload validation (if applicable)

### Rate Limiting

- [ ] Login endpoint rate-limited (5 attempts/15 minutes)
- [ ] Password reset rate-limited (3 attempts/hour)
- [ ] API rate limits configured per endpoint
- [ ] Rate limit headers returned (X-RateLimit-*)
- [ ] Redis used for distributed rate limiting

### Error Handling

- [ ] Error messages do not leak sensitive information
- [ ] Stack traces not returned in production
- [ ] Error logging does not include secrets
- [ ] Database errors handled gracefully
- [ ] External API errors handled with retries

## 6. Monitoring & Logging

### Application Insights

- [ ] Application Insights configured for all environments
- [ ] Sampling configured appropriately (10% production, 100% dev)
- [ ] Custom metrics tracked (HTTP requests, failures)
- [ ] Dependency tracking enabled
- [ ] Exception tracking enabled

### Audit Logging

- [ ] All authentication events logged
- [ ] Authorization failures logged
- [ ] Admin actions logged
- [ ] Audit logs include user ID, timestamp, IP, action
- [ ] Audit logs retained for compliance (1 year minimum)

### Security Monitoring

- [ ] Failed login attempts monitored
- [ ] Unusual traffic patterns detected
- [ ] Key Vault access audited
- [ ] Database connection failures alerted
- [ ] Redis connection failures alerted

### Alerts

- [ ] Critical error rate alert configured
- [ ] Database CPU/memory alert configured
- [ ] Redis CPU/memory alert configured
- [ ] App Service CPU/memory alert configured
- [ ] SSL certificate expiration alert configured (30 days)

## 7. CI/CD Security

### GitHub Actions

- [ ] OIDC authentication configured (no stored secrets)
- [ ] Workflow permissions minimal (not repo-wide)
- [ ] Secrets scoped to environments (not repository-wide)
- [ ] Branch protection rules enforced (main, production)
- [ ] Required status checks configured
- [ ] Manual approval required for production deployments

### Deployment

- [ ] Blue-green deployment for production (staging slot)
- [ ] Health checks before slot swap
- [ ] Automatic rollback on failure
- [ ] Database migrations run in separate step
- [ ] Migration rollback procedures documented

### Container Security

- [ ] Base image from official source (python:3.11-slim)
- [ ] Container runs as non-root user
- [ ] Minimal packages installed
- [ ] Trivy scan in CI/CD pipeline
- [ ] Container images signed (optional)

## 8. Compliance & Documentation

### Data Privacy

- [ ] GDPR compliance (if applicable)
- [ ] CCPA compliance (if applicable)
- [ ] Data retention policy documented
- [ ] User data export functionality (if required)
- [ ] User data deletion functionality (if required)

### Security Documentation

- [ ] Architecture diagram up-to-date
- [ ] Security policies documented
- [ ] Incident response plan documented
- [ ] Secret rotation procedures documented
- [ ] Disaster recovery procedures documented

### Access Control

- [ ] Least privilege principle enforced
- [ ] Role-based access control (RBAC) implemented
- [ ] Admin accounts reviewed quarterly
- [ ] Service principal permissions minimal
- [ ] Azure resource access audited

## 9. Testing & Validation

### Security Testing

- [ ] Automated security tests in CI/CD
- [ ] Penetration testing performed (annual)
- [ ] Vulnerability scanning enabled
- [ ] Dependency scanning enabled
- [ ] Code scanning enabled (CodeQL)

### Functional Testing

- [ ] Authentication flows tested
- [ ] Authorization tests for all roles
- [ ] Rate limiting tests
- [ ] Input validation tests
- [ ] Error handling tests

### Performance Testing

- [ ] Load testing performed
- [ ] Stress testing performed
- [ ] Database query performance optimized
- [ ] Caching strategy validated
- [ ] CDN configuration tested (if applicable)

## 10. Operational Security

### Incident Response

- [ ] Security incident response plan documented
- [ ] On-call rotation established
- [ ] Escalation procedures defined
- [ ] Communication templates prepared
- [ ] Post-incident review process defined

### Regular Reviews

- [ ] Quarterly access review
- [ ] Quarterly secret rotation
- [ ] Quarterly backup restore test
- [ ] Quarterly DR drill
- [ ] Annual security audit

### Maintenance

- [ ] Patching schedule defined and followed
- [ ] Dependency updates automated (Dependabot)
- [ ] Azure resource updates monitored
- [ ] Breaking changes tracked and planned
- [ ] End-of-life software identified and upgraded

## Environment-Specific Checklists

### Development Environment

- [ ] Separate Azure subscription (optional)
- [ ] Test data only (no production data)
- [ ] Relaxed rate limits for testing
- [ ] Verbose logging enabled
- [ ] Public access allowed (for testing)

### Staging Environment

- [ ] Mirrors production configuration
- [ ] Separate Key Vault and secrets
- [ ] Production-like data (anonymized)
- [ ] Production rate limits
- [ ] Restricted access (VPN or IP whitelist)

### Production Environment

- [ ] All security controls enabled
- [ ] Minimal logging (no sensitive data)
- [ ] High availability configured
- [ ] Auto-scaling enabled
- [ ] Backup and DR fully configured
- [ ] 24/7 monitoring and alerting
- [ ] Change management process enforced

## Pre-Deployment Checklist

Use this checklist before deploying to production:

1. [ ] All security controls reviewed and enabled
2. [ ] Secrets rotated within last 90 days
3. [ ] Dependencies up-to-date (no critical vulnerabilities)
4. [ ] Tests passing (unit, integration, security)
5. [ ] Database backup verified (can restore)
6. [ ] Monitoring and alerting tested
7. [ ] Rollback procedure documented and tested
8. [ ] Deployment window communicated to stakeholders
9. [ ] On-call engineer available during deployment
10. [ ] Post-deployment verification plan prepared

## Related Documentation

- [Secret Rotation Procedures](secret-rotation.md)
- [CI/CD Guide](ci-cd-guide.md)
- [Rollback Procedures](rollback-procedures.md)
- [Architecture Overview](architecture.md)
- [DNS Configuration](dns-configuration.md)
- [Email Configuration](email-configuration.md)

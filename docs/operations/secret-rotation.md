# Secret Rotation Procedures

This guide provides step-by-step procedures for rotating secrets stored in Azure Key Vault. Regular secret rotation is a critical security practice that limits the impact of potential credential compromise.

## Rotation Schedule

| Secret Type | Recommended Frequency | Impact |
|-------------|----------------------|---------|
| JWT Secret | Every 90 days | Active sessions invalidated |
| Database Password | Every 90 days | Brief connection disruption |
| Redis Keys | Every 90 days | Brief cache unavailability |
| API Keys (Stripe, Twilio) | Every 180 days | External service disruption |
| SMTP Credentials | Every 180 days | Email sending disruption |

## Prerequisites

- Azure CLI installed and authenticated
- Sufficient permissions (Key Vault Administrator role)
- Access to production resources
- Scheduled maintenance window for production rotations

## 1. JWT Secret Rotation

The JWT secret is used for signing access and refresh tokens. Rotating it will invalidate all active sessions.

### JWT Secret Impact

- **User Impact**: All users must log in again
- **Downtime**: None (seamless transition)
- **Duration**: ~2 minutes

### JWT Secret Rotation Procedure

```bash
# 1. Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Store new secret in Key Vault
az keyvault secret set \
    --vault-name "fundrbolt-production-kv" \
    --name "jwt-secret" \
    --value "$NEW_JWT_SECRET" \
    --description "JWT signing secret (rotated $(date -I))"

# 3. Restart App Service to load new secret
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# 4. Wait for health check
sleep 30
curl -f https://api.fundrbolt.app/health

# 5. Verify application logs
az webapp log tail \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"
```

### Verification

1. Test login: `POST /api/v1/auth/login`
2. Verify new JWT token issued
3. Confirm old tokens rejected (401 Unauthorized)

- Check Application Insights for authentication errors

### JWT Secret Rollback

```bash
# Restore previous secret version
az keyvault secret set-attributes \
    --vault-name "fundrbolt-production-kv" \
    --name "jwt-secret" \
    --version <previous-version-id>

# Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"
```

## 2. Database Password Rotation

PostgreSQL password rotation requires updating both the database and the connection string.

### Database Impact

- **User Impact**: None (brief connection pool refresh)
- **Downtime**: < 10 seconds (connection pool cycle)
- **Duration**: ~5 minutes

### Database Password Rotation Procedure

```bash
# 1. Generate new password
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# 2. Update PostgreSQL password
az postgres flexible-server update \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-db" \
    --admin-password "$NEW_DB_PASSWORD"

# 3. Get database connection details
DB_HOST=$(az postgres flexible-server show \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-db" \
    --query "fullyQualifiedDomainName" -o tsv)

DB_USER="fundrbolt_admin"
DB_NAME="fundrbolt_production"

# 4. Construct new connection string
NEW_DB_URL="postgresql://${DB_USER}:${NEW_DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"

# 5. Update Key Vault secret
az keyvault secret set \
    --vault-name "fundrbolt-production-kv" \
    --name "database-url" \
    --value "$NEW_DB_URL" \
    --description "PostgreSQL connection string (rotated $(date -I))"

# 6. Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# 7. Verify database connectivity
sleep 30
curl -f https://api.fundrbolt.app/health/detailed
```

### Verification

1. Check detailed health endpoint: `GET /health/detailed`
2. Verify `database.status: "healthy"`
3. Test database operations (user login, NPO creation)

- Monitor Application Insights for database errors

### Database Password Rollback

```bash
# Restore previous database password
az postgres flexible-server update \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-db" \
    --admin-password "<previous-password>"

# Restore previous secret version
az keyvault secret set-attributes \
    --vault-name "fundrbolt-production-kv" \
    --name "database-url" \
    --version <previous-version-id>

# Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"
```

## 3. Redis Key Rotation

Redis access key rotation is automated by Azure but requires updating the connection string.

### Redis Impact

- **User Impact**: Brief session lookup failures (< 5 seconds)
- **Downtime**: None (automatic reconnection)
- **Duration**: ~3 minutes

### Redis Key Rotation Procedure

```bash
# 1. Regenerate Redis secondary key
az redis regenerate-keys \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-cache" \
    --key-type Secondary

# 2. Get new secondary key
REDIS_KEY=$(az redis list-keys \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-cache" \
    --query "secondaryKey" -o tsv)

# 3. Get Redis hostname
REDIS_HOST=$(az redis show \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-cache" \
    --query "hostName" -o tsv)

# 4. Construct new connection string
NEW_REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0?ssl_cert_reqs=required"

# 5. Update Key Vault secret
az keyvault secret set \
    --vault-name "fundrbolt-production-kv" \
    --name "redis-url" \
    --value "$NEW_REDIS_URL" \
    --description "Redis connection string with secondary key (rotated $(date -I))"

# 6. Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# 7. Verify Redis connectivity
sleep 30
curl -f https://api.fundrbolt.app/health/detailed

# 8. Regenerate primary key after verification
az redis regenerate-keys \
    --resource-group "fundrbolt-production-rg" \
    --name "fundrbolt-production-cache" \
    --key-type Primary
```

### Verification

1. Check detailed health endpoint: `GET /health/detailed`
2. Verify `redis.status: "healthy"`
3. Test session operations (login, token refresh)

- Monitor Application Insights for Redis errors

### Redis Key Verification

1. Check detailed health endpoint: `GET /health/detailed`
2. Verify `redis.status: "healthy"`
3. Test session operations (login, token refresh)
4. Monitor Application Insights for Redis errors

## 4. API Key Rotation (Stripe, Twilio)

External service API keys should be rotated through the provider's dashboard.

### API Key Impact

- **User Impact**: None (if done correctly)
- **Downtime**: None
- **Duration**: ~5 minutes

### API Key Rotation Procedure (Stripe Example)

```bash
# 1. Generate new API key in Stripe Dashboard
# Navigate to: https://dashboard.stripe.com/apikeys
# Create new restricted key with minimal permissions

# 2. Update Key Vault secret
az keyvault secret set \
    --vault-name "fundrbolt-production-kv" \
    --name "stripe-api-key" \
    --value "sk_live_<new-key>" \
    --description "Stripe API key (rotated $(date -I))"

# 3. Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# 4. Test Stripe integration
curl -X POST https://api.fundrbolt.app/api/v1/payments/test

# 5. Revoke old API key in Stripe Dashboard
```

### API Key Verification

1. Test payment operations (create checkout session, process payment)
2. Monitor Application Insights for Stripe API errors
3. Check Stripe Dashboard for API usage with new key

## 5. SMTP Credentials Rotation

Email service credentials rotation depends on the provider (SendGrid, Mailgun, etc.).

### SMTP Impact

- **User Impact**: None
- **Downtime**: None
- **Duration**: ~5 minutes

### SMTP Rotation Procedure

```bash
# 1. Generate new SMTP password in provider dashboard

# 2. Update Key Vault secrets
az keyvault secret set \
    --vault-name "fundrbolt-production-kv" \
    --name "email-smtp-password" \
    --value "<new-password>" \
    --description "SMTP password (rotated $(date -I))"

# 3. Restart App Service
az webapp restart \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# 4. Test email sending
curl -X POST https://api.fundrbolt.app/api/v1/auth/verify-email/resend
```

### SMTP Verification

1. Test email verification: `POST /api/v1/auth/verify-email/resend`
2. Test password reset: `POST /api/v1/auth/password/reset/request`
3. Check Application Insights for email send failures
4. Verify email delivery to test inbox

## Emergency Rotation

If a secret is compromised, perform emergency rotation immediately:

### 1. Isolate the Breach

```bash
# Revoke compromised credentials immediately
# For API keys: Revoke in provider dashboard
# For database: Disable user account temporarily
# For Redis: Regenerate both keys
```

### 2. Rotate Secret

Follow the standard rotation procedure for the compromised secret type.

### 3. Audit Access

```bash
# Review Key Vault audit logs
az monitor activity-log list \
    --resource-group "fundrbolt-production-rg" \
    --start-time "2025-01-01T00:00:00Z" \
    --query "[?contains(authorization.action, 'Microsoft.KeyVault')]" \
    --output table

# Review App Service logs
az webapp log tail \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"
```

### 4. Notify Stakeholders

- Security team
- DevOps team
- Management (if severe)

## Automation

Consider automating secret rotation using Azure Functions or GitHub Actions:

```yaml
# .github/workflows/rotate-secrets.yml
name: Rotate Secrets
on:
  schedule:
    - cron: '0 2 1 */3 *'  # Every 3 months at 2 AM
  workflow_dispatch:

jobs:
  rotate-jwt:
    runs-on: ubuntu-latest
    steps:
      - name: Rotate JWT Secret
        run: |
          # Automated rotation script
```

## Best Practices

1. **Schedule Rotations**: Use maintenance windows for production
2. **Test First**: Always rotate in dev/staging before production
3. **Document**: Record rotation dates and versions
4. **Monitor**: Watch Application Insights during rotation
5. **Verify**: Test critical functionality after rotation
6. **Automate**: Use scripts to reduce human error
7. **Audit**: Review Key Vault access logs regularly

## Troubleshooting

### App Service Can't Access Key Vault

```bash
# Verify managed identity
az webapp identity show \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# Verify role assignment
az role assignment list \
    --assignee <principal-id> \
    --scope /subscriptions/<sub-id>/resourceGroups/fundrbolt-production-rg/providers/Microsoft.KeyVault/vaults/fundrbolt-production-kv
```

### Connection Errors After Rotation

```bash
# Check secret value format
az keyvault secret show \
    --vault-name "fundrbolt-production-kv" \
    --name "database-url" \
    --query "value"

# Test connection manually
psql "postgresql://fundrbolt_admin:<password>@fundrbolt-production-db.postgres.database.azure.com:5432/fundrbolt_production?sslmode=require"
```

### Health Check Failing

```bash
# View application logs
az webapp log tail \
    --name "fundrbolt-production-api" \
    --resource-group "fundrbolt-production-rg"

# Check detailed health endpoint
curl -v https://api.fundrbolt.app/health/detailed
```

## Related Documentation

- [CI/CD Guide](ci-cd-guide.md) - Deployment procedures
- [Rollback Procedures](rollback-procedures.md) - Recovery procedures
- [Security Checklist](security-checklist.md) - Security best practices
- [Architecture Overview](architecture.md) - System architecture

# Email Setup Quick Reference

## Prerequisites
✅ DNS registration for fundrbolt.com is complete
✅ Azure subscription with permissions to deploy resources

## Step-by-Step Email Setup

### 1. Deploy Azure Communication Services

```bash
# Set PostgreSQL password
export POSTGRES_PASSWORD="<your-secure-password>"

# Deploy infrastructure (if not already deployed)
cd infrastructure
./scripts/provision.sh production $POSTGRES_PASSWORD
```

**Wait**: 5-10 minutes for deployment to complete

### 2. Configure DNS Records for Email

```bash
# Run the automated DNS configuration script
./infrastructure/scripts/configure-email-dns.sh
```

This script adds:
- **TXT @ record**: Domain verification token
- **TXT @ record**: SPF record (`v=spf1 include:spf.azurecomm.net ~all`)
- **TXT _dmarc record**: DMARC policy
- **CNAME records**: Two DKIM selectors for email signing

**Wait**: 5-30 minutes for DNS propagation

### 3. Verify Domain Configuration

```bash
# Check DNS propagation and domain verification status
./infrastructure/scripts/verify-email-domain.sh
```

Expected output when ready:
```
✅ All verification checks passed!
  Domain Verification: Verified
  SPF Status:          Verified
  DKIM Status:         Verified
  DMARC Status:        Verified
```

If not verified yet, wait 10 more minutes and re-run.

### 4. Send Test Email

```bash
# Send test email to your personal email
./infrastructure/scripts/test-email.sh your-email@example.com

# Or specify a different sender address
./infrastructure/scripts/test-email.sh your-email@example.com support@fundrbolt.com
```

**Check**: Your inbox (and spam folder) for the test email

### 5. Test Authentication Score

```bash
# Test with mail-tester.com to verify authentication
./infrastructure/scripts/test-email-score.sh
```

Follow the prompts to:
1. Get a unique test address from mail-tester.com
2. Send a test email to that address
3. Check your score (target: 9-10/10)

### 6. Store Connection String in Key Vault

```bash
# Get ACS connection string
ACS_CONNECTION_STRING=$(az communication list-key \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg \
  --query "primaryConnectionString" -o tsv)

# Store in Key Vault
az keyvault secret set \
  --vault-name fundrbolt-production-kv \
  --name acs-connection-string \
  --value "$ACS_CONNECTION_STRING"
```

### 7. Configure Backend Application

```bash
# Update App Service configuration
az webapp config appsettings set \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --settings \
    EMAIL_PROVIDER="azure_communication_services" \
    ACS_CONNECTION_STRING="@Microsoft.KeyVault(SecretUri=https://fundrbolt-production-kv.vault.azure.net/secrets/acs-connection-string/)" \
    EMAIL_FROM="noreply@fundrbolt.com" \
    EMAIL_SUPPORT="support@fundrbolt.com" \
    EMAIL_BILLING="billing@fundrbolt.com"

# Restart App Service
az webapp restart \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg
```

## Available Sender Addresses

After setup, you can send emails from:
- `noreply@fundrbolt.com` - System notifications, automated emails
- `support@fundrbolt.com` - Support inquiries, help tickets
- `billing@fundrbolt.com` - Invoices, payment receipts
- `notifications@fundrbolt.com` - User notifications, alerts

## Verification Checklist

- [ ] Azure Communication Services deployed
- [ ] DNS records added (5 total: 3 TXT, 2 CNAME)
- [ ] DNS propagation complete (check with `dig`)
- [ ] Domain verified in Azure Portal
- [ ] All authentication checks pass (SPF, DKIM, DMARC)
- [ ] Test email received successfully
- [ ] Mail-tester.com score ≥ 9/10
- [ ] Connection string stored in Key Vault
- [ ] Backend app settings configured

## Troubleshooting

### Domain not verifying
```bash
# Check DNS propagation
dig TXT fundrbolt.com +short
dig TXT _dmarc.fundrbolt.com +short
dig CNAME selector1-azurecomm-prod-net._domainkey.fundrbolt.com +short

# Wait longer (up to 48 hours for full global propagation)
# Re-run verification script
./infrastructure/scripts/verify-email-domain.sh
```

### Email going to spam
- Check mail-tester.com score (should be 9-10/10)
- Verify all authentication passes (SPF, DKIM, DMARC)
- Warm up domain with low volume initially
- Avoid spam trigger words in content

### Can't send emails
```bash
# Check ACS service status
az communication show \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg

# Verify connection string is valid
az communication list-key \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg
```

## Cost

**Azure Communication Services Email Pricing**:
- First 100 emails/month: **FREE**
- Additional emails: **$0.0012 per email**

**Examples**:
- 1,000 emails/month: ~$1.08
- 10,000 emails/month: ~$11.88

## Next Steps

After email setup:
1. Integrate email sending in backend code (see `docs/operations/email-configuration.md`)
2. Set up email monitoring in Application Insights
3. Configure bounce handling
4. Implement email templates for common scenarios

## Documentation

- Full guide: `docs/operations/email-configuration.md`
- DNS setup: `docs/operations/dns-configuration.md`
- Monitoring: `docs/operations/monitoring.md`

## Quick Commands Reference

| Task | Command |
|------|---------|
| Configure DNS | `./infrastructure/scripts/configure-email-dns.sh` |
| Verify domain | `./infrastructure/scripts/verify-email-domain.sh` |
| Send test email | `./infrastructure/scripts/test-email.sh <email>` |
| Test auth score | `./infrastructure/scripts/test-email-score.sh` |
| Check DNS | `dig TXT fundrbolt.com +short` |
| Get connection string | `az communication list-key --name fundrbolt-production-acs --resource-group fundrbolt-production-rg` |

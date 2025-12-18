# Email Configuration Guide

This guide explains how to set up email sending using Azure Communication Services (ACS) with custom domain authentication for the Fundrbolt platform.

## Overview

The Fundrbolt platform uses a hybrid email architecture:
- **Email Sending**: Azure Communication Services (ACS)
- **Email Receiving**: ImprovMX (free email forwarding service)
- **Custom domain**: `fundrbolt.app`
- **Sender addresses**: `DoNotReply@fundrbolt.app`, `Legal@fundrbolt.app`, `Privacy@fundrbolt.app`, `DPO@fundrbolt.app`, `admin@fundrbolt.app`
- **Authentication**: SPF, DKIM, DMARC for 10/10 deliverability score
- **Delivery time**: < 30 seconds average
- **Cost**: FREE (100 emails/month on ACS free tier, unlimited forwarding with ImprovMX)

## Architecture

```
Sending:  Application → Azure Communication Services → SPF/DKIM/DMARC → Recipient

Receiving: Sender → MX Records (ImprovMX) → Email Forwarding → jeanes.dev@gmail.com
                          ↓
                   DNS Records (fundrbolt.app)
```

**Why This Architecture?**
- **Azure Communication Services**: Handles all outbound transactional emails with excellent deliverability
- **ImprovMX**: Provides email receiving/forwarding (Azure doesn't offer email receiving)
- **Cost-Effective**: Both services free for our usage volume
- **Flexible DNS**: Works with Azure DNS (no nameserver changes required)

## Prerequisites

- Azure DNS Zone configured for `fundrbolt.app` (see [DNS Configuration Guide](./dns-configuration.md))
- Azure Communication Services deployed (automatic in production)
- Access to Azure Portal
- Domain registrar access (if not using Azure DNS)

## Step 1: Deploy Azure Communication Services

ACS is automatically deployed with production infrastructure when `customDomain` is configured:

```bash
# Deploy infrastructure with email services
./infrastructure/scripts/provision.sh production <postgres-password>
```

The Bicep template creates:
- Communication Services resource
- Email Services resource
- Email domain configuration (custom or Azure-managed)

## Step 2: Retrieve Email Configuration Values

After deployment, get the required DNS records and configuration:

```bash
# Get deployment outputs
az deployment sub show \
  --name fundrbolt-production-<timestamp> \
  --query properties.outputs

# Get ACS connection string (save to Key Vault)
az communication show \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg \
  --query "connectionString"

# Get email domain verification token
az communication email domain show \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --query "verificationStates.Domain.verificationToken"
```

## Step 3: Configure DNS Records for Email Authentication

Add the following DNS records to your Azure DNS Zone (or domain registrar):

### Domain Verification TXT Record
```bash
az network dns record-set txt add-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name @ \
  --value "<verification-token-from-acs>"
```

### SPF Record (Sender Policy Framework)

**For Azure Communication Services only** (no forwarding service in SPF):

```bash
az network dns record-set txt add-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name @ \
  --value "v=spf1 include:spf.protection.outlook.com ~all"
```

**Note**: ImprovMX doesn't need to be in SPF as it only receives/forwards emails, it doesn't send emails from your domain.

### MX Records (Mail Exchange - for receiving emails)

**For ImprovMX email forwarding**:

```bash
# Add ImprovMX MX records
az network dns record-set mx add-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name @ \
  --exchange mx1.improvmx.com \
  --preference 10

az network dns record-set mx add-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name @ \
  --exchange mx2.improvmx.com \
  --preference 20
```

**Note**: MX records route incoming emails to ImprovMX's servers for forwarding. Azure Communication Services doesn't provide email receiving capabilities.

### DMARC Record (Domain-based Message Authentication)
```bash
az network dns record-set txt add-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name _dmarc \
  --value "v=DMARC1; p=quarantine; rua=mailto:dmarc@fundrbolt.app; pct=100; fo=1"
```

### DKIM Records (DomainKeys Identified Mail)

Retrieve DKIM selectors from ACS:
```bash
# Get DKIM selector 1
az communication email domain show \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --query "verificationStates.DKIM.domainKey1"

# Get DKIM selector 2
az communication email domain show \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --query "verificationStates.DKIM.domainKey2"
```

Add CNAME records:
```bash
# DKIM selector 1
az network dns record-set cname set-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name selector1-azurecomm-prod-net._domainkey \
  --cname "<dkim-selector-1-value>"

# DKIM selector 2
az network dns record-set cname set-record \
  --zone-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --record-set-name selector2-azurecomm-prod-net._domainkey \
  --cname "<dkim-selector-2-value>"
```

## Step 4: Verify Domain in Azure Portal

1. Navigate to Azure Portal → Communication Services → fundrbolt-production-email
2. Go to "Provision domains" → "Custom domains"
3. Select `fundrbolt.app`
4. Click "Verify" button
5. Wait 5-15 minutes for verification

Check verification status:
```bash
az communication email domain show \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg \
  --query "verificationStates"
```

Expected output:
```json
{
  "Domain": {
    "status": "Verified"
  },
  "SPF": {
    "status": "Verified"
  },
  "DKIM": {
    "status": "Verified"
  },
  "DMARC": {
    "status": "Verified"
  }
}
```

## Step 4b: Configure ImprovMX Email Forwarding

ImprovMX provides free email forwarding to receive emails at your custom domain addresses.

### 1. Set Up ImprovMX

1. Go to [https://improvmx.com/](https://improvmx.com/)
2. Click "Get Started" (no account required initially)
3. Enter your domain: `fundrbolt.app`
4. ImprovMX will automatically detect your MX records

### 2. Configure Email Aliases

Add forwarding rules for each address:

| Alias | Forwards To | Purpose |
|-------|-------------|---------|
| `admin@fundrbolt.app` | `jeanes.dev@gmail.com` | Administrative emails |
| `Legal@fundrbolt.app` | `jeanes.dev@gmail.com` | Legal inquiries |
| `Privacy@fundrbolt.app` | `jeanes.dev@gmail.com` | Privacy requests |
| `DPO@fundrbolt.app` | `jeanes.dev@gmail.com` | Data Protection Officer |
| `support@fundrbolt.app` | `jeanes.dev@gmail.com` | Support inquiries |

### 3. Verify Your Gmail Address

- ImprovMX will send a verification email to `jeanes.dev@gmail.com`
- Click the verification link in that email
- All forwarding will be activated immediately

### 4. Optional: Set Up Catch-All

To receive emails sent to any address at your domain:

```
*@fundrbolt.app → jeanes.dev@gmail.com
```

### 5. Test Email Receiving

After DNS propagation (5-15 minutes), test by sending an email:

```bash
# From your personal email or another service
echo "Test email body" | mail -s "Test Receiving" admin@fundrbolt.app
```

Check your Gmail inbox for the forwarded message.

### ImprovMX Features

- ✅ **Completely FREE**: Up to 10 aliases
- ✅ **No account required**: Optional account for dashboard access
- ✅ **Works with any DNS**: Azure DNS, CloudFlare, Namecheap, etc.
- ✅ **No nameserver changes**: Unlike CloudFlare Email Routing
- ✅ **Instant setup**: No waiting period
- ✅ **Unlimited forwarding**: No volume limits on free tier

### Why Not Use CloudFlare Email Routing?

CloudFlare Email Routing requires changing your domain's nameservers from Azure DNS to CloudFlare's nameservers. This would force you to:
- Migrate all DNS records from Azure to CloudFlare
- Update nameservers at domain registrar
- Lose integration with Azure DNS zones
- Potentially break existing Azure resource DNS integrations

ImprovMX works with your existing Azure DNS setup without any infrastructure changes.

## Step 5: Configure Sender Addresses

The following sender addresses are configured in Azure Communication Services:

| Address | Purpose | Display Name | Can Receive? |
|---------|---------|--------------|--------------|
| DoNotReply@fundrbolt.app | System notifications, automated emails | Fundrbolt Platform | ❌ No (by design) |
| admin@fundrbolt.app | Administrative communications | Fundrbolt Admin | ✅ Yes (forwards to Gmail) |
| Legal@fundrbolt.app | Legal inquiries, terms updates | Fundrbolt Legal | ✅ Yes (forwards to Gmail) |
| Privacy@fundrbolt.app | Privacy requests, GDPR inquiries | Fundrbolt Privacy | ✅ Yes (forwards to Gmail) |
| DPO@fundrbolt.app | Data Protection Officer communications | Fundrbolt DPO | ✅ Yes (forwards to Gmail) |

### Creating Sender Usernames in ACS

Sender usernames are created via Azure CLI (not Bicep):

```bash
# Add sender username to email domain
az communication email domain sender-username create \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --sender-username admin \
  --username admin \
  --display-name "Fundrbolt Admin" \
  --resource-group fundrbolt-production-rg
```

Repeat for each sender address (DoNotReply, Legal, Privacy, DPO).

## Step 6: Store ACS Connection String in Key Vault

Securely store the connection string:

```bash
# Get connection string
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

## Step 7: Update Application Configuration

### Backend Environment Variables

Update App Service configuration:

```bash
az webapp config appsettings set \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --settings \
    EMAIL_PROVIDER="azure_communication_services" \
    ACS_CONNECTION_STRING="@Microsoft.KeyVault(SecretUri=https://fundrbolt-production-kv.vault.azure.net/secrets/acs-connection-string/)" \
    EMAIL_FROM="noreply@fundrbolt.app" \
    EMAIL_SUPPORT="support@fundrbolt.app" \
    EMAIL_BILLING="billing@fundrbolt.app"
```

### Backend Code Integration

Update `backend/app/services/email_service.py`:

```python
from azure.communication.email import EmailClient

class EmailService:
    def __init__(self):
        self.client = EmailClient.from_connection_string(
            settings.ACS_CONNECTION_STRING
        )

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        from_address: str = "noreply@fundrbolt.app"
    ):
        message = {
            "senderAddress": from_address,
            "recipients": {
                "to": [{"address": to}]
            },
            "content": {
                "subject": subject,
                "plainText": body,
                "html": body  # Can also send HTML
            }
        }

        poller = self.client.begin_send(message)
        result = poller.result()
        return result
```

## Step 8: Test Email Delivery

### Send Test Email via Azure CLI

```bash
az communication email send \
  --sender "noreply@fundrbolt.app" \
  --subject "Test Email from Fundrbolt Platform" \
  --text "This is a test email to verify email configuration." \
  --to "your-email@example.com" \
  --connection-string "$ACS_CONNECTION_STRING"
```

### Test via Application

```bash
# SSH into App Service
az webapp ssh --name fundrbolt-production-api --resource-group fundrbolt-production-rg

# Test email sending
poetry run python -c "
from app.services.email_service import EmailService
import asyncio

async def test():
    service = EmailService()
    result = await service.send_email(
        to='your-email@example.com',
        subject='Test from Fundrbolt',
        body='Testing email configuration'
    )
    print(f'Message ID: {result.message_id}')

asyncio.run(test())
"
```

## Step 9: Verify Email Authentication Score

Use [mail-tester.com](https://www.mail-tester.com) to verify email authentication:

1. Get unique test email from mail-tester.com
2. Send test email to that address
3. Check score (target: 10/10 or 9/10+)

Check for:
- ✅ SPF: Pass
- ✅ DKIM: Pass
- ✅ DMARC: Pass
- ✅ Not blacklisted
- ✅ Valid SMTP setup

### Using mail-tester.com
```bash
# Get test address from https://www.mail-tester.com
TEST_EMAIL="test-abc123@srv1.mail-tester.com"

# Send test email
az communication email send \
  --sender "noreply@fundrbolt.app" \
  --subject "Authentication Test" \
  --text "Testing SPF, DKIM, and DMARC configuration" \
  --to "$TEST_EMAIL" \
  --connection-string "$ACS_CONNECTION_STRING"

# Check results at mail-tester.com
```

## Step 10: Monitor Email Delivery

### View Email Logs

```bash
# Check App Insights for email events
az monitor app-insights query \
  --app fundrbolt-production-insights \
  --resource-group fundrbolt-production-rg \
  --analytics-query "
    traces
    | where message contains 'email'
    | order by timestamp desc
    | take 100
  "
```

### Email Metrics

Monitor in Azure Portal:
- Communication Services → Metrics
- Email Services → Email status
- Track: Sent, Delivered, Bounced, Opened

### Common Email Headers

Example of properly configured email:
```
Received-SPF: pass
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
  d=fundrbolt.app; s=selector1-azurecomm-prod-net;
Authentication-Results: spf=pass smtp.mailfrom=fundrbolt.app;
  dkim=pass header.d=fundrbolt.app;
  dmarc=pass action=none header.from=fundrbolt.app;
```

## Troubleshooting

### Domain Verification Fails

**Issue**: Domain shows "Not Verified" status

**Solutions**:
```bash
# 1. Check DNS records are published
dig TXT fundrbolt.app
dig TXT _dmarc.fundrbolt.app
dig CNAME selector1-azurecomm-prod-net._domainkey.fundrbolt.app

# 2. Wait for DNS propagation (up to 48 hours)
# 3. Verify TXT record matches exactly
az communication email domain show \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg

# 4. Re-trigger verification
az communication email domain update \
  --email-service-name fundrbolt-production-email \
  --domain-name fundrbolt.app \
  --resource-group fundrbolt-production-rg
```

### Emails Landing in Spam

**Issue**: Emails delivered but marked as spam

**Solutions**:
1. **Check authentication score** (mail-tester.com should be 9+/10)
2. **Warm up your domain**: Start with low volume, gradually increase
3. **Review email content**: Avoid spam trigger words
4. **Set up reverse DNS** (PTR record)
5. **Monitor bounce rates**: Keep < 5%
6. **Add unsubscribe link**: Required for bulk email

### High Bounce Rate

**Issue**: Many emails bouncing back

**Solutions**:
- Validate email addresses before sending
- Maintain clean email list
- Remove invalid addresses after 2-3 bounces
- Check bounce reasons in ACS logs

### Slow Delivery

**Issue**: Emails taking > 30 seconds to deliver

**Solutions**:
```bash
# Check ACS service health
az communication show \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg \
  --query "provisioningState"

# Review Application Insights for errors
# Check network connectivity from App Service
```

### Connection String Invalid

**Issue**: Authentication errors when sending

**Solutions**:
```bash
# Rotate connection string
az communication regenerate-key \
  --name fundrbolt-production-acs \
  --resource-group fundrbolt-production-rg \
  --key-type primary

# Update Key Vault secret
# Restart App Service
```

## Email Templates

Recommended email templates for common scenarios:

### Welcome Email
```python
subject = "Welcome to Fundrbolt Platform"
body = """
Hello {name},

Welcome to Fundrbolt! Your account has been successfully created.

Get started:
- Complete your profile
- Explore features
- Contact support: support@fundrbolt.app

Best regards,
The Fundrbolt Team
"""
```

### Password Reset
```python
subject = "Reset Your Fundrbolt Password"
body = """
Hello {name},

You requested to reset your password. Click the link below:

{reset_link}

This link expires in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The Fundrbolt Team
"""
```

### Email Verification
```python
subject = "Verify Your Email Address"
body = """
Hello {name},

Please verify your email address by clicking:

{verification_link}

This link expires in 24 hours.

Best regards,
The Fundrbolt Team
"""
```

## Best Practices

1. **Use appropriate sender addresses**:
   - `DoNotReply@fundrbolt.app` for automated emails (no replies expected)
   - `admin@fundrbolt.app` for administrative communications
   - `Legal@fundrbolt.app` for terms updates and legal notices
   - `Privacy@fundrbolt.app` for GDPR/privacy requests
   - `DPO@fundrbolt.app` for data protection inquiries

2. **Email receiving vs sending**:
   - Azure Communication Services: **Sending only**
   - ImprovMX: **Receiving/forwarding only**
   - DoNotReply@ should **not** have forwarding (by design)

3. **Include unsubscribe links** for marketing emails

4. **Monitor bounce and complaint rates**:
   - Bounce rate: < 5%
   - Complaint rate: < 0.1%

5. **Implement rate limiting**:
   - Max 100 emails/min per sender (ACS free tier limit)
   - Warm up new domains gradually

6. **Use email templates** for consistency

7. **Track email metrics**:
   - Delivery rate
   - Open rate (if tracking enabled)
   - Click rate (if tracking enabled)
   - Bounce rate

## Cost Optimization

**ACS Email Pricing** (as of 2024):
- First 100 emails/month: Free
- Additional emails: $0.0012 per email

**Estimated monthly cost**:
- 1,000 emails: $1.08
- 10,000 emails: $11.88
- 100,000 emails: $119.88

**Tips**:
- Batch emails when possible
- Use transactional emails only (avoid marketing spam)
- Implement email preferences
- Remove bounced addresses

## Security Considerations

1. **Store connection strings in Key Vault** (never in code)
2. **Use managed identities** where possible
3. **Rotate connection strings** quarterly
4. **Monitor for anomalous sending patterns**
5. **Implement rate limiting** to prevent abuse
6. **Log all email sending** for audit trail

## Next Steps

- Set up DNS records: [DNS Configuration Guide](./dns-configuration.md)
- Configure monitoring: [Monitoring Guide](./monitoring.md)
- Review security: [Security Checklist](./security-checklist.md)

## References

- [Azure Communication Services Documentation](https://docs.microsoft.com/en-us/azure/communication-services/)
- [Email Authentication Best Practices](https://docs.microsoft.com/en-us/microsoft-365/security/office-365-security/email-authentication-about)
- [SPF Record Syntax](https://www.rfc-editor.org/rfc/rfc7208)
- [DKIM Specification](https://www.rfc-editor.org/rfc/rfc6376)
- [DMARC Guide](https://dmarc.org/overview/)
- [Mail Tester](https://www.mail-tester.com/)

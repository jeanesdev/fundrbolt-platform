# Email Architecture Summary

**Last Updated**: 2025-10-31
**Environment**: Development (fundrbolt-dev-rg)
**Domain**: fundrbolt.com

## Overview

The Fundrbolt platform uses a **hybrid email architecture** combining Azure Communication Services for sending and ImprovMX for receiving/forwarding emails.

## Architecture Components

### Email Sending: Azure Communication Services

- **Service**: fundrbolt-dev-acs (Azure Communication Services)
- **Email Service**: fundrbolt-dev-email
- **Domain**: fundrbolt.com (CustomerManaged)
- **Status**: Verified (Domain, SPF, DKIM all verified)
- **Cost**: FREE (up to 100 emails/month on free tier)
- **Authentication Score**: 10/10 on mail-tester.com

### Email Receiving: ImprovMX

- **Service**: ImprovMX (third-party email forwarding)
- **MX Records**: mx1.improvmx.com (priority 10), mx2.improvmx.com (priority 20)
- **Forwarding Target**: jeanes.dev@gmail.com
- **Cost**: FREE (unlimited forwarding, up to 10 aliases)
- **Configuration**: https://improvmx.com/

### Why This Architecture?

1. **Azure doesn't provide email receiving**: ACS only handles outbound emails
2. **Cost-effective**: Both services free for our usage volume
3. **No infrastructure changes**: ImprovMX works with Azure DNS (unlike CloudFlare Email Routing which requires nameserver changes)
4. **Excellent deliverability**: 10/10 authentication score achieved

## DNS Configuration

### Current DNS Records (fundrbolt.com)

```
Type    Name                                          Value                                           TTL
----    ----                                          -----                                           ---
TXT     @                                             fundrbolt-domain-verification                       3600
TXT     @                                             ms-domain-verification=a809df6d-4ccc-4afb...    3600
TXT     @                                             v=spf1 include:spf.protection.outlook.com ~all  3600
TXT     _dmarc                                        v=DMARC1; p=quarantine; rua=mailto:dmarc@...   3600
CNAME   selector1-azurecomm-prod-net._domainkey       selector1-azurecomm-prod-net._domainkey.azu...  3600
CNAME   selector2-azurecomm-prod-net._domainkey       selector2-azurecomm-prod-net._domainkey.azu...  3600
MX      @                                             10 mx1.improvmx.com                             3600
MX      @                                             20 mx2.improvmx.com                             3600
```

### DNS Authentication Details

- **SPF**: `v=spf1 include:spf.protection.outlook.com ~all`
  - Authorizes Azure Communication Services to send emails
  - ImprovMX not included (doesn't send, only forwards)

- **DKIM**: Two CNAME selectors pointing to Azure's DKIM keys
  - selector1-azurecomm-prod-net._domainkey
  - selector2-azurecomm-prod-net._domainkey

- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@fundrbolt.com; pct=100; fo=1`
  - Policy: Quarantine suspicious emails
  - Reports sent to dmarc@fundrbolt.com

- **MX**: Points to ImprovMX servers for incoming email

## Email Addresses

### Configured Sender Addresses (Azure ACS)

| Address | Purpose | Can Send? | Can Receive? |
|---------|---------|-----------|--------------|
| DoNotReply@fundrbolt.com | Automated system emails | ✅ Yes | ❌ No (by design) |
| admin@fundrbolt.com | Administrative communications | ✅ Yes | ✅ Yes (forwards to Gmail) |
| Legal@fundrbolt.com | Legal inquiries, terms updates | ✅ Yes | ✅ Yes (forwards to Gmail) |
| Privacy@fundrbolt.com | Privacy requests, GDPR | ✅ Yes | ✅ Yes (forwards to Gmail) |
| DPO@fundrbolt.com | Data Protection Officer | ✅ Yes | ✅ Yes (forwards to Gmail) |

### ImprovMX Forwarding Configuration

All emails to the following addresses are forwarded to `jeanes.dev@gmail.com`:

- admin@fundrbolt.com
- Legal@fundrbolt.com
- Privacy@fundrbolt.com
- DPO@fundrbolt.com

**DoNotReply@fundrbolt.com** is intentionally excluded from forwarding (no-reply by design).

## Email Flow Diagrams

### Outbound Email (Sending)

```
Application Code
    ↓
ACS Connection String (from Key Vault)
    ↓
Azure Communication Services (fundrbolt-dev-acs)
    ↓
SPF/DKIM/DMARC Authentication
    ↓
Recipient's Mail Server
    ↓
Recipient's Inbox
```

### Inbound Email (Receiving)

```
Sender's Email Client
    ↓
DNS MX Lookup (mx1.improvmx.com)
    ↓
ImprovMX Servers
    ↓
Email Forwarding Rules
    ↓
jeanes.dev@gmail.com
```

## Security & Authentication

### Connection String Storage

- Stored in: fundrbolt-dev-kv (Azure Key Vault)
- Secret name: acs-connection-string
- Access: App Service uses Managed Identity to retrieve
- Rotation: Manual (quarterly recommended)

### Email Authentication Verification

**Mail-tester.com Score**: 10/10 ✅

Verified checks:
- ✅ SPF: Pass (Azure IPs authorized)
- ✅ DKIM: Pass (Azure selectors verified)
- ✅ DMARC: Pass (policy enforced)
- ✅ Not blacklisted
- ✅ Valid SMTP setup
- ✅ Proper DNS configuration

## Testing

### Test Email Sending

```bash
# Get connection string from Key Vault
ACS_CONNECTION_STRING=$(az keyvault secret show \
  --vault-name fundrbolt-dev-kv \
  --name acs-connection-string \
  --query value -o tsv)

# Send test email
az communication email send \
  --sender "DoNotReply@fundrbolt.com" \
  --subject "Test Email" \
  --text "Testing Azure Communication Services" \
  --to "test@example.com" \
  --connection-string "$ACS_CONNECTION_STRING"
```

### Test Email Receiving

```bash
# From personal email, send to:
echo "Test receiving" | mail -s "Test" admin@fundrbolt.com

# Should appear in jeanes.dev@gmail.com inbox within 5-15 minutes
```

### Test Authentication Score

```bash
# Get test email from https://www.mail-tester.com
TEST_EMAIL="test-abc123@srv1.mail-tester.com"

# Send test
az communication email send \
  --sender "admin@fundrbolt.com" \
  --subject "Authentication Test" \
  --text "Testing SPF/DKIM/DMARC" \
  --to "$TEST_EMAIL" \
  --connection-string "$ACS_CONNECTION_STRING"

# Check score at mail-tester.com (target: 10/10)
```

## Scripts

### Email Setup Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `infrastructure/scripts/add-email-to-dev.sh` | Deploy ACS to dev environment | ✅ Used |
| `infrastructure/scripts/configure-email-dns.sh` | Add DNS records for email auth | ✅ Used |
| `infrastructure/scripts/verify-email-domain.sh` | Check domain verification status | ✅ Used |
| `infrastructure/scripts/test-email.sh` | Send test emails via ACS | ✅ Used |
| `infrastructure/scripts/setup-improvmx-forwarding.sh` | Configure ImprovMX MX records | ✅ Used |
| `infrastructure/scripts/setup-email-forwarding.sh.cloudflare-archived` | CloudFlare Email Routing (archived) | ❌ Not used |

## Migration History

### CloudFlare Email Routing (Abandoned)

**Why we tried it**: CloudFlare offers free email forwarding

**Why we abandoned it**: CloudFlare Email Routing requires changing nameservers from Azure DNS to CloudFlare DNS, which would:
- Break Azure DNS zone integration
- Require migrating all DNS records
- Lose tight integration with Azure infrastructure
- Add unnecessary complexity

### ImprovMX (Current Solution)

**Why we chose it**:
- Works with Azure DNS (no nameserver changes)
- Completely free (up to 10 aliases)
- Simple setup (just MX records)
- Reliable forwarding service
- No account required initially

## Cost Analysis

### Current Costs

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Azure Communication Services | < 100 emails/month | $0.00 (free tier) |
| ImprovMX | Unlimited forwarding | $0.00 (free plan) |
| Azure DNS Zone | 1 zone | ~$0.50 |
| **Total** | | **~$0.50/month** |

### Projected Costs (1,000 emails/month)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Azure Communication Services | 1,000 emails | $1.08 ($0.0012/email after 100) |
| ImprovMX | Unlimited forwarding | $0.00 |
| Azure DNS Zone | 1 zone | ~$0.50 |
| **Total** | | **~$1.58/month** |

## Troubleshooting

### Email Not Sending

1. Check ACS connection string in Key Vault
2. Verify domain status: `./infrastructure/scripts/verify-email-domain.sh dev`
3. Check App Service logs for errors
4. Test directly via Azure CLI

### Email Not Being Received

1. Verify MX records: `nslookup -type=MX fundrbolt.com`
2. Check ImprovMX dashboard for forwarding rules
3. Verify Gmail address in ImprovMX is confirmed
4. Check spam folder in Gmail
5. Wait 5-15 minutes for DNS propagation

### Low Authentication Score

1. Verify SPF record: `nslookup -type=TXT fundrbolt.com`
2. Verify DKIM CNAMEs: `nslookup -type=CNAME selector1-azurecomm-prod-net._domainkey.fundrbolt.com`
3. Verify DMARC: `nslookup -type=TXT _dmarc.fundrbolt.com`
4. Re-test on mail-tester.com

## Production Deployment Notes

When deploying to production (fundrbolt-production-rg):

1. **Update environment parameter**: All scripts accept `--env production`
2. **Use production Key Vault**: fundrbolt-production-kv
3. **Create production sender addresses**: Same usernames in production ACS
4. **Configure ImprovMX**: Add fundrbolt.com with production MX records
5. **Test thoroughly**: Use mail-tester.com before going live
6. **Monitor deliverability**: Track bounce rates, spam complaints

## References

- [Azure Communication Services Documentation](https://docs.microsoft.com/en-us/azure/communication-services/)
- [ImprovMX Documentation](https://improvmx.com/guides/)
- [Email Configuration Guide](./email-configuration.md)
- [DNS Configuration Guide](./dns-configuration.md)
- [Mail Tester](https://www.mail-tester.com/)

## Changelog

- **2025-10-31**: Initial setup in dev environment
  - Deployed Azure Communication Services
  - Configured SPF, DKIM, DMARC authentication
  - Achieved 10/10 mail-tester score
  - Set up ImprovMX email forwarding
  - Archived CloudFlare Email Routing approach
  - Created 5 sender addresses
  - Documented complete email architecture

# DNS Configuration Guide

This guide explains how to configure custom domains for the Fundrbolt platform using Azure DNS.

## Overview

The Fundrbolt platform uses Azure DNS to manage custom domain records for:
- **Frontend**: `admin.fundrbolt.com` (Static Web App)
- **Backend API**: `api.fundrbolt.com` (App Service)
- **Root domain**: `fundrbolt.com` (redirects to admin)
- **Email**: Email sending via Azure Communication Services

## Domain Registration

**Domain**: `fundrbolt.com`
- **Registrar**: Namecheap
- **Registration Date**: October 28, 2025
- **Expiration Date**: October 28, 2026
- **Auto-Renewal**: Enabled
- **Cost**: ~$10-15/year

## Prerequisites

- Custom domain registered with a domain registrar (e.g., Namecheap, GoDaddy, Google Domains)
- Azure DNS Zone deployed via Bicep (included in production deployment)
- Access to domain registrar's DNS management console

## Step 1: Deploy Azure DNS Zone

The DNS Zone is automatically created when deploying to production with `customDomain` parameter:

```bash
# Deploy infrastructure with custom domain
./infrastructure/scripts/provision.sh production <postgres-password>

# Or using Azure CLI directly
az deployment sub create \
  --location eastus \
  --template-file infrastructure/bicep/main.bicep \
  --parameters production.bicepparam \
  --parameters postgresAdminPassword="<secure-password>"
```

## Step 2: Retrieve Azure Nameservers

After deployment, get the nameservers assigned by Azure:

```bash
# Get nameservers from deployment output
az deployment sub show \
  --name fundrbolt-production-<timestamp> \
  --query properties.outputs.nameServers.value

# Or query the DNS Zone directly
az network dns zone show \
  --name fundrbolt.com \
  --resource-group fundrbolt-production-rg \
  --query nameServers
```

Example output:
```json
[
  "ns1-01.azure-dns.com",
  "ns2-01.azure-dns.net",
  "ns3-01.azure-dns.org",
  "ns4-01.azure-dns.info"
]
```

## Step 3: Update Nameservers at Domain Registrar

Configure your domain registrar to use Azure DNS nameservers:

### Namecheap
1. Login to Namecheap account
2. Navigate to Domain List → Manage
3. Find "NAMESERVERS" section
4. Select "Custom DNS"
5. Enter all 4 Azure nameservers
6. Save changes

### GoDaddy
1. Login to GoDaddy account
2. Navigate to My Products → Domains
3. Click DNS next to your domain
4. Scroll to "Nameservers" section
5. Click "Change"
6. Select "Custom"
7. Enter all 4 Azure nameservers
8. Save

### Google Domains
1. Login to Google Domains
2. Select your domain
3. Click DNS in left sidebar
4. Scroll to "Name servers"
5. Select "Use custom name servers"
6. Enter all 4 Azure nameservers
7. Save

### Cloudflare
**Note**: If using Cloudflare, you should keep Cloudflare's nameservers and add DNS records in Cloudflare instead of Azure DNS.

## Step 4: Verify Nameserver Propagation

DNS propagation typically takes 24-48 hours. Check status:

```bash
# Check nameservers (should show Azure nameservers)
dig NS fundrbolt.com

# Check from multiple locations
# https://www.whatsmydns.net/#NS/fundrbolt.com

# Verify specific nameserver responds
dig @ns1-01.azure-dns.com fundrbolt.com
```

## Step 5: Configure DNS Records

Once nameservers are propagated, Azure DNS will manage all records. The following records are automatically created by Bicep:

### A Records
```
@    A    3600    <Static-Web-App-IP>    # Root domain
```

### CNAME Records
```
www      CNAME  3600  fundrbolt.com                              # WWW redirect
admin    CNAME  3600  fundrbolt-production-admin.azurestaticapps.net  # Admin portal
api      CNAME  3600  fundrbolt-production-api.azurewebsites.net      # Backend API
```

### TXT Records (Verification)
```
@    TXT    3600    "fundrbolt-domain-verification"    # Domain ownership
```

### MX Records (Email - configured with ACS)
```
@    MX    3600    10 fundrbolt-app.mail.protection.outlook.com    # Email routing
```

## Step 6: Configure Custom Domains on Azure Services

### App Service (Backend API)

1. **Add custom domain**:
```bash
az webapp config hostname add \
  --webapp-name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --hostname api.fundrbolt.com
```

2. **Enable SSL/TLS** (automatic):
```bash
az webapp config ssl bind \
  --name fundrbolt-production-api \
  --resource-group fundrbolt-production-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

3. **Verify**:
```bash
curl https://api.fundrbolt.com/health
```

### Static Web App (Frontend)

1. **Add custom domain**:
```bash
az staticwebapp hostname set \
  --name fundrbolt-production-admin \
  --resource-group fundrbolt-production-rg \
  --hostname admin.fundrbolt.com
```

2. **SSL certificate** (automatic via Let's Encrypt)

3. **Verify**:
```bash
curl -I https://admin.fundrbolt.com
```

## Step 7: Update Application Configuration

Update environment variables to use custom domains:

### Backend (.env or App Service config)
```bash
CORS_ORIGINS=https://admin.fundrbolt.com,https://fundrbolt.com
FRONTEND_URL=https://admin.fundrbolt.com
```

### Frontend (.env.production)
```bash
VITE_API_URL=https://api.fundrbolt.com/api/v1
```

## DNS Record Reference

| Type  | Name       | Value                                    | TTL  | Purpose                |
|-------|------------|------------------------------------------|------|------------------------|
| A     | @          | Static Web App IP                        | 3600 | Root domain            |
| CNAME | www        | fundrbolt.com                                | 3600 | WWW redirect           |
| CNAME | admin      | fundrbolt-production-admin.azurestaticapps.net | 3600 | Admin portal           |
| CNAME | api        | fundrbolt-production-api.azurewebsites.net   | 3600 | Backend API            |
| TXT   | @          | fundrbolt-domain-verification                | 3600 | Domain verification    |
| TXT   | @          | v=spf1 include:spf.azurecomm.net ~all    | 3600 | Email SPF              |
| TXT   | _dmarc     | v=DMARC1; p=quarantine; ...              | 3600 | Email DMARC            |
| CNAME | selector1  | <ACS-DKIM-value>                         | 3600 | Email DKIM signing     |
| CNAME | selector2  | <ACS-DKIM-value>                         | 3600 | Email DKIM signing     |
| MX    | @          | 10 fundrbolt-app.mail.protection.outlook.com | 3600 | Email routing          |

## Troubleshooting

### Nameservers not updating
- **Issue**: Domain still showing old nameservers after 48 hours
- **Solution**: Contact domain registrar support, verify nameserver format (no trailing dots)

### SSL certificate not provisioning
- **Issue**: SSL certificate fails to auto-provision
- **Solution**:
  - Verify DNS CNAME record is correct
  - Wait 15-30 minutes for validation
  - Check App Service logs for validation errors

### Domain verification fails
- **Issue**: Azure can't verify domain ownership
- **Solution**:
  - Check TXT record propagation: `dig TXT fundrbolt.com`
  - Verify TXT value matches Azure's verification token
  - Wait for DNS propagation (up to 48 hours)

### 404 errors after custom domain setup
- **Issue**: Domain resolves but returns 404
- **Solution**:
  - Verify custom domain added in Azure Portal
  - Check Static Web App configuration
  - Restart App Service

### Email not working
- **Issue**: Emails not sending or landing in spam
- **Solution**: See [Email Configuration Guide](./email-configuration.md)

## Monitoring

### DNS Health Checks

```bash
# Check all DNS records
dig ANY fundrbolt.com

# Check specific record types
dig A fundrbolt.com
dig CNAME admin.fundrbolt.com
dig MX fundrbolt.com
dig TXT fundrbolt.com

# Check from specific nameserver
dig @ns1-01.azure-dns.com fundrbolt.com

# Trace DNS resolution
dig +trace fundrbolt.com
```

### SSL Certificate Expiration

Azure automatically renews Let's Encrypt certificates. Monitor in Azure Portal:
- App Service → Custom domains → SSL certificates
- Static Web App → Custom domains → Certificate status

### Alerts

Set up Azure Monitor alerts for:
- DNS query failures
- SSL certificate expiration (30 days warning)
- Custom domain health check failures

## Cost Considerations

**Azure DNS Pricing** (as of 2024):
- Hosted DNS zones: $0.50/zone/month (first 25 zones)
- DNS queries: $0.40 per million queries (first 1 billion)

**Estimated monthly cost**:
- 1 DNS zone: $0.50
- 10 million queries: $4.00
- **Total**: ~$4.50/month

## Security Best Practices

1. **Enable DNSSEC** (when available):
```bash
az network dns zone update \
  --name fundrbolt.com \
  --resource-group fundrbolt-production-rg \
  --enable-dnssec
```

2. **Use CAA records** to restrict certificate issuance:
```bash
az network dns record-set caa add-record \
  --zone-name fundrbolt.com \
  --resource-group fundrbolt-production-rg \
  --record-set-name @ \
  --flags 0 \
  --tag issue \
  --value letsencrypt.org
```

3. **Monitor DNS changes** via Azure Activity Log

4. **Restrict DNS zone permissions** using Azure RBAC

## Next Steps

- Configure email services: [Email Configuration Guide](./email-configuration.md)
- Set up monitoring: [Monitoring Guide](./monitoring.md)
- Review security: [Security Checklist](./security-checklist.md)

## References

- [Azure DNS Documentation](https://docs.microsoft.com/en-us/azure/dns/)
- [App Service Custom Domains](https://docs.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain)
- [Static Web Apps Custom Domains](https://docs.microsoft.com/en-us/azure/static-web-apps/custom-domain)
- [DNS Propagation Checker](https://www.whatsmydns.net/)

# Email Testing for Dev Environment - Quick Start

Since you've only run `deploy-minimal.sh`, you have two options for testing email functionality:

## 🎯 Recommended: Option 1 - Local Email Testing (FREE, No Azure Costs)

**Best for**: Development, testing email templates, debugging email flows

### Setup (2 minutes)
```bash
# Start MailHog (local email testing tool)
./infrastructure/scripts/setup-local-email-testing.sh
```

This runs a local SMTP server that captures all emails and displays them in a web UI.

### Configure Backend
Add to your `backend/.env`:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
EMAIL_FROM=noreply@fundrbolt.com
```

### Test Emails
1. Open http://localhost:8025 in your browser
2. Send an email from your application
3. View the captured email in MailHog UI

**Pros**:
- ✅ Completely free
- ✅ No Azure setup needed
- ✅ Instant email delivery
- ✅ View email HTML/text versions
- ✅ No DNS configuration required
- ✅ Perfect for local development

**Cons**:
- ❌ Emails don't actually send (captured locally)
- ❌ Can't test deliverability/spam filters
- ❌ Can't test SPF/DKIM/DMARC authentication

---

## 📧 Option 2 - Azure Communication Services (100 emails/month FREE)

**Best for**: Testing real email delivery, authentication, deliverability

### Step 1: Add ACS to Your Dev Environment
```bash
# Deploy Azure Communication Services to dev (FREE tier)
./infrastructure/scripts/add-email-to-dev.sh
```

**Cost**: FREE for first 100 emails/month, then $0.0012/email

### Step 2: Configure DNS for Custom Domain
```bash
# Add DNS records for email authentication
./infrastructure/scripts/configure-email-dns.sh dev
```

### Step 3: Wait for DNS Propagation (10-30 minutes)
```bash
# Check DNS and verification status
./infrastructure/scripts/verify-email-domain.sh dev
```

### Step 4: Send Test Email
```bash
# Send real test email
./infrastructure/scripts/test-email.sh --env dev your-email@example.com
```

**Pros**:
- ✅ Real email sending
- ✅ Test deliverability
- ✅ Verify SPF/DKIM/DMARC authentication
- ✅ 100 free emails/month
- ✅ Test with mail-tester.com

**Cons**:
- ⚠️ Requires DNS configuration
- ⚠️ 10-30 min DNS propagation wait
- ⚠️ Costs $0.0012/email after 100 emails/month

---

## 🤔 Which Option Should You Choose?

### Use Option 1 (MailHog) if you want to:
- Develop and test email templates locally
- Debug email sending logic
- Avoid Azure costs during development
- Get instant feedback on email content

### Use Option 2 (Azure ACS) if you want to:
- Test real email delivery
- Verify emails reach inbox (not spam)
- Test email authentication (SPF, DKIM, DMARC)
- Prepare for production deployment

### Pro Tip: Use Both! 🎉
- **Local development**: Use MailHog
- **Pre-production testing**: Use Azure ACS with dev environment
- **Production**: Use Azure ACS with production environment

---

## Quick Commands Reference

### Local Email Testing (MailHog)
```bash
# Start MailHog
./infrastructure/scripts/setup-local-email-testing.sh

# View emails
open http://localhost:8025

# Stop MailHog
docker stop mailhog
```

### Azure Communication Services (Dev)
```bash
# Deploy ACS to dev environment
./infrastructure/scripts/add-email-to-dev.sh

# Configure DNS
./infrastructure/scripts/configure-email-dns.sh dev

# Verify domain
./infrastructure/scripts/verify-email-domain.sh dev

# Send test email
./infrastructure/scripts/test-email.sh --env dev your@email.com
```

---

## Cost Summary

| Option | Monthly Cost | Setup Time |
|--------|-------------|------------|
| MailHog (Local) | **$0.00** | 2 minutes |
| Azure ACS (Dev) | **$0.00** (up to 100 emails) | 30 minutes |
| Azure ACS (Production) | $0.0012/email after 100 free | 30 minutes |

---

## Next Steps

1. **For immediate testing**: Start with MailHog
   ```bash
   ./infrastructure/scripts/setup-local-email-testing.sh
   ```

2. **To test real delivery later**: Add ACS to dev
   ```bash
   ./infrastructure/scripts/add-email-to-dev.sh
   ```

3. **For production**: Deploy full infrastructure
   ```bash
   ./infrastructure/scripts/provision.sh production <postgres-password>
   ```

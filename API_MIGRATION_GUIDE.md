# Fundrbolt Platform - API Consumer Migration Guide

**Effective Date**: December 18, 2025
**Audience**: External API consumers, integrations partners, webhook subscribers
**Version**: 1.0

## Executive Summary

The Augeo Platform has been rebranded to **Fundrbolt Platform**. This document details the minimal changes required for external API consumers. **Good news**: there are NO breaking API changes.

## API Changes Summary

### ✅ No Breaking Changes

| Aspect | Status | Notes |
|--------|--------|-------|
| **API Endpoints** | ✅ Unchanged | All routes remain the same |
| **Request Format** | ✅ Unchanged | Request body/params unchanged |
| **Response Format** | ✅ Unchanged | Response structure unchanged |
| **Authentication** | ✅ Unchanged | OAuth2/JWT still work identically |
| **Data Format** | ✅ Unchanged | JSON structure and types identical |
| **Rate Limiting** | ✅ Unchanged | Limits remain the same |
| **Webhooks** | ✅ Backward Compatible | Old URLs work; new content uses Fundrbolt branding |

### ⚠️ Minor Changes (Non-Breaking)

| Component | Old Value | New Value | Impact | Action Required |
|-----------|-----------|-----------|--------|-----------------|
| **Response Header** | `X-Powered-By: Augeo` | `X-Powered-By: Fundrbolt Platform` | Informational only | Optional: Update log parsing |
| **Email Sender** | `support@augeo.app` | `support@fundrbolt.app` | Email notifications | Update email filters |
| **Metrics Names** | `augeo_http_requests_total` | `fundrbolt_http_requests_total` | Prometheus monitoring | Update metric queries/dashboards |
| **OpenAPI Docs** | `/docs` title: "Augeo" | `/docs` title: "Fundrbolt" | Documentation reference | Update documentation links |

## Integration Checklist

### 1. Email Notifications

**If you receive email notifications** from the Fundrbolt API:

```bash
# ❌ OLD (may not work after cutover)
From: support@augeo.app

# ✅ NEW (effective immediately)
From: support@fundrbolt.app

# ACTION: Update email filters
```

**Recommended Action**:
```bash
# Update mail server filters
# Old: sender:support@augeo.app
# New: sender:support@fundrbolt.app

# Add new domain to whitelist
mail_whitelist += support@fundrbolt.app
```

### 2. Webhook Endpoints

**If you have registered webhooks** with Fundrbolt API:

- ✅ Webhook URLs remain active and functional
- ✅ Webhook event structure unchanged
- ⚠️ Event content may reference Fundrbolt branding (e.g., email subjects)

**Recommended Action**:
```javascript
// Old parsing (may fail if you relied on "Augeo" string)
if (email.subject.includes("Augeo")) { ... }

// New parsing (required if you used brand name matching)
if (email.subject.includes("Fundrbolt")) { ... }

// Better: Use more specific patterns
if (email.subject.includes("event") || email.subject.includes("confirmation")) { ... }
```

### 3. Metrics & Monitoring

**If you scrape Prometheus metrics** from `/metrics` endpoint:

```bash
# ❌ OLD (deprecated)
fundrbolt_http_requests_total{method="GET", path="/api/v1/events", status="200"}

# ✅ NEW (effective immediately)
fundrbolt_http_requests_total{method="GET", path="/api/v1/events", status="200"}

# Metric names changed prefix
# augeo_* → fundrbolt_*
```

**Recommended Action**:
```yaml
# Update Prometheus scrape configuration
job_name: 'fundrbolt-backend'
static_configs:
  - targets: ['api.fundrbolt.app:9090']
relabel_configs:
  - source_labels: [__address__]
    target_label: instance
    replacement: 'fundrbolt'

# Update metric queries
# Old: rate(augeo_http_requests_total[5m])
# New: rate(fundrbolt_http_requests_total[5m])
```

### 4. API Documentation References

**If you maintain documentation** linking to Fundrbolt API docs:

```bash
# ❌ OLD (may redirect)
https://api.augeo.app/docs

# ✅ NEW (canonical URL)
https://api.fundrbolt.app/docs

# If old domain used, 301 redirect applied (update links within 3 months)
```

**Recommended Action**:
```markdown
<!-- Update documentation links -->
- [API Reference](https://api.fundrbolt.app/docs)
- [Getting Started](https://fundrbolt.app/docs/getting-started)

<!-- If referencing version numbers, update -->
Old: "Augeo API v1.2.0"
New: "Fundrbolt API v1.2.0" (same API, only branding changed)
```

### 5. User-Facing Display

**If your application displays** the platform name to users:

```javascript
// ❌ OLD
const platformName = "Augeo Platform";

// ✅ NEW
const platformName = "Fundrbolt Platform";

// Update UI, emails, documentation, help text, error messages
```

**Recommended Action**:
```javascript
// Option 1: Update constant
export const PLATFORM_NAME = "Fundrbolt Platform";

// Option 2: Fetch from API (future-proof)
const { platform_name } = await fetch('/api/v1/config').then(r => r.json());

// Option 3: Use environment variable
const platformName = process.env.REACT_APP_PLATFORM_NAME || "Fundrbolt Platform";
```

## Testing Checklist

- [ ] API endpoints respond normally
- [ ] Request authentication still works (OAuth2/JWT)
- [ ] Response data structure unchanged
- [ ] Webhooks receive events
- [ ] Email notifications arrive from new sender (`support@fundrbolt.app`)
- [ ] Metrics endpoint (`/metrics`) returns `fundrbolt_*` metrics
- [ ] OpenAPI documentation loads at `/docs`
- [ ] No unexpected 404 errors
- [ ] Rate limiting still enforced
- [ ] Error responses have expected format

## Timeline & Support

| Date | Event |
|------|-------|
| **2025-12-18** | Phase 1-4 complete: Branding updated in code, infrastructure renamed |
| **2025-12-19** | Phase 5 complete: Documentation updated, this guide published |
| **2025-12-20** | Phase 6: Staging deployment, full testing |
| **2025-12-21** | Production deployment: Fundrbolt Platform live |
| **2026-01-21** | Old domain/email sunset (90-day grace period) |

## Troubleshooting

### Issue: "Email from unknown sender"
**Solution**: Whitelist new sender `support@fundrbolt.app` in your mail system

### Issue: "Metrics not found in Prometheus"
**Solution**: Update metric query from `augeo_*` to `fundrbolt_*` prefix

### Issue: "Webhook events stopped arriving"
**Solution**: Verify webhook URL is still registered and responding with HTTP 200

### Issue: "OpenAPI docs return 404"
**Solution**: Verify you're using new domain or that redirects are active

### Issue: "Old API endpoint not responding"
**Solution**: All endpoints unchanged; verify your client is using new domain

## Support

- **API Issues**: Open an issue at `https://github.com/jeanesdev/fundrbolt-platform`
- **Integration Help**: Email `devops@fundrbolt.app`
- **Documentation**: See `/docs` directory in repository

## FAQ

**Q: Will my API credentials still work?**
A: Yes, all authentication credentials remain valid.

**Q: Do I need to update my API client?**
A: Only if you use the old domain; update base URL if needed.

**Q: Are there breaking changes?**
A: No, this is a branding update only.

**Q: When should I update my integration?**
A: At your earliest convenience; old domain will redirect for 90 days.

**Q: What if I don't update?**
A: After the grace period (2026-01-21), old domains/emails may not work.

---

**Document Version**: 1.0
**Last Updated**: 2025-12-18
**Maintainer**: Fundrbolt Platform Team

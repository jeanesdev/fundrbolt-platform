# Phase 1: Data Model & Entity Changes - Fundrbolt to Fundrbolt Rename

**Date**: 2025-12-17
**Feature**: 013-fundrbolt-to-fundrbolt
**Status**: Complete

## Overview

This document captures any changes to data entities, database schemas, and configuration models required for the rename. Since the rename is purely branding (external name change) with no functional logic tied to product naming, **no database schema changes are required**. However, configuration models and external-facing metadata do require updates.

---

## Data Model Summary

### No Schema Changes

**Rationale**: The PostgreSQL database does not store the product name "Fundrbolt" or "Fundrbolt" in any data rows or schema. The product name is external branding applied to UI, documentation, and configuration only.

**Impact**: Zero risk of data corruption or loss.

---

## Configuration Models

### Application Configuration

**Entity**: `AppConfig` (in `app/core/config.py`)

| Field | Current | Updated | Notes |
|-------|---------|---------|-------|
| `PROJECT_NAME` | `"Fundrbolt Platform"` | `"Fundrbolt Platform"` | Used in OpenAPI docs and email templates |
| `PROJECT_DESCRIPTION` | `"Fundrbolt Fundraising..."` | `"Fundrbolt Fundraising..."` | OpenAPI, API responses |
| `CONTACT_EMAIL` | `support@fundrbolt.com` | `support@fundrbolt.com` | Support contact in API docs |
| `APP_NAME` | (if exists) | Updated to `"Fundrbolt"` | Used in logging, notifications |

**Handling**: Direct string replacement in config file; no migration needed.

---

## External-Facing Metadata

### OpenAPI/Swagger Documentation

**Location**: Auto-generated from FastAPI `FastAPI(title=..., description=...)`

**Changes**:
- Update `title` parameter: `"Fundrbolt Platform API"` → `"Fundrbolt Platform API"`
- Update `description`: Replace Fundrbolt branding
- Update `contact.name`, `contact.email` to Fundrbolt support

**Handling**: Update `app/main.py` FastAPI instantiation.

---

### PWA Manifest Files

**Location**: `frontend/*/public/manifest.json`

**Changes**:

```json
{
  "name": "Fundrbolt Admin",              // was "Fundrbolt Admin"
  "short_name": "Fundrbolt",              // was "Fundrbolt"
  "description": "Fundrbolt fundraising...", // update branding
  "start_url": "/",
  "icons": [...]                          // logos updated separately
}
```

**Handling**: Direct JSON text replacement; no logic changes.

---

### Email Templates

**Location**: Backend email service templates (SendGrid, Azure Communication Services)

**Changes**:
- Sender name: `"Fundrbolt Support"` → `"Fundrbolt Support"`
- Subject lines: Remove Fundrbolt branding, add Fundrbolt
- Body text: Brand name updates
- Logo/branding assets: Point to Fundrbolt logos (URL updates)

**Handling**: Update template text and image references; no schema changes.

---

## No Migration Script Required

**Reason**: No tables store the product name; configuration is external to data.

**If future changes needed**: Would create Alembic migration to update config tables, e.g.:
```python
def upgrade():
    # UPDATE config SET value = 'Fundrbolt' WHERE key = 'project_name'
    pass
```

---

## API Naming Changes

### Endpoints (No Changes to Path Structure)

**Decision** (per spec): All API endpoints remain at `/api/v1/*`; only internal identifiers and headers change.

**Examples**:
- `GET /api/v1/events` — unchanged
- `POST /api/v1/auth/login` — unchanged
- Response headers: `X-Powered-By: Fundrbolt` → `X-Powered-By: Fundrbolt`

**Handling**: Update any hardcoded response headers or metadata in middleware.

---

### Response Headers & Metadata

**Current**:
```
X-Powered-By: Fundrbolt Platform
X-API-Version: 1.0
```

**Updated**:
```
X-Powered-By: Fundrbolt Platform
X-API-Version: 1.0
```

**Handling**: Update middleware or response wrapper functions.

---

## Key Entities Unaffected

These entities remain structurally unchanged; only human-readable metadata updates:

| Entity | Fields | Rename Impact |
|--------|--------|---------------|
| User | email, name, role | No changes; user data independent of brand |
| Event | title, description, date | No changes; business data unaffected |
| Bid | item, amount, user_id | No changes; auction logic unchanged |
| NPO | name, contact | No changes; org data unaffected |
| Branding | (if exists) | Update description/label text only |
| AuditLog | action, user_id, timestamp | No changes; logs unaffected |

---

## Configuration-as-Code

### Environment Variables

**Updated**:
- `PROJECT_NAME=Fundrbolt`
- `SUPPORT_EMAIL=support@fundrbolt.com`
- `APP_DESCRIPTION=Fundrbolt fundraising platform...`

**Handling**: Update `.env.example` and deployment configs.

### Docker Compose Labels

**Current**:
```yaml
services:
  backend:
    labels:
      com.fundrbolt.project: "fundrbolt-platform"
      com.fundrbolt.service: "api"
```

**Updated**:
```yaml
services:
  backend:
    labels:
      com.fundrbolt.project: "fundrbolt-platform"
      com.fundrbolt.service: "api"
```

**Handling**: Update `docker-compose.yml` file.

---

## Validation & Testing

### Data Integrity
- **Pre-rename snapshot**: Verify row counts and key checksums
- **Post-rename verification**: Run same queries; confirm counts match
- **Sample data spot-check**: Ensure no accidental truncation or corruption

### Configuration Tests
- **OpenAPI docs load**: Verify Swagger UI loads with new branding
- **Email templates render**: Test email sends with new branding
- **PWA manifest valid**: Verify JSON is valid and browser recognizes app name

### No Schema Tests Needed
- No columns added/removed
- No new tables
- No foreign key changes

---

## Rollback Plan

Since this is pre-production and no data migration occurs:

1. **Quick Rollback**: Revert code changes, restart services
2. **No DB Rollback Required**: Data unaffected
3. **Infra Rollback**: Redeploy old Bicep templates if infrastructure was updated

---

## Conclusion

The rename is purely a branding/configuration update. **No database schema migration is required.** All changes are textual updates to configuration files, metadata, and documentation. This significantly reduces risk and complexity compared to a typical data model change.

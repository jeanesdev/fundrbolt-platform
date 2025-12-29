# Research: Event Sponsors

**Feature**: 007-sponsors
**Date**: 2025-11-12
**Status**: Complete

## Overview

This document consolidates research findings and technical decisions for implementing event sponsor management functionality. The research phase resolves all technical unknowns and establishes the implementation approach.

## Technical Decisions

### Decision 1: Logo Storage and Upload Pattern

**Chosen Approach**: Reuse existing EventMedia pattern with Azure Blob Storage SAS URLs

**Rationale**:

- Existing MediaService provides battle-tested Azure Blob Storage integration
- Pre-signed SAS URL pattern (request URL → client upload → confirm) already implemented
- FileUploadService has image validation (size, format, dimensions) logic
- Consistent with existing event media uploads (logos, flyers, images)
- Reduces code duplication and maintenance burden

**Alternatives Considered**:

1. **Direct server-side upload**: Rejected - requires passing large files through backend, increases memory usage and latency
2. **New SponsorMediaService**: Rejected - unnecessary duplication, MediaService patterns are reusable
3. **CDN-only storage**: Rejected - requires different infrastructure, Azure Blob already configured

**Implementation Notes**:

- Create `SponsorLogoService` that wraps FileUploadService for sponsor-specific logic
- Use `npo_id` as folder prefix: `sponsors/{npo_id}/{sponsor_id}/{filename}`
- Generate thumbnails at upload confirmation (128x128 for list view, original for full display)
- Store both `logo_url` (full size) and `thumbnail_url` in Sponsor model

---

### Decision 2: Logo Size Enum Implementation

**Chosen Approach**: Store enum value in database, apply CSS classes in frontend

**Rationale**:

- Backend stores: `logo_size` as ENUM('xsmall', 'small', 'medium', 'large', 'xlarge') with default 'large'
- Frontend applies CSS classes that control display dimensions
- Logo size defines visual hierarchy on sponsor display page/widget
- Size maps to pixel dimensions: xsmall=64px, small=96px, medium=128px, large=192px, xlarge=256px

**Alternatives Considered**:

1. **Store pixel dimensions**: Rejected - less semantic, requires frontend to interpret numbers
2. **Store only in frontend**: Rejected - business requirement is data-driven sponsor tiers
3. **T-shirt sizes (S/M/L/XL)**: Rejected - spec explicitly uses xsmall/small/medium/large/xlarge

**Implementation Notes**:

- Python: `LogoSize` enum with values matching spec
- TypeScript: Mirror enum values for type safety
- Frontend: Tailwind CSS classes or CSS variables for size mapping
- Default to 'large' if not specified

---

### Decision 3: Thumbnail Generation Strategy

**Chosen Approach**: Server-side thumbnail generation at upload confirmation using Pillow

**Rationale**:

- Pillow already used in FileUploadService for image validation
- Generate thumbnail immediately after upload confirmation (before virus scan)
- Store thumbnail as separate blob: `sponsors/{npo_id}/{sponsor_id}/thumbnail-{filename}`
- 128x128 fixed size with aspect ratio preservation, letterboxing if needed
- Faster list rendering with smaller images

**Alternatives Considered**:

1. **Client-side thumbnail**: Rejected - inconsistent quality, browser-dependent
2. **On-the-fly resize**: Rejected - adds latency, requires image processing service
3. **CDN automatic resize**: Rejected - not configured, adds complexity

**Implementation Notes**:

- Add thumbnail generation to SponsorLogoService.confirm_upload()
- Use Pillow.Image.thumbnail() with LANCZOS filter
- Store thumbnail_url alongside logo_url in Sponsor model
- Thumbnail generation failure should not block upload (fallback to full logo)

---

### Decision 4: Data Model Structure

**Chosen Approach**: Single `sponsors` table with embedded contact/address fields

**Rationale**:

- Sponsor contact info is 1:1 relationship (one contact per sponsor)
- No requirement to share contacts across sponsors or events
- Simpler queries without joins
- JSON columns not needed - all fields are primitive types

**Alternatives Considered**:

1. **Separate SponsorContact table**: Rejected - unnecessary normalization, adds join complexity
2. **JSON column for address**: Rejected - loses type safety and query ability
3. **Separate Address table**: Rejected - over-engineering for simple address storage

**Schema** (see data-model.md for full details):

```sql
CREATE TABLE sponsors (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    logo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    website_url VARCHAR(500),
    logo_size VARCHAR(20) NOT NULL DEFAULT 'large',
    sponsor_level VARCHAR(100),
    contact_name VARCHAR(200),
    contact_email VARCHAR(200),
    contact_phone VARCHAR(20),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    donation_amount DECIMAL(12, 2),
    notes TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    INDEX idx_sponsors_event_id (event_id),
    INDEX idx_sponsors_display_order (event_id, display_order)
);
```

---

### Decision 5: Permission Model

**Chosen Approach**: Reuse existing event permission patterns

**Rationale**:

- Sponsor management follows same permissions as EventMedia, EventLinks, FoodOptions
- Event organizers (role=NPO_ADMIN, NPO_STAFF for their NPO) can manage sponsors
- Use existing `PermissionService.can_manage_event()` check
- Audit log entries for sponsor create/update/delete

**Alternatives Considered**:

1. **Sponsor-specific permissions**: Rejected - unnecessary granularity
2. **Public sponsor editing**: Rejected - violates security model
3. **Separate sponsor admin role**: Rejected - not in requirements

**Implementation Notes**:

- Dependency injection: `Depends(require_event_permissions)`
- Audit logging: `AuditService.log_sponsor_action()`
- Created_by field tracks user who added sponsor

---

### Decision 6: Frontend Tab Integration

**Chosen Approach**: Add "Sponsors" tab to existing event detail tabs array

**Rationale**:

- EventDetail component already has tabs for Overview, Media, Links, Food Options
- Sponsors tab follows same pattern: tab button + conditional render
- Reuse existing tab styling and navigation logic
- Sponsors loaded lazily when tab is activated

**Alternatives Considered**:

1. **Separate sponsor page/route**: Rejected - breaks UX consistency
2. **Accordion/expandable section**: Rejected - tabs are established pattern
3. **Modal-based management**: Rejected - limits space for sponsor list

**Implementation Notes**:

- Update `EventDetailTabs` component to include Sponsors tab
- Create `<SponsorsTab>` component with list + add/edit forms
- Use same loading/error patterns as other tabs
- Fetch sponsors on tab activation, cache in Zustand store

---

### Decision 7: Logo File Validation

**Chosen Approach**: Reuse FileUploadService validation with sponsor-specific limits

**Rationale**:

- FileUploadService.validate_image_file() checks: MIME type, magic bytes, file size, dimensions
- Sponsor logos: max 5MB (vs 10MB for EventMedia), same format support (PNG/JPG/JPEG/SVG/WebP)
- Minimum dimensions: 64x64 (to ensure quality at xsmall size)
- Maximum dimensions: 2048x2048 (prevent excessive file sizes)

**Validation Rules**:

- **Allowed formats**: image/png, image/jpeg, image/jpg, image/svg+xml, image/webp
- **Max file size**: 5MB (5,242,880 bytes)
- **Min dimensions**: 64x64 pixels
- **Max dimensions**: 2048x2048 pixels
- **Magic byte validation**: Prevent file extension spoofing
- **Total sponsor logos per event**: 50MB limit (reuse EventMedia pattern)

**Implementation Notes**:

- Wrap FileUploadService with sponsor-specific size limit
- Add min dimension check (Pillow: `Image.open(BytesIO(content)).size`)
- Return user-friendly error messages for each validation failure

---

### Decision 8: Display Order and Sorting

**Chosen Approach**: Manual display_order field + logo_size as secondary sort

**Rationale**:

- Users may want to feature platinum sponsors first regardless of size
- Display order allows drag-and-drop reordering in frontend
- Default sort: ORDER BY display_order ASC, logo_size DESC (larger logos first within same order)
- New sponsors get display_order = max(current_sponsors) + 1

**Alternatives Considered**:

1. **Sort by logo_size only**: Rejected - no flexibility for featured sponsors
2. **Sort by donation amount**: Rejected - not always public/desired
3. **Sort by created_at**: Rejected - doesn't reflect sponsor importance

**Implementation Notes**:

- API endpoint: PATCH /sponsors/reorder with array of sponsor IDs
- Frontend: react-beautiful-dnd or similar for drag-and-drop
- Logo size enum values have inherent order: xlarge(5) > large(4) > medium(3) > small(2) > xsmall(1)

---

## Best Practices Research

### Image Upload Best Practices (Azure Blob Storage)

**Findings from Existing Codebase**:

1. **Pre-signed SAS URLs**: MediaService generates 1-hour expiry SAS tokens for client-side uploads
2. **Two-step upload**: Request URL → Client upload → Confirm completion
3. **Status tracking**: EventMedia uses UPLOADED → SCANNED status flow
4. **Virus scanning**: Placeholder for Celery task (currently no-op, ready for Phase 2)
5. **Blob naming**: Pattern `{entity-type}/{npo-or-event-id}/{record-id}/{filename}`
6. **URL generation**: Separate read SAS URLs (24-hour expiry) for serving files

**Applied to Sponsors**:

- Blob path: `sponsors/{npo_id}/{sponsor_id}/logo-{timestamp}-{filename}`
- Thumbnail path: `sponsors/{npo_id}/{sponsor_id}/thumbnail-{timestamp}-{filename}`
- Upload workflow: Same as EventMedia (generate_upload_url → client PUT → confirm_upload)
- Store blob_name in database for deletion and regeneration of SAS URLs

---

### Form Validation Best Practices

**Frontend Validation** (React Hook Form + Zod):

```typescript
const sponsorSchema = z.object({
  name: z.string().min(1).max(200),
  logo: z.instanceof(File).refine(file => file.size <= 5MB),
  website_url: z.string().url().optional().or(z.literal('')),
  logo_size: z.enum(['xsmall', 'small', 'medium', 'large', 'xlarge']),
  sponsor_level: z.string().max(100).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  donation_amount: z.number().nonnegative().max(999999999.99).optional(),
  // ... other fields
})
```

**Backend Validation** (Pydantic):

- Use EmailStr for email validation
- Use HttpUrl for website URL validation
- Custom validator for file size (in service layer, not schema)
- Decimal field with max_digits=12, decimal_places=2 for donation_amount

---

### Accessibility Considerations

**Image Alt Text**:

- Logo images should have alt="{sponsor_name} logo"
- Sponsor links (when website_url provided) should have aria-label="Visit {sponsor_name} website"

**Keyboard Navigation**:

- Sponsor list should be keyboard navigable
- Edit/delete buttons must have visible focus states
- Form fields must have proper labels and error associations

**Screen Readers**:

- Sponsor tier level announced with logo
- Upload progress announced with aria-live regions
- Empty state messages for no sponsors

---

## Dependencies

### Existing (No Installation Required)

- **Pillow**: Already used for image validation and processing
- **azure-storage-blob**: Already configured for EventMedia uploads
- **Pydantic**: For schema validation
- **SQLAlchemy**: For ORM and database operations
- **React**: Frontend framework
- **Zustand**: State management
- **React Hook Form + Zod**: Form validation (already in use)

### New (None Required)

All functionality can be implemented with existing dependencies.

---

## Migration Strategy

### Database Migration

1. Create `sponsors` table with all fields
2. Add foreign key to events(id) with ON DELETE CASCADE
3. Create indexes on event_id and (event_id, display_order)
4. No data migration needed (new feature)

### Rollback Plan

- Down migration: DROP TABLE sponsors CASCADE
- No impact on existing events data
- Logo blobs in Azure Storage can be cleaned up manually if needed (or left orphaned temporarily)

---

## Testing Strategy

### Backend Tests (pytest)

1. **Model Tests**:
   - Sponsor model creation and validation
   - Relationship with Event model
   - Enum value handling

2. **Service Tests**:
   - Logo upload URL generation
   - Thumbnail generation
   - File validation (size, format, dimensions)
   - Permission checks
   - Total size limit enforcement

3. **API Tests** (integration):
   - POST /events/{id}/sponsors (create)
   - GET /events/{id}/sponsors (list)
   - GET /events/{id}/sponsors/{sponsor_id} (retrieve)
   - PATCH /events/{id}/sponsors/{sponsor_id} (update)
   - DELETE /events/{id}/sponsors/{sponsor_id} (delete)
   - PATCH /events/{id}/sponsors/reorder (reorder)
   - Permission enforcement tests
   - Validation error tests

4. **Edge Cases**:
   - Upload oversized logo
   - Upload invalid file type
   - Delete sponsor with associated logo
   - Concurrent sponsor creation

### Frontend Tests (Vitest + React Testing Library)

1. **Component Tests**:
   - SponsorsTab renders sponsor list
   - SponsorForm validates input
   - Logo upload with progress indicator
   - Drag-and-drop reordering

2. **Integration Tests**:
   - Full create sponsor flow
   - Edit existing sponsor
   - Delete sponsor with confirmation
   - Error handling and retry

3. **Store Tests**:
   - Zustand sponsor store actions
   - Optimistic UI updates
   - Error state management

---

## Performance Considerations

### Database Queries

- Index on (event_id, display_order) for efficient sorting
- Single query to fetch all sponsors for an event
- No N+1 queries (eager load if needed)

### Image Loading

- Lazy load sponsor logos (only load visible thumbnails)
- Use `loading="lazy"` attribute on img tags
- Serve WebP format where supported (use picture element)

### Caching Strategy

- Cache sponsor list in Zustand store (5-minute TTL)
- Redis cache for sponsor list response (optional, Phase 2)
- Azure CDN for logo blobs (already configured)

---

## Security Review

### Input Validation

✅ Name: Max 200 characters, XSS prevention via React escaping
✅ Email: Pydantic EmailStr validation
✅ URL: Pydantic HttpUrl validation, open in new tab (rel="noopener noreferrer")
✅ Logo upload: MIME type, magic bytes, file size, dimensions checked
✅ Donation amount: Decimal with max value, non-negative

### Access Control

✅ Only event organizers (NPO admins/staff) can manage sponsors
✅ Sponsors isolated per event (query filtered by event_id)
✅ Audit logging for all sponsor mutations
✅ CSRF protection via FastAPI (already in place)

### File Upload Security

✅ Pre-signed SAS URLs expire after 1 hour
✅ Read SAS URLs expire after 24 hours
✅ Blob naming prevents path traversal
✅ MIME type validation prevents malicious files
✅ Virus scanning placeholder (ready for Phase 2)

---

## Monitoring and Observability

### Prometheus Metrics

```python
# Add to app/core/metrics.py
SPONSOR_UPLOADS_TOTAL = Counter(
    'fundrbolt_sponsor_uploads_total',
    'Total sponsor logo uploads',
    ['status']  # success, failure
)

SPONSOR_OPERATIONS_TOTAL = Counter(
    'fundrbolt_sponsor_operations_total',
    'Total sponsor CRUD operations',
    ['operation', 'status']  # create/update/delete, success/failure
)
```

### Logging Events

- INFO: Sponsor created/updated/deleted (with user_id, event_id, sponsor_id)
- WARNING: Logo validation failure (with file size, type)
- ERROR: Azure Blob upload failure (with error message)

### Health Checks

- No new health checks required (reuses existing Azure Blob Storage check)

---

## Deployment Considerations

### Backward Compatibility

- New table, no schema changes to existing tables
- No API versioning required
- Frontend feature flag: `FEATURE_SPONSORS_ENABLED` (default: true)

### Rollout Plan

1. Deploy backend with migration (creates sponsors table)
2. Deploy frontend with Sponsors tab hidden behind feature flag
3. Enable feature flag after smoke testing
4. Monitor metrics for 24 hours
5. Full rollout

### Rollback Plan

- Disable frontend feature flag
- Remove sponsors table via down migration
- No user-facing impact (new feature)

---

## Open Questions (Resolved)

### ✅ Q1: Should sponsors be shareable across events?

**Answer**: No. Spec states "sponsors are specific to individual events" (Out of Scope explicitly excludes multi-event sponsor packages).

### ✅ Q2: Currency for donation amounts?

**Answer**: Default to USD (no multi-currency support specified). Store as DECIMAL, display with currency symbol in frontend.

### ✅ Q3: Validation for country field?

**Answer**: Free-form text (max 100 chars). Spec mentions "no country code validation specified, but this may be enhanced later."

### ✅ Q4: Thumbnail dimensions?

**Answer**: 128x128 fixed size (matches existing thumbnail patterns, suitable for grid/list views).

### ✅ Q5: Logo format support for SVG?

**Answer**: Yes, include SVG (image/svg+xml) per spec requirement. SVG thumbnails: rasterize to PNG using Pillow or skip thumbnail for SVG (serve original).

---

## References

- Feature Spec: `.specify/specs/007-sponsors/spec.md`
- Constitution: `.specify/memory/constitution.md`
- Existing Media Upload: `backend/app/services/media_service.py`
- Existing File Upload: `backend/app/services/file_upload_service.py`
- Event Media Model: `backend/app/models/event.py` (EventMedia)
- Frontend Media Upload: `frontend/fundrbolt-admin/src/features/events/components/MediaUploader.tsx`

# Research Document: Event Creation and Management

**Feature**: 003-event-creation-ability
**Date**: November 7, 2025
**Status**: Complete

## Overview

This document consolidates research findings for implementing the Event Creation and Management feature. All technical unknowns from the specification have been resolved through analysis of existing codebase patterns, Azure service capabilities, and best practices for file handling, rich text editing, and concurrent editing scenarios.

## Technical Decisions

### 1. URL Slug Generation

**Decision**: Use Python `slugify` library with auto-increment suffix for collision resolution

**Rationale**:
- Existing NPO feature (spec 002) likely uses similar pattern for generating URL-safe identifiers
- `python-slugify` is well-maintained, handles Unicode properly, and follows RFC 3986 URL standards
- Auto-increment suffix (e.g., "spring-gala-2025", "spring-gala-2025-2") is user-friendly and predictable
- Database unique constraint on `slug` column prevents race conditions

**Alternatives Considered**:
- **UUID suffix**: Rejected due to poor readability ("spring-gala-2025-a3f2b1c4")
- **Hash-based suffix**: Rejected due to lack of user-friendliness ("spring-gala-2025-8x9z")
- **Timestamp suffix**: Rejected due to potential confusion with event dates

**Implementation Notes**:
- Service layer method: `generate_unique_slug(event_name: str) -> str`
- Check slug uniqueness with SQLAlchemy query before save
- Allow manual override via optional `custom_slug` field
- Maximum 3 auto-increment attempts before raising error

### 2. File Upload and Virus Scanning

**Decision**: Azure Blob Storage with pre-signed URLs + ClamAV antivirus scanning

**Rationale**:
- Azure Blob Storage already used in infrastructure (spec 004) for static assets
- ClamAV is open-source, actively maintained, and integrates well with Python via `clamd` library
- Pre-signed URLs enable direct browser-to-blob uploads, reducing backend load
- Virus scanning happens asynchronously after upload, with quarantine on detection

**Alternatives Considered**:
- **Microsoft Defender for Storage**: Rejected due to cost ($0.02/10K transactions, expensive at scale)
- **Synchronous scanning before save**: Rejected due to poor UX (blocks upload completion)
- **Client-side validation only**: Rejected due to security risk (client is untrusted)

**Implementation Notes**:
- Frontend requests pre-signed URL from backend `/api/v1/events/{id}/media/upload-url`
- Frontend uploads directly to Azure Blob using signed URL
- Backend webhook receives blob upload event, triggers ClamAV scan via Celery task
- If virus detected: delete blob, mark `EventMedia` as `quarantined`, notify user
- Maximum file size enforced at Azure Blob level (10MB per file)

### 3. Rich Text Editor and XSS Prevention

**Decision**: Markdown-based editor with `bleach` library for server-side sanitization

**Rationale**:
- Spec requires "basic text formatting (bold, italic, lists, links)" which maps well to Markdown
- Markdown is more secure than WYSIWYG HTML editors (smaller attack surface)
- `bleach` library (used by Mozilla, Django community) provides robust HTML sanitization
- Frontend uses `react-markdown` for rendering (already sanitizes by default)

**Alternatives Considered**:
- **Quill.js WYSIWYG editor**: Rejected due to complexity and XSS risk with HTML storage
- **TinyMCE**: Rejected due to heavy bundle size (300KB+) for basic formatting needs
- **Client-side sanitization only**: Rejected due to security principle (never trust client)

**Implementation Notes**:
- Frontend: Use `react-simplemde-editor` or similar lightweight Markdown editor
- Backend: Store Markdown in database, sanitize with `bleach` on save
- Allow only: `<b>`, `<i>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<a>` tags
- Strip all attributes except `href` on `<a>` tags (validate URL format)
- Render on frontend with `react-markdown` library

### 4. Optimistic Locking for Concurrent Edits

**Decision**: SQLAlchemy version column with `version_id_col` tracking

**Rationale**:
- Spec requires "optimistic locking with last-write-wins and conflict warning" (clarification)
- SQLAlchemy provides built-in version tracking via `version_id_col=True` on model
- Raises `StaleDataError` on concurrent update, which can be caught and converted to 409 Conflict
- User-friendly: allows viewing conflicting changes before re-saving

**Alternatives Considered**:
- **Pessimistic locking (SELECT FOR UPDATE)**: Rejected due to poor UX (locks entire event during edit session)
- **Last-write-wins without warning**: Rejected due to spec requirement for conflict warning
- **Manual timestamp comparison**: Rejected due to SQLAlchemy built-in being more reliable

**Implementation Notes**:
- Add `version` integer column to `Event` model with `version_id_col=True`
- On update conflict: return 409 with current server state + user's attempted changes
- Frontend displays diff view, allows user to resolve conflict manually
- Auto-save every 30 seconds (NFR-009) saves `version` to detect conflicts early

### 5. Timezone Handling for Event Dates

**Decision**: Store datetime with timezone in PostgreSQL using `TIMESTAMP WITH TIME ZONE`

**Rationale**:
- Spec requires "store in venue's local timezone with explicit timezone field"
- PostgreSQL `TIMESTAMPTZ` stores UTC internally, converts on retrieval
- SQLAlchemy `DateTime(timezone=True)` maps to `TIMESTAMPTZ`
- Store separate `timezone` string field (e.g., "America/New_York") for display purposes

**Alternatives Considered**:
- **Store naive datetime + separate timezone**: Rejected due to complexity and error-prone conversions
- **Store only UTC**: Rejected due to spec requirement for venue's local timezone
- **Use `TIMESTAMP` without timezone**: Rejected due to ambiguity and DST issues

**Implementation Notes**:
- `Event.event_datetime`: `DateTime(timezone=True)` (stores as UTC)
- `Event.timezone`: `String` (IANA timezone name, e.g., "America/Chicago")
- Frontend: Use `date-fns-tz` or `luxon` for timezone-aware date pickers
- Display datetime in venue's timezone on event page

### 6. Automatic Event Closure

**Decision**: Celery periodic task with 24-hour grace period after event end time

**Rationale**:
- Spec requires "automatic closure 24 hours after event end time" with manual override
- Celery beat already used for background jobs (Phase 2 in constitution)
- Periodic task (every 15 minutes) checks for events past end time + 24 hours
- Event Coordinators receive notification at actual end time (prompt to close)

**Alternatives Considered**:
- **Cron job**: Rejected due to need for database access and application context
- **Database trigger**: Rejected due to inability to send notifications or run async tasks
- **Check on every API request**: Rejected due to performance overhead

**Implementation Notes**:
- Celery task: `close_expired_events()` runs every 15 minutes
- Query: `WHERE status = 'active' AND event_datetime + INTERVAL '24 hours' < NOW()`
- Send notification to coordinators when `event_datetime <= NOW()` and still active
- Manual closure: PATCH `/api/v1/events/{id}/close` endpoint

### 7. Operational Metrics and Monitoring

**Decision**: Prometheus metrics with custom event-specific counters

**Rationale**:
- Existing monitoring infrastructure (spec 001) uses Prometheus + Grafana
- Spec requires tracking "creation rate, edit frequency, upload failures, form submission times"
- Custom metrics integrate with existing `/metrics` endpoint

**Alternatives Considered**:
- **Application Insights only**: Rejected due to need for real-time dashboards (Grafana)
- **Log-based metrics**: Rejected due to higher latency and resource consumption
- **No custom metrics**: Rejected due to explicit spec requirement (NFR-031)

**Implementation Notes**:
- Add Prometheus counters:
  - `fundrbolt_events_created_total` (labels: npo_id, user_role)
  - `fundrbolt_events_edited_total` (labels: npo_id, user_role, field_changed)
  - `fundrbolt_events_media_upload_total` (labels: file_type, status=success/failure)
  - `fundrbolt_events_form_submission_duration_seconds` (histogram)
- Grafana dashboard: "Event Management" with graphs for creation rate, upload success rate, avg form time

### 8. Food Options Data Model

**Decision**: Separate `FoodOption` table with many-to-one relationship to `Event`

**Rationale**:
- Spec requires "Event Coordinators can add multiple food options"
- Donors select preferences during registration (separate feature, not this spec)
- Structured relational model enables validation, display order, and future extensions (dietary tags)

**Alternatives Considered**:
- **JSON array in Event table**: Rejected due to loss of type safety and query capability
- **Comma-separated string**: Rejected due to poor data integrity and inability to validate
- **Pre-defined enum**: Rejected due to need for per-event customization

**Implementation Notes**:
- `FoodOption` model: `id`, `event_id` (FK), `name` (string), `display_order` (int)
- API returns food options as nested array in event response
- CRUD endpoints: POST/DELETE `/api/v1/events/{id}/food-options` for managing options
- Display order allows drag-and-drop reordering in UI

### 9. External Link Validation

**Decision**: Django `URLValidator` via `pydantic` schema with whitelist for video embeds

**Rationale**:
- Pydantic provides `HttpUrl` type with built-in validation (RFC 3986 compliance)
- YouTube/Vimeo embed URLs have specific patterns, can be validated with regex
- Server-side validation prevents malicious URLs and phishing attempts

**Alternatives Considered**:
- **Client-side validation only**: Rejected due to security principle (never trust client)
- **No validation (store as-is)**: Rejected due to XSS risk and broken link display issues
- **Live URL checking (HTTP request)**: Rejected due to performance overhead and privacy concerns

**Implementation Notes**:
- Pydantic schema field: `url: HttpUrl` (validates format)
- Additional validation for video URLs: extract video ID via regex
- Store normalized URL in database (strip tracking parameters)
- Frontend: embed YouTube/Vimeo via iframe with `sandbox` attribute for security

### 10. Drag-and-Drop File Upload UX

**Decision**: `react-dropzone` library with `axios` progress callbacks

**Rationale**:
- `react-dropzone` is industry standard (45K stars on GitHub), accessibility-compliant
- Integrates cleanly with `axios` for progress tracking
- Supports validation (file type, size) before upload attempt

**Alternatives Considered**:
- **Native HTML5 drag-and-drop**: Rejected due to poor accessibility and browser inconsistencies
- **Fine Uploader**: Rejected due to jQuery dependency and large bundle size
- **Uppy**: Rejected due to overkill complexity for basic upload needs

**Implementation Notes**:
- Component: `<MediaUploader onUpload={handleUpload} maxSize={10MB} accept="image/*,application/pdf" />`
- Frontend validation: check file size and type before requesting pre-signed URL
- Display progress bar during upload with percentage and estimated time remaining
- Show preview thumbnails for images after successful upload

## Best Practices Summary

### Security Best Practices

1. **File Upload Security**:
   - Server-side file type validation (magic number check, not just extension)
   - Virus scanning with ClamAV before serving files
   - Store uploaded files in private Azure Blob containers (not public)
   - Generate time-limited signed URLs for viewing (15-minute expiry)
   - Never execute uploaded files on server

2. **XSS Prevention**:
   - Server-side HTML sanitization with `bleach` library
   - Whitelist allowed tags and attributes (deny by default)
   - Validate and sanitize external URLs before rendering
   - Use Content Security Policy headers to block inline scripts

3. **Access Control**:
   - Verify user role and NPO association on every event operation
   - Use FastAPI dependency injection for auth checks (`@require_role()`)
   - Audit log all event modifications with user ID and timestamp

### Performance Best Practices

1. **Database Optimization**:
   - Index foreign keys: `event.npo_id`, `event_media.event_id`
   - Index query filters: `event.status`, `event.event_datetime`
   - Use eager loading for relationships to prevent N+1 queries
   - Implement pagination for event list (20 events per page)

2. **Caching Strategy**:
   - Cache event metadata in Redis for public pages (1-hour TTL)
   - Invalidate cache on event updates via cache key pattern `event:{id}:*`
   - CDN caching for uploaded media files (1-year TTL, versioned URLs)

3. **File Upload Optimization**:
   - Direct browser-to-blob uploads via pre-signed URLs (bypass backend)
   - Chunked uploads for files >5MB (Azure Blob Block API)
   - Compress images on frontend before upload (maintain quality, reduce size)
   - Lazy load media gallery images (load on scroll)

### Testing Best Practices

1. **Contract Testing**:
   - Validate all API responses against OpenAPI schema
   - Test error responses (400, 401, 403, 404, 409, 413, 422)
   - Verify response headers (Content-Type, Cache-Control, CORS)

2. **Integration Testing**:
   - Test complete file upload workflow (request URL → upload → scan → serve)
   - Test concurrent edit conflicts with multiple sessions
   - Test status transitions (draft → active → closed) with visibility rules
   - Test automatic event closure task

3. **Unit Testing**:
   - Test slug generation with Unicode, special characters, collisions
   - Test URL validation with malicious inputs (XSS, SSRF attempts)
   - Test timezone conversions and DST transitions
   - Test file size and type validation edge cases

### Accessibility Best Practices

1. **Form Accessibility**:
   - Associate labels with inputs via `htmlFor` attribute
   - Provide clear error messages with `aria-describedby`
   - Keyboard navigation support for drag-and-drop (fallback button)
   - Color picker shows hex values for screen readers

2. **Media Accessibility**:
   - Require alt text for uploaded images
   - Provide transcripts link field for embedded videos
   - Ensure sufficient color contrast for brand colors (WCAG AA)

## Dependencies and Integration Points

### External Services

1. **Azure Blob Storage**:
   - SDK: `azure-storage-blob` (Python), `@azure/storage-blob` (TypeScript)
   - Configuration: Storage account name, container name, access key (from Key Vault)
   - Usage: File uploads, pre-signed URLs, blob lifecycle management

2. **ClamAV Antivirus**:
   - Deployment: Docker container running `clamav/clamav` image
   - SDK: `clamd` (Python client)
   - Configuration: ClamAV daemon host/port (from environment variables)

3. **Celery Task Queue**:
   - Broker: Redis (already configured in spec 001)
   - Tasks: Virus scanning, event closure, notification sending
   - Beat schedule: Every 15 minutes for event closure check

### Internal Service Dependencies

1. **Authentication & Authorization**:
   - Dependency: Spec 001 (User Authentication & Role Management)
   - Integration: `@require_role("event_coordinator", "npo_admin")` decorators
   - Middleware: `verify_npo_association()` checks user belongs to event's NPO

2. **NPO Management**:
   - Dependency: Spec 002 (NPO Creation and Management)
   - Integration: Foreign key `Event.npo_id → NPO.id`
   - Validation: Verify NPO status = "approved" before allowing event creation

3. **Audit Logging**:
   - Dependency: Spec 001 (audit_logs table)
   - Integration: `AuditService.log_event_change()` on all mutations
   - Fields: user_id, action (create/update/delete), resource_type="event", changes (JSON)

4. **Legal Compliance**:
   - Dependency: Spec 005 (Legal Documentation)
   - Integration: Event creation requires accepted TOS/Privacy Policy
   - Middleware: `@require_consent()` decorator checks consent status

## Open Questions (None Remaining)

All technical unknowns from the specification have been resolved. Implementation is ready to proceed to Phase 1 (Design & Contracts).

---

**Research Complete**: November 7, 2025
**Next Phase**: Phase 1 - Data Model and API Contracts

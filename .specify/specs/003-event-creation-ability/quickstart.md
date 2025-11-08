# Developer Quickstart: Event Creation and Management

**Feature**: 003-event-creation-ability
**Last Updated**: November 7, 2025
**Prerequisites**: Specs 001 (Auth), 002 (NPO), 004 (Infrastructure), 005 (Legal)

## Overview

This guide helps developers quickly understand and work with the Event Creation and Management feature. It covers local setup, API usage, testing, and common development scenarios.

## Quick Setup

### 1. Database Migration

```bash
cd backend
poetry run alembic upgrade head
```

This creates the following tables:
- `events`
- `event_media`
- `event_links`
- `food_options`

### 2. Seed Test Data (Optional)

```bash
cd backend
poetry run python seed_event_demo_data.py
```

Creates sample events with media, links, and food options for development/testing.

### 3. Start Backend

```bash
make dev-backend
# or
cd backend && poetry run uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
make dev-frontend
# or
cd frontend/augeo-admin && pnpm dev
```

### 5. Verify Setup

```bash
curl http://localhost:8000/api/v1/events
# Should return 401 (authentication required) or list of events if authenticated
```

## Environment Variables

Add to `backend/.env`:

```bash
# Azure Blob Storage (for media uploads)
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
AZURE_STORAGE_CONTAINER_NAME=event-media
AZURE_STORAGE_ACCESS_KEY=your_access_key

# ClamAV (virus scanning)
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Celery (background tasks)
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

## API Usage Examples

### Create Event

```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "npo_id": "uuid-of-approved-npo",
    "name": "Spring Gala 2025",
    "event_datetime": "2025-04-15T18:00:00-05:00",
    "timezone": "America/Chicago",
    "venue_name": "Grand Ballroom",
    "venue_address": "123 Main St, Chicago, IL 60601",
    "description": "Join us for our annual **Spring Gala**!",
    "primary_color": "#FF5733",
    "secondary_color": "#33C4FF"
  }'
```

### Upload Media (Two-Step Process)

**Step 1: Request upload URL**
```bash
curl -X POST http://localhost:8000/api/v1/events/{event_id}/media/upload-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "gala-flyer.png",
    "file_type": "image/png",
    "file_size": 2048576
  }'
```

Response:
```json
{
  "upload_url": "https://your-storage.blob.core.windows.net/...",
  "media_id": "uuid-of-media-record",
  "expires_at": "2025-11-07T10:15:00Z"
}
```

**Step 2: Upload file to Azure Blob**
```bash
curl -X PUT "UPLOAD_URL_FROM_STEP_1" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/png" \
  --data-binary @gala-flyer.png
```

### Publish Event

```bash
curl -X POST http://localhost:8000/api/v1/events/{event_id}/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Add Food Options

```bash
curl -X POST http://localhost:8000/api/v1/events/{event_id}/food-options \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grilled Chicken",
    "description": "Grilled chicken breast with seasonal vegetables",
    "display_order": 1
  }'
```

### View Public Event Page

```bash
curl http://localhost:8000/api/v1/public/events/spring-gala-2025
```

No authentication required for active events.

## Frontend Component Usage

### Event Creation Form

```tsx
import { EventForm } from '@/components/EventForm';
import { useEventStore } from '@/stores/eventStore';

function CreateEventPage() {
  const createEvent = useEventStore((state) => state.createEvent);

  const handleSubmit = async (data: EventCreateData) => {
    try {
      const event = await createEvent(data);
      navigate(`/events/${event.id}`);
    } catch (error) {
      // Handle error
    }
  };

  return <EventForm onSubmit={handleSubmit} />;
}
```

### Media Uploader

```tsx
import { MediaUploader } from '@/components/MediaUploader';

function EventMediaSection({ eventId }: { eventId: string }) {
  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      // Step 1: Request upload URL
      const { upload_url, media_id } = await eventService.getUploadUrl(eventId, {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      // Step 2: Upload to Azure Blob
      await mediaService.uploadToBlob(upload_url, file);

      // Media is now uploaded, backend will scan asynchronously
    }
  };

  return (
    <MediaUploader
      onUpload={handleUpload}
      maxSize={10 * 1024 * 1024} // 10MB
      accept="image/png,image/jpeg,image/svg+xml,application/pdf"
    />
  );
}
```

## Testing

### Run All Tests

```bash
make test
# or
cd backend && poetry run pytest
cd frontend/augeo-admin && pnpm test
```

### Run Specific Test Suites

**Contract Tests (API endpoints)**:
```bash
cd backend
poetry run pytest app/tests/contract/test_event_api.py -v
```

**Integration Tests (workflows)**:
```bash
cd backend
poetry run pytest app/tests/integration/test_event_workflows.py -v
```

**Unit Tests (business logic)**:
```bash
cd backend
poetry run pytest app/tests/unit/test_event_service.py -v
```

### Test Coverage

```bash
cd backend
poetry run pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser
```

## Common Development Scenarios

### Scenario 1: Add New Event Field

1. **Update database model** (`backend/app/models/event.py`):
   ```python
   max_capacity = Column(Integer, nullable=True)
   ```

2. **Create migration**:
   ```bash
   cd backend
   poetry run alembic revision -m "add_max_capacity_to_events"
   # Edit migration file in alembic/versions/
   poetry run alembic upgrade head
   ```

3. **Update Pydantic schemas** (`backend/app/schemas/event.py`):
   ```python
   class EventCreate(BaseModel):
       max_capacity: Optional[int] = None
   ```

4. **Update OpenAPI contract** (`.specify/specs/003-event-creation-ability/contracts/openapi.yaml`)

5. **Update frontend types** (`frontend/augeo-admin/src/types/event.ts`)

6. **Add tests** for new field validation

### Scenario 2: Handle Concurrent Edit Conflict

**Backend**: Already handled by SQLAlchemy's `version_id_col`:
```python
try:
    event.name = new_name
    db.commit()
except StaleDataError:
    raise HTTPException(
        status_code=409,
        detail={
            "error": "Conflict: event modified by another user",
            "current_version": current_event.version,
            "your_version": submitted_version,
        }
    )
```

**Frontend**: Display conflict resolution UI:
```tsx
const handleSave = async (data: EventUpdateData) => {
  try {
    await eventService.updateEvent(eventId, data);
  } catch (error) {
    if (error.status === 409) {
      // Show diff view with current vs. attempted changes
      setConflictData(error.data);
      setShowConflictModal(true);
    }
  }
};
```

### Scenario 3: Debug File Upload Issues

**Check ClamAV status**:
```bash
docker ps | grep clamav
# or
telnet localhost 3310
```

**View Celery logs**:
```bash
docker logs -f augeo-celery-worker
```

**Verify Azure Blob Storage**:
```bash
# List blobs in container
az storage blob list \
  --account-name YOUR_STORAGE_ACCOUNT \
  --container-name event-media \
  --output table
```

**Check virus scan status**:
```bash
# Query EventMedia status
curl http://localhost:8000/api/v1/events/{event_id}/media \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Look for status: "uploaded" (pending), "scanned" (clean), "quarantined" (virus)
```

### Scenario 4: Test Automatic Event Closure

**Manually trigger Celery task**:
```bash
cd backend
poetry run python -c "from app.services.event_service import close_expired_events; close_expired_events()"
```

**Or wait for scheduled task** (runs every 15 minutes via Celery Beat)

**Create test event that expires soon**:
```python
# In seed script or test fixture
event = Event(
    name="Test Expiring Event",
    event_datetime=datetime.utcnow() - timedelta(hours=25),  # 25 hours ago
    status=EventStatus.ACTIVE,
    # ... other fields
)
```

## Debugging Tips

### Enable Debug Logging

**Backend** (`backend/.env`):
```bash
LOG_LEVEL=DEBUG
```

**View structured logs**:
```bash
docker logs -f augeo-backend | jq .
```

### Inspect Database State

```bash
cd backend
poetry run python
```

```python
from app.db.session import SessionLocal
from app.models.event import Event

db = SessionLocal()
events = db.query(Event).all()
for event in events:
    print(f"{event.name}: {event.status} (v{event.version})")
```

### Frontend DevTools

**Zustand DevTools** (in browser console):
```javascript
window.__ZUSTAND_DEVTOOLS__ = true;
```

**API Response Inspection** (Network tab):
- Filter by "events" to see all event API calls
- Check request/response headers for JWT tokens and content types

## Performance Optimization

### Database Query Optimization

**Eager load relationships** (prevent N+1 queries):
```python
from sqlalchemy.orm import joinedload

events = db.query(Event)\
    .options(joinedload(Event.media))\
    .options(joinedload(Event.links))\
    .options(joinedload(Event.food_options))\
    .all()
```

**Use pagination**:
```python
events = db.query(Event)\
    .filter(Event.npo_id == npo_id)\
    .order_by(Event.event_datetime.desc())\
    .limit(20)\
    .offset((page - 1) * 20)\
    .all()
```

### Caching

**Cache event metadata in Redis**:
```python
import redis
import json

r = redis.Redis(host='localhost', port=6379)

# Cache event data
r.setex(f"event:{event_id}", 3600, json.dumps(event_data))

# Retrieve from cache
cached = r.get(f"event:{event_id}")
if cached:
    return json.loads(cached)
```

### Frontend Performance

**Lazy load media gallery**:
```tsx
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage
  src={media.file_url}
  alt={media.file_name}
  effect="blur"
/>
```

**Debounce form inputs**:
```tsx
import { debounce } from 'lodash';

const handleNameChange = debounce((value: string) => {
  // Auto-save or validate
}, 500);
```

## Security Checklist

- [ ] Verify JWT token in all authenticated endpoints
- [ ] Check user has Event Coordinator or NPO Admin role
- [ ] Verify user is associated with event's NPO
- [ ] Sanitize Markdown input with `bleach` library
- [ ] Validate file types server-side (magic number check)
- [ ] Scan uploaded files with ClamAV
- [ ] Use signed URLs for serving media (15-min expiry)
- [ ] Validate external URLs against SSRF/XSS patterns
- [ ] Enforce file size limits (10MB per file, 50MB total)
- [ ] Audit log all event mutations

## Troubleshooting

### Issue: "Event slug already exists"

**Cause**: Auto-generated slug collision
**Solution**: System auto-increments suffix (e.g., "spring-gala-2025-2")
**Manual Override**: Set `custom_slug` in create request

### Issue: "File upload fails with 413 Payload Too Large"

**Cause**: File size exceeds 10MB or total event media >50MB
**Solution**: Compress images or remove existing media

### Issue: "Concurrent edit conflict (409)"

**Cause**: Another user modified event while you were editing
**Solution**: Frontend displays diff, user resolves conflict manually

### Issue: "ClamAV virus scan fails"

**Cause**: ClamAV daemon not running or outdated signatures
**Solution**:
```bash
docker restart augeo-clamav
docker exec augeo-clamav freshclam  # Update virus definitions
```

### Issue: "Event not appearing on public page after publish"

**Checks**:
- Verify `status = 'active'`
- Verify `event_datetime` is in the future
- Check NPO is approved (`npo.status = 'approved'`)
- Clear Redis cache: `redis-cli FLUSHDB` (dev only)

## Resources

- **OpenAPI Spec**: `.specify/specs/003-event-creation-ability/contracts/openapi.yaml`
- **Data Model**: `.specify/specs/003-event-creation-ability/data-model.md`
- **Research Notes**: `.specify/specs/003-event-creation-ability/research.md`
- **Feature Spec**: `.specify/specs/003-event-creation-ability/spec.md`

## Next Steps

After completing local development:

1. **Run pre-commit hooks**: `make check-commits`
2. **Run full test suite**: `make test`
3. **Check type safety**: `make type-check`
4. **Review code coverage**: Aim for 80%+ coverage
5. **Update agent context**: See Phase 1 completion steps
6. **Create implementation tasks**: Use `/speckit.tasks` command

---

**Questions?** See `.specify/memory/constitution.md` for architecture decisions and coding standards.

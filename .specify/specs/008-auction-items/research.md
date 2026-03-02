# Research: Auction Items Feature

**Date**: 2025-11-13
**Feature**: 008-auction-items
**Status**: Complete

## Overview

This document captures research findings, technical decisions, and rationale for implementing the auction items feature. All decisions follow existing patterns from the Fundrbolt platform (events, sponsors, media uploads).

---

## 1. Media Upload Strategy

### Decision: Azure Blob Storage with Pre-Signed SAS URLs

**Rationale**:
- Consistent with existing event media and sponsor logo patterns
- Proven implementation in `MediaService` and `SponsorLogoService`
- Secure: Private container with temporary signed URLs (15-min expiry)
- Scalable: Offloads storage from app servers
- Cost-effective: Azure Blob pricing ~$0.02/GB/month

**Alternatives Considered**:

1. **Direct Server Upload** (Rejected)
   - Increases backend load and memory usage
   - Requires large file handling in FastAPI
   - Doesn't scale well with concurrent uploads
   - Still needs blob storage for persistence

2. **Third-Party CDN (Cloudinary, Imgix)** (Rejected)
   - Additional service dependency
   - Extra monthly cost ($0-$89+ per month)
   - Vendor lock-in outside Azure ecosystem
   - Already using Azure Blob successfully

**Implementation Details**:
- Reuse `MediaService.generate_upload_url()` pattern
- Generate SAS token with write permission (1-hour expiry)
- Client uploads directly to blob storage
- Server confirms upload and creates database record
- Read URLs generated on-demand with 15-minute expiry

**File Size Limits**:
- Images: 10MB max per file (matches existing limit)
- Videos: 100MB max per file (new, higher limit)
- Total per item: No hard limit (reasonable usage expected)
- Event total: 50MB limit lifted for auction items

---

## 2. Bid Number Auto-Increment Strategy

### Decision: Database Sequence with Transaction Isolation

**Rationale**:
- PostgreSQL sequence guarantees unique, incrementing numbers
- SERIALIZABLE transaction isolation prevents race conditions
- Simple, reliable, battle-tested approach
- No application-level locking needed

**Alternatives Considered**:

1. **Application-Level Counter in Redis** (Rejected)
   - Adds Redis dependency for critical business logic
   - Potential consistency issues if Redis fails
   - Database remains source of truth anyway
   - More complex error handling

2. **UUID-Based Numbering** (Rejected)
   - Doesn't meet requirement for 3-digit sequential numbers
   - User story explicitly requests 100-999 format
   - Harder for auctioneers to call out during live auction

3. **Manual Assignment by User** (Rejected)
   - Error-prone (duplicate numbers)
   - Poor UX (extra step during item creation)
   - Doesn't match existing auto-increment patterns

**Implementation Details**:

```sql
-- Create sequence per event (in service layer)
CREATE SEQUENCE IF NOT EXISTS event_{event_id}_bid_number_seq
START WITH 100
INCREMENT BY 1
MAXVALUE 999;

-- Assign next value during item creation
bid_number = SELECT nextval('event_{event_id}_bid_number_seq');
```

**Handling Edge Cases**:
- If item deleted: Gap in sequence (acceptable, not reused)
- If sequence reaches 999: Raise HTTP 409 Conflict
- Event deletion: Cascade delete sequence (cleanup job)
- Rollback transaction: Sequence value lost (acceptable gap)

**Why Start at 100**:
- Avoids confusion with table numbers (typically 1-50)
- Professional appearance (3 digits)
- Leaves room for 900 items per event (far exceeds expected usage)

---

## 3. Buy-Now Functionality

### Decision: Simple Boolean Flag with Price Constraint

**Rationale**:
- Straightforward implementation: `buy_now_enabled` + `buy_now_price`
- Database constraint: `buy_now_price >= starting_bid`
- No complex state machine needed for MVP
- Matches user requirements exactly

**Alternatives Considered**:

1. **Separate "Buy Now" Item Type** (Rejected)
   - Overcomplicates data model
   - Buy-now is an option, not a separate entity
   - Would require duplicating all item fields

2. **Dynamic Buy-Now Pricing (current_bid * multiplier)** (Rejected)
   - Not in requirements
   - Adds complexity without clear benefit
   - Fixed price simpler for donors to understand

**Business Rules**:
- Buy-now price must be set if enabled
- Buy-now price must be >= starting bid
- First buyer wins (race condition handled by transaction)
- Item immediately marked as sold (status transition)
- Subsequent attempts return HTTP 409 Conflict

**Future Enhancements (Phase 2)**:
- Auto-disable buy-now after first bid placed
- Buy-now countdown timer
- "Make Offer" feature

---

## 4. Sponsor Attribution

### Decision: Foreign Key to Sponsors Table

**Rationale**:
- Existing `sponsors` table already has event relationship
- One-to-many: One sponsor can support multiple items
- Enables logo display on item detail page
- Maintains referential integrity

**Alternatives Considered**:

1. **Free-Text Sponsor Name** (Rejected)
   - No logo display capability
   - Duplicate data across items
   - Can't track sponsor impact metrics
   - Harder to update sponsor details globally

2. **Many-to-Many Relationship** (Rejected)
   - Not in requirements (single sponsor per item)
   - Adds complexity without immediate value
   - Can be added in Phase 2 if needed

**Implementation Details**:
- `sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL`
- Nullable: Items can exist without sponsor
- ON DELETE SET NULL: If sponsor deleted, item remains but attribution removed
- Join query to load sponsor logo for item detail

---

## 5. Media Gallery Implementation

### Decision: Separate `auction_item_media` Table with Display Order

**Rationale**:
- Matches `event_media` pattern (proven design)
- Supports multiple files per item
- Drag-and-drop reordering via `display_order` column
- Clean separation of concerns

**Alternatives Considered**:

1. **JSON Array in auction_items Table** (Rejected)
   - Poor query performance
   - Can't index media metadata
   - Harder to generate signed URLs
   - Breaks normalization

2. **File System Storage with Metadata JSON** (Rejected)
   - Doesn't scale in Azure App Service
   - No built-in redundancy/backup
   - Harder to implement signed URLs
   - Already using blob storage successfully

**Schema Design**:

```sql
CREATE TABLE auction_item_media (
    id UUID PRIMARY KEY,
    auction_item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE,
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video')),
    file_path TEXT,           -- Blob name/path
    file_name VARCHAR(255),   -- Original filename
    file_size INTEGER,        -- Bytes
    mime_type VARCHAR(100),   -- image/jpeg, video/mp4
    display_order INTEGER DEFAULT 0,
    thumbnail_path TEXT,      -- Generated for images
    video_url TEXT,           -- YouTube/Vimeo embed (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Media Types**:
- **Image**: JPEG, PNG, WebP (10MB max)
- **Video**: MP4, WebM (100MB max) OR YouTube/Vimeo URL

**Thumbnail Generation**:
- Auto-generate 200x200 and 800x600 for images
- Use Pillow library (already in dependencies)
- Store thumbnails in same blob container
- Lazy load in gallery (first 3 images, then on-scroll)

---

## 6. Item Status State Machine

### Decision: Four-State Workflow (draft → published → sold → withdrawn)

**Rationale**:
- Matches event status pattern
- Clear intent for each state
- Prevents accidental publication
- Supports soft deletion (withdrawn)

**State Transitions**:

```
DRAFT ──publish──> PUBLISHED ──bid won/buy now──> SOLD
  │                    │
  └────────────────────┴──withdraw──> WITHDRAWN
```

**Business Rules**:
- **DRAFT**: Visible only to event staff, editable
- **PUBLISHED**: Publicly visible, accepts bids, editable with warning
- **SOLD**: Read-only, auction complete, winner assigned
- **WITHDRAWN**: Soft-deleted, hidden from public, audit trail preserved

**Alternatives Considered**:

1. **Boolean is_active Flag** (Rejected)
   - Doesn't distinguish draft vs published vs sold
   - Can't track withdrawal reason
   - Less explicit state transitions

2. **Additional States (pending, closed, archived)** (Rejected)
   - Over-engineering for MVP
   - Current 4 states cover all requirements
   - Can add more if needed in Phase 2

---

## 7. Quantity Handling

### Decision: Single Integer Field (quantity_available)

**Rationale**:
- Requirement: Multiple quantity items sold as single lot
- Simple field: `quantity_available INTEGER DEFAULT 1`
- Winner receives all units
- No partial quantity bidding

**Alternatives Considered**:

1. **Separate Lots for Each Unit** (Rejected)
   - Requires manual duplication of items
   - Doesn't match "sold as single lot" requirement
   - Poor UX for event coordinators

2. **Quantity Decrementing on Partial Sales** (Rejected)
   - Not in requirements (all-or-nothing sale)
   - Adds complex inventory tracking
   - Phase 2 enhancement if needed

**Use Cases**:
- Wine basket with 6 bottles: `quantity_available = 6`
- Dinner for 4 people: `quantity_available = 4`
- Single painting: `quantity_available = 1` (default)

---

## 8. Video Handling Strategy

### Decision: Hybrid Approach (Upload OR External URL)

**Rationale**:
- Support both self-hosted videos and embeds
- YouTube/Vimeo already handle encoding/streaming
- Upload option for custom videos without public platform

**Implementation**:
- `video_url TEXT`: YouTube/Vimeo embed URL (validated)
- `file_path TEXT`: Blob storage for uploaded videos
- Mutually exclusive: Either URL or upload, not both
- Database constraint: `CHECK ((video_url IS NULL) != (file_path IS NULL))`

**Validation**:
- YouTube: `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`
- Vimeo: `https://vimeo.com/...`
- Extract video ID and generate embed URL
- Uploaded videos: MP4/WebM, 100MB max

**Playback**:
- External URLs: iframe embed (responsive)
- Uploaded videos: HTML5 video player with blob SAS URL

---

## 9. Image Processing Requirements

### Decision: Pillow for Thumbnail Generation, No Advanced Processing

**Rationale**:
- Pillow already in project dependencies
- Simple resize operations (200x200, 800x600)
- No need for advanced features (filters, effects)
- Fast processing (<2 seconds per image)

**Alternatives Considered**:

1. **Azure Cognitive Services (Computer Vision)** (Rejected)
   - Overkill for simple resizing
   - Additional cost ($1.50 per 1000 images)
   - Not needed for MVP

2. **ImageMagick CLI** (Rejected)
   - Requires system dependency installation
   - Pillow sufficient for resize operations
   - Less Python-native

**Processing Pipeline**:
1. Client uploads full-size image to blob storage
2. Server downloads image to memory
3. Generate 200x200 thumbnail (square crop)
4. Generate 800x600 web display (preserve aspect ratio)
5. Upload thumbnails to blob storage
6. Update database with blob paths
7. Return signed URLs to client

**Error Handling**:
- Corrupted image: Quarantine and notify user
- Processing timeout (>10s): Async job (Phase 2)
- Storage failure: Rollback transaction, delete blobs

---

## 10. Permission Model

### Decision: Reuse Existing RBAC (NPO Admin, NPO Staff, Event Coordinator)

**Rationale**:
- No new roles needed
- Auction items scoped to events (same permissions)
- NPO Admin/Staff can create/edit/delete items
- Donors can view published items (read-only)

**Permission Matrix**:

| Action              | Super Admin | NPO Admin | NPO Staff | Donor |
|---------------------|-------------|-----------|-----------|-------|
| Create item         | ✅           | ✅         | ✅         | ❌     |
| Edit draft item     | ✅           | ✅         | ✅         | ❌     |
| Edit published item | ✅           | ✅         | ✅ (warn)  | ❌     |
| Delete item         | ✅           | ✅         | ✅         | ❌     |
| View draft item     | ✅           | ✅         | ✅         | ❌     |
| View published item | ✅           | ✅         | ✅         | ✅     |
| Upload media        | ✅           | ✅         | ✅         | ❌     |
| Reorder media       | ✅           | ✅         | ✅         | ❌     |

**Middleware**:
- Reuse `@require_role()` decorator
- Event membership check via `EventService.verify_access()`
- No custom permission table needed (YAGNI)

---

## 11. Database Indexing Strategy

### Decision: Index on event_id, status, auction_type, sponsor_id

**Rationale**:
- Most common queries filter by event and status
- `event_id` + `status`: List published items for event
- `event_id` + `auction_type`: Filter live vs silent
- `sponsor_id`: Show all items sponsored by X
- Composite index: `(event_id, status, auction_type)`

**Index Definitions**:

```sql
CREATE INDEX idx_auction_items_event_id
  ON auction_items(event_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_status
  ON auction_items(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_auction_type
  ON auction_items(auction_type) WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_sponsor_id
  ON auction_items(sponsor_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_event_status_type
  ON auction_items(event_id, status, auction_type) WHERE deleted_at IS NULL;
```

**Performance Impact**:
- Query: "List all published silent auction items for event X"
- Without index: Full table scan (O(n) where n = total items)
- With index: Index seek (O(log n) where n = items for event)
- Expected speedup: 10-100x for events with 100+ items

---

## 12. Pagination Strategy

### Decision: Offset-Based Pagination with Configurable Limits

**Rationale**:
- Simple to implement and understand
- Sufficient for expected dataset size (100-500 items/event)
- Matches existing event/sponsor pagination patterns

**Parameters**:
- `page`: Current page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `offset`: Calculated as `(page - 1) * limit`

**Response Format**:

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "pages": 5
  }
}
```

**Alternatives Considered**:

1. **Cursor-Based Pagination** (Rejected)
   - More complex implementation
   - Better for infinite scroll (not primary use case)
   - Offset-based simpler for admin dashboard

2. **Load All Items (No Pagination)** (Rejected)
   - Poor performance with 500+ items
   - Slow initial page load
   - High memory usage on client

**Future Optimization**:
- Add cursor-based for donor PWA (Phase 2)
- Cache first page in Redis (frequent access)

---

## 13. Soft Delete vs Hard Delete

### Decision: Soft Delete for Items with Bids, Hard Delete for Drafts

**Rationale**:
- Preserve audit trail if item had bidding activity
- Allow permanent removal of unpublished drafts
- Balance data retention with database bloat

**Implementation**:

```python
async def delete_item(item_id: UUID, db: AsyncSession):
    item = await get_item(item_id, db)

    # Check if item has bids (will implement in bidding feature)
    has_bids = await check_has_bids(item_id, db)

    if has_bids or item.status in [ItemStatus.SOLD, ItemStatus.WITHDRAWN]:
        # Soft delete: Set deleted_at timestamp
        item.deleted_at = datetime.now(UTC)
        item.status = ItemStatus.WITHDRAWN
    else:
        # Hard delete: Remove from database and delete blobs
        await delete_media_blobs(item_id, db)
        await db.delete(item)

    await db.commit()
```

**Soft Delete Benefits**:
- Maintains referential integrity with bids table
- Supports "undelete" functionality (Phase 2)
- Audit compliance (data retention requirements)

**Hard Delete Benefits**:
- Cleans up test/draft data
- Reduces storage costs
- Simpler for items that never went live

---

## 14. Error Handling & Retry Logic

### Decision: Exponential Backoff for Blob Operations, Fail Fast for Validation

**Rationale**:
- Blob storage occasionally has transient failures
- Retry helps with network hiccups
- Validation errors should fail immediately (no retry)

**Retry Strategy**:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
async def upload_to_blob(blob_client, data):
    """Upload with retry on transient failures."""
    await blob_client.upload_blob(data, overwrite=True)
```

**Error Categories**:

1. **Validation Errors** (4xx): No retry, immediate response
   - Invalid file type
   - File too large
   - Missing required fields

2. **Transient Errors** (5xx): Retry up to 3 times
   - Blob storage timeout
   - Network connection reset
   - Temporary service unavailable

3. **Fatal Errors**: No retry, log and alert
   - Out of storage quota
   - Invalid credentials
   - Database constraint violation

---

## Summary of Key Decisions

| Area                 | Decision                                      | Pattern Source        |
|----------------------|-----------------------------------------------|-----------------------|
| Media Upload         | Azure Blob + SAS URLs                         | `MediaService`        |
| Bid Number           | PostgreSQL sequence (100-999)                 | New pattern           |
| Buy-Now              | Boolean flag + price constraint               | New pattern           |
| Sponsor Link         | Foreign key to sponsors table                 | Existing relationship |
| Media Gallery        | Separate table with display_order             | `event_media`         |
| Status Workflow      | 4-state (draft/published/sold/withdrawn)      | `Event.status`        |
| Quantity             | Single integer field (all-or-nothing)         | New pattern           |
| Video Handling       | Hybrid (upload OR external URL)               | `event_links`         |
| Image Processing     | Pillow for thumbnails                         | `SponsorLogoService`  |
| Permissions          | Reuse RBAC (NPO Admin/Staff)                  | Existing roles        |
| Indexing             | Composite on event_id + status + type         | Standard practice     |
| Pagination           | Offset-based (page/limit)                     | Existing pattern      |
| Delete Strategy      | Soft if bids exist, hard otherwise            | New pattern           |
| Error Handling       | Retry transient, fail fast on validation      | Existing pattern      |

---

## Technology Stack (Confirmed)

**Backend**:
- FastAPI 0.120+
- SQLAlchemy 2.0
- Pydantic 2.0
- Azure Blob Storage SDK 12.19+
- Pillow 10.0+ (image processing)
- Tenacity (retry logic)

**Database**:
- PostgreSQL 14+ (Azure managed)
- Sequences for bid number assignment
- Indexes on frequent query columns

**Frontend**:
- React 18
- TypeScript 5
- Zustand (state management)
- React Query (server state)
- Drag-and-drop library (react-beautiful-dnd or dnd-kit)

**Testing**:
- pytest + pytest-asyncio
- factory-boy (test fixtures)
- httpx (async HTTP client for tests)
- Playwright (E2E tests)

---

## Phase 0 Complete

All technical unknowns resolved. Ready to proceed to Phase 1 (data model design and API contracts).

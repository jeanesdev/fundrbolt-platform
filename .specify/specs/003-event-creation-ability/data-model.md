# Data Model: Event Creation and Management

**Feature**: 003-event-creation-ability
**Date**: November 7, 2025
**Status**: Complete

## Entity Relationship Diagram

```text
┌─────────────────────┐
│       NPO           │
│ (from spec 002)     │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐       ┌─────────────────────┐
│      Event          │◄──────┤   EventMedia        │
│                     │ 1:N   │                     │
└──────────┬──────────┘       └─────────────────────┘
           │
           │ 1:N             ┌─────────────────────┐
           ├─────────────────►   EventLink         │
           │                 └─────────────────────┘
           │
           │ 1:N             ┌─────────────────────┐
           └─────────────────►   FoodOption        │
                             └─────────────────────┘
```

## Core Entities

### Event

Primary entity representing a fundraising gala or auction. Serves as the container for all event-related data including branding, logistics, and associated media.

**Table Name**: `events`

**Fields**:

| Field               | Type            | Constraints                      | Description                                   |
|---------------------|-----------------|----------------------------------|-----------------------------------------------|
| `id`                | UUID            | PRIMARY KEY                      | Unique identifier                             |
| `npo_id`            | UUID            | FOREIGN KEY → npos.id, NOT NULL, INDEX | NPO that owns this event                      |
| `name`              | VARCHAR(255)    | NOT NULL                         | Event display name                            |
| `slug`              | VARCHAR(255)    | UNIQUE, NOT NULL, INDEX          | URL-safe identifier (e.g., "spring-gala-2025") |
| `custom_slug`       | VARCHAR(255)    | NULLABLE                         | User-provided override for auto-generated slug |
| `status`            | ENUM            | NOT NULL, DEFAULT 'draft', INDEX | draft \| active \| closed                     |
| `event_datetime`    | TIMESTAMPTZ     | NOT NULL                         | Event date and time (stored as UTC)           |
| `timezone`          | VARCHAR(50)     | NOT NULL                         | IANA timezone name (e.g., "America/New_York") |
| `venue_name`        | VARCHAR(255)    | NULLABLE                         | Venue or location name                        |
| `venue_address`     | TEXT            | NULLABLE                         | Full venue address                            |
| `description`       | TEXT            | NULLABLE                         | Rich text description (Markdown)              |
| `logo_url`          | VARCHAR(500)    | NULLABLE                         | Event-specific logo (Azure Blob URL)          |
| `primary_color`     | VARCHAR(7)      | NULLABLE                         | Hex color code (e.g., "#FF5733")              |
| `secondary_color`   | VARCHAR(7)      | NULLABLE                         | Hex color code (e.g., "#33C4FF")              |
| `version`           | INTEGER         | NOT NULL, DEFAULT 1              | Optimistic locking version counter            |
| `created_at`        | TIMESTAMPTZ     | NOT NULL, DEFAULT NOW()          | Record creation timestamp                     |
| `updated_at`        | TIMESTAMPTZ     | NOT NULL, DEFAULT NOW()          | Last modification timestamp                   |
| `created_by`        | UUID            | FOREIGN KEY → users.id           | User who created the event                    |
| `updated_by`        | UUID            | FOREIGN KEY → users.id           | User who last modified the event              |

**Indexes**:
- `idx_events_npo_id` on `npo_id` (for listing events by NPO)
- `idx_events_status` on `status` (for filtering by status)
- `idx_events_slug` on `slug` (for URL lookups)
- `idx_events_event_datetime` on `event_datetime` (for sorting and closure tasks)

**Constraints**:
- `CHECK (status IN ('draft', 'active', 'closed'))`
- `CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$')`
- `CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$')`
- `UNIQUE (slug)`

**State Transitions**:
```
draft → active (manual: Event Coordinator publishes)
active → closed (manual: Event Coordinator closes OR automatic: 24h after event_datetime)
active → draft (manual: Event Coordinator unpublishes)
closed → active (not allowed - must create new event)
draft → closed (not allowed - must activate first)
```

**Validation Rules**:
- `event_datetime` must be in the future at creation time
- `npo_id` must reference an approved NPO (`npos.status = 'approved'`)
- `slug` uniqueness enforced at database level
- `timezone` must be valid IANA timezone name
- Color fields must be valid 6-digit hex codes with leading `#`

---

### EventMedia

Represents uploaded media files (images, flyers, promotional materials) associated with an event.

**Table Name**: `event_media`

**Fields**:

| Field          | Type            | Constraints                        | Description                                     |
|----------------|-----------------|------------------------------------|-------------------------------------------------|
| `id`           | UUID            | PRIMARY KEY                        | Unique identifier                               |
| `event_id`     | UUID            | FOREIGN KEY → events.id, NOT NULL, INDEX, ON DELETE CASCADE | Event this media belongs to                     |
| `file_url`     | VARCHAR(500)    | NOT NULL                           | Azure Blob Storage URL                          |
| `file_name`    | VARCHAR(255)    | NOT NULL                           | Original filename (display purposes)            |
| `file_type`    | VARCHAR(100)    | NOT NULL                           | MIME type (e.g., "image/png")                   |
| `file_size`    | INTEGER         | NOT NULL                           | File size in bytes                              |
| `display_order`| INTEGER         | NOT NULL, DEFAULT 0                | Order for gallery display                       |
| `status`       | ENUM            | NOT NULL, DEFAULT 'uploaded'       | uploaded \| scanned \| quarantined              |
| `uploaded_at`  | TIMESTAMPTZ     | NOT NULL, DEFAULT NOW()            | Upload timestamp                                |
| `uploaded_by`  | UUID            | FOREIGN KEY → users.id             | User who uploaded the file                      |

**Indexes**:
- `idx_event_media_event_id` on `event_id` (for retrieving all media for an event)
- `idx_event_media_display_order` on `event_id, display_order` (for ordered gallery retrieval)

**Constraints**:
- `CHECK (status IN ('uploaded', 'scanned', 'quarantined'))`
- `CHECK (file_size <= 10485760)` (10MB in bytes)

**State Transitions**:
```
uploaded → scanned (async: ClamAV scan completes, no virus)
uploaded → quarantined (async: ClamAV detects virus)
scanned → quarantined (rare: re-scan detects issue)
```

**Validation Rules**:
- Total file size per event must not exceed 50MB (enforced in service layer)
- `file_type` must be in allowed list (image/png, image/jpeg, image/svg+xml, application/pdf)
- `file_url` must be a valid Azure Blob Storage URL

---

### EventLink

Represents external resources linked to an event (videos, websites, social media).

**Table Name**: `event_links`

**Fields**:

| Field          | Type            | Constraints                        | Description                                     |
|----------------|-----------------|------------------------------------|-------------------------------------------------|
| `id`           | UUID            | PRIMARY KEY                        | Unique identifier                               |
| `event_id`     | UUID            | FOREIGN KEY → events.id, NOT NULL, INDEX, ON DELETE CASCADE | Event this link belongs to                      |
| `link_type`    | ENUM            | NOT NULL                           | video \| website \| social_media                |
| `url`          | VARCHAR(500)    | NOT NULL                           | External URL                                    |
| `label`        | VARCHAR(255)    | NULLABLE                           | Display label (e.g., "Event Promo Video")      |
| `platform`     | VARCHAR(50)     | NULLABLE                           | Platform name (e.g., "YouTube", "Facebook")     |
| `display_order`| INTEGER         | NOT NULL, DEFAULT 0                | Order for display                               |
| `created_at`   | TIMESTAMPTZ     | NOT NULL, DEFAULT NOW()            | Creation timestamp                              |
| `created_by`   | UUID            | FOREIGN KEY → users.id             | User who added the link                         |

**Indexes**:
- `idx_event_links_event_id` on `event_id` (for retrieving all links for an event)
- `idx_event_links_link_type` on `event_id, link_type` (for filtering by type)

**Constraints**:
- `CHECK (link_type IN ('video', 'website', 'social_media'))`
- URL validation enforced in application layer (Pydantic schema)

**Validation Rules**:
- `url` must be a valid HTTP/HTTPS URL
- For `link_type = 'video'`: URL must match YouTube or Vimeo patterns
- For `link_type = 'social_media'`: Platform must be specified (Facebook, Twitter, Instagram)

---

### FoodOption

Represents selectable meal/menu choices for an event. Donors select their preference during registration (separate feature).

**Table Name**: `food_options`

**Fields**:

| Field          | Type            | Constraints                        | Description                                     |
|----------------|-----------------|------------------------------------|-------------------------------------------------|
| `id`           | UUID            | PRIMARY KEY                        | Unique identifier                               |
| `event_id`     | UUID            | FOREIGN KEY → events.id, NOT NULL, INDEX, ON DELETE CASCADE | Event this option belongs to                    |
| `name`         | VARCHAR(255)    | NOT NULL                           | Option name (e.g., "Chicken", "Vegetarian")     |
| `description`  | TEXT            | NULLABLE                           | Optional detailed description                   |
| `display_order`| INTEGER         | NOT NULL, DEFAULT 0                | Order for display in selection UI               |
| `created_at`   | TIMESTAMPTZ     | NOT NULL, DEFAULT NOW()            | Creation timestamp                              |

**Indexes**:
- `idx_food_options_event_id` on `event_id` (for retrieving all options for an event)
- `idx_food_options_display_order` on `event_id, display_order` (for ordered retrieval)

**Constraints**:
- `UNIQUE (event_id, name)` (no duplicate option names within an event)

**Validation Rules**:
- `name` must be non-empty and trimmed
- Maximum 20 food options per event (enforced in service layer)

---

## Relationships

### Event → NPO (Many-to-One)
- **Cardinality**: Many events belong to one NPO
- **Foreign Key**: `events.npo_id → npos.id`
- **Cascade**: `ON DELETE RESTRICT` (cannot delete NPO with existing events)
- **Business Rule**: NPO must be approved before events can be created

### Event → EventMedia (One-to-Many)
- **Cardinality**: One event has many media files
- **Foreign Key**: `event_media.event_id → events.id`
- **Cascade**: `ON DELETE CASCADE` (deleting event deletes all media)
- **Business Rule**: Total media size per event ≤ 50MB

### Event → EventLink (One-to-Many)
- **Cardinality**: One event has many external links
- **Foreign Key**: `event_links.event_id → events.id`
- **Cascade**: `ON DELETE CASCADE` (deleting event deletes all links)
- **Business Rule**: No duplicate URLs per event

### Event → FoodOption (One-to-Many)
- **Cardinality**: One event has many food options
- **Foreign Key**: `food_options.event_id → events.id`
- **Cascade**: `ON DELETE CASCADE` (deleting event deletes all options)
- **Business Rule**: Maximum 20 options per event

---

## Audit Trail

All event operations (create, update, status change, delete) are logged to the existing `audit_logs` table (from spec 001).

**Audit Log Entry Example**:
```json
{
  "user_id": "uuid-of-event-coordinator",
  "action": "update",
  "resource_type": "event",
  "resource_id": "uuid-of-event",
  "changes": {
    "status": ["draft", "active"],
    "updated_at": ["2025-11-07T10:00:00Z", "2025-11-07T10:30:00Z"]
  },
  "timestamp": "2025-11-07T10:30:00Z"
}
```

---

## Database Migration

**Alembic Migration File**: `backend/alembic/versions/XXX_add_event_tables.py`

**Order of Table Creation**:
1. `events` (depends on existing `npos` and `users` tables)
2. `event_media` (depends on `events`)
3. `event_links` (depends on `events`)
4. `food_options` (depends on `events`)

**Migration Includes**:
- All table definitions with proper types and constraints
- Foreign key constraints with appropriate cascade rules
- Indexes for performance optimization
- Check constraints for data validation
- Enum types for `status` and `link_type` fields

**Rollback Considerations**:
- Drop tables in reverse order (food_options, event_links, event_media, events)
- No data migration required (new feature, no existing data)

---

## Query Patterns

### Common Queries and Indexes

1. **List events for NPO (Event Coordinator dashboard)**:
   ```sql
   SELECT * FROM events WHERE npo_id = ? ORDER BY event_datetime DESC;
   ```
   Index: `idx_events_npo_id`

2. **Get active events for public listing**:
   ```sql
   SELECT * FROM events WHERE status = 'active' AND event_datetime > NOW() ORDER BY event_datetime ASC;
   ```
   Index: `idx_events_status`, `idx_events_event_datetime`

3. **Find events ready for auto-closure**:
   ```sql
   SELECT * FROM events WHERE status = 'active' AND event_datetime + INTERVAL '24 hours' < NOW();
   ```
   Index: `idx_events_status`, `idx_events_event_datetime`

4. **Get event with all media and links (public event page)**:
   ```sql
   SELECT e.*, em.*, el.* FROM events e
   LEFT JOIN event_media em ON e.id = em.event_id AND em.status = 'scanned'
   LEFT JOIN event_links el ON e.id = el.event_id
   WHERE e.slug = ?;
   ```
   Index: `idx_events_slug`, `idx_event_media_event_id`, `idx_event_links_event_id`

---

## State Management

### Event Status Lifecycle

```
┌──────┐
│ NEW  │ (User clicks "Create Event")
└───┬──┘
    │
    ▼
┌───────┐  Publish   ┌────────┐  Close (manual)      ┌────────┐
│ draft ├──────────► │ active ├────────────────────► │ closed │
└───┬───┘            └────┬───┘                      └────────┘
    │                     │
    │ Unpublish           │ Auto-close (24h after end)
    │◄────────────────────┘
```

**Status Meanings**:
- **draft**: Visible only to Event Coordinators and NPO Admins, not listed publicly
- **active**: Publicly visible, appears in event listings, allows donor registration
- **closed**: Publicly viewable but all interactive features disabled (no new registrations)

**Status Change Triggers**:
- **draft → active**: Manual action by Event Coordinator/NPO Admin
- **active → draft**: Manual action by Event Coordinator/NPO Admin
- **active → closed**: Manual action OR Celery task 24h after `event_datetime`
- **closed → active**: Not allowed (immutable after closure)

---

## SQLAlchemy Model Examples

### Event Model (Snippet)

```python
from sqlalchemy import Column, String, Integer, DateTime, Enum, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"

class Event(Base):
    __tablename__ = "events"
    __mapper_args__ = {"version_id_col": "version"}  # Optimistic locking

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    npo_id = Column(UUID(as_uuid=True), ForeignKey("npos.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(Enum(EventStatus), nullable=False, default=EventStatus.DRAFT, index=True)
    event_datetime = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    npo = relationship("NPO", back_populates="events")
    media = relationship("EventMedia", back_populates="event", cascade="all, delete-orphan")
    links = relationship("EventLink", back_populates="event", cascade="all, delete-orphan")
    food_options = relationship("FoodOption", back_populates="event", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'closed')", name="check_event_status"),
        CheckConstraint("primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'", name="check_primary_color"),
    )
```

---

**Data Model Complete**: November 7, 2025
**Next Phase**: API Contracts (OpenAPI schemas)

# Data Model: Donor PWA and Event Page

**Feature**: 010-donor-pwa-and
**Date**: 2025-11-20
**Purpose**: Define data structures and relationships for event registration and donor access

---

## Entity Overview

This feature introduces three new entities (**EventRegistration**, **RegistrationGuest**, **MealSelection**) and extends existing entities (**Event**, **User**) to support donor registration, guest management, and meal selections.

---

## New Entities

### EventRegistration

**Purpose**: Links a donor (user) to an event, tracking their registration status, guest count, and associated metadata.

**Business Rules**:

- One registration per user per event (enforced via unique constraint)
- Cannot register for events that have ended
- Status changes: pending → confirmed, confirmed → cancelled
- Soft delete via cancelled status (preserves historical data)
- Cannot cancel after event start time
- Guest count can be updated before the event
- Primary registrant can add/update guest information before the event

**Fields**:

| Field Name | Type | Nullable | Default | Constraints | Description |
|------------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | Auto-generated | Primary key | Unique registration identifier |
| `user_id` | UUID | No | - | Foreign key to `users.id`, CASCADE delete | User who registered |
| `event_id` | UUID | No | - | Foreign key to `events.id`, CASCADE delete | Event being registered for |
| `status` | Enum | No | `CONFIRMED` | One of: PENDING, CONFIRMED, CANCELLED, WAITLISTED | Current registration status |
| `ticket_type` | String(100) | Yes | NULL | - | Type of ticket (future use: VIP, General, etc.) |
| `number_of_guests` | Integer | No | 1 | Min: 1 | Number of guests (including registrant) |
| `created_at` | Timestamp | No | NOW() | - | Registration timestamp |
| `updated_at` | Timestamp | No | NOW() | Auto-update on change | Last modification timestamp |

**Indexes**:

- Primary key: `id`
- Foreign key index: `user_id`
- Foreign key index: `event_id`
- Status index: `status` (for filtering active registrations)
- Composite index: `(user_id, event_id, status)` (for "user's confirmed events" queries)

**Unique Constraints**:

- `(user_id, event_id)` - Prevents duplicate registrations

**Enum Values**:

```python
class RegistrationStatus(str, Enum):
    PENDING = "pending"       # Awaiting confirmation (future use)
    CONFIRMED = "confirmed"   # Confirmed attendance
    CANCELLED = "cancelled"   # User cancelled registration
    WAITLISTED = "waitlisted" # Event at capacity (future use)
```

**Relationships**:

- **User** (many-to-one): `user_id` → `users.id`
- **Event** (many-to-one): `event_id` → `events.id`
- **Guests** (one-to-many): Registration can have multiple guests via `registration_guests`
- **Meal Selections** (one-to-many): Registration can have multiple meal selections (one per attendee)

---

### RegistrationGuest

**Purpose**: Stores optional guest information provided by the primary registrant during or after event registration.

**Business Rules**:

- Guest information is optional (can be added later before the event)
- Each guest belongs to exactly one event registration
- Guest can optionally create their own account via admin-sent invitation link
- If guest creates account, their user_id is linked to guest record
- Guests without accounts can still attend (on-site registration)

**Fields**:

| Field Name | Type | Nullable | Default | Constraints | Description |
|------------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | Auto-generated | Primary key | Unique guest identifier |
| `registration_id` | UUID | No | - | Foreign key to `event_registrations.id`, CASCADE delete | Parent registration |
| `user_id` | UUID | Yes | NULL | Foreign key to `users.id`, SET NULL | Guest's user account (if created) |
| `name` | String(255) | Yes | NULL | - | Guest's full name |
| `email` | String(255) | Yes | NULL | Valid email format | Guest's email address |
| `phone` | String(20) | Yes | NULL | - | Guest's phone number |
| `invited_by_admin` | Boolean | No | false | - | Whether admin sent registration link to this guest |
| `invitation_sent_at` | Timestamp | Yes | NULL | - | When admin sent registration link |
| `created_at` | Timestamp | No | NOW() | - | Guest record creation timestamp |
| `updated_at` | Timestamp | No | NOW() | Auto-update on change | Last modification timestamp |

**Indexes**:

- Primary key: `id`
- Foreign key index: `registration_id`
- Foreign key index: `user_id`
- Email index: `email` (for lookup when guest registers via admin link)

**Relationships**:

- **Event Registration** (many-to-one): `registration_id` → `event_registrations.id`
- **User** (many-to-one, optional): `user_id` → `users.id` (when guest creates account)
- **Meal Selections** (one-to-many): Guest can have meal selections

---

### MealSelection

**Purpose**: Stores meal choice for each attendee (registrant or guest) when event has meal options configured.

**Business Rules**:

- Required during registration if event has meal options
- One meal selection per attendee (registrant + each guest)
- Guests arriving without meal selection can choose at event (no database record until on-site)
- Meal options are defined at event level (foreign key to event_food_options table)

**Fields**:

| Field Name | Type | Nullable | Default | Constraints | Description |
|------------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | Auto-generated | Primary key | Unique meal selection identifier |
| `registration_id` | UUID | No | - | Foreign key to `event_registrations.id`, CASCADE delete | Parent registration |
| `guest_id` | UUID | Yes | NULL | Foreign key to `registration_guests.id`, CASCADE delete | Guest who made selection (NULL = registrant) |
| `food_option_id` | UUID | No | - | Foreign key to `event_food_options.id`, RESTRICT | Selected meal option |
| `created_at` | Timestamp | No | NOW() | - | Selection timestamp |
| `updated_at` | Timestamp | No | NOW() | Auto-update on change | Last modification timestamp |

**Indexes**:

- Primary key: `id`
- Foreign key index: `registration_id`
- Foreign key index: `guest_id`
- Foreign key index: `food_option_id`
- Composite index: `(registration_id, guest_id)` (for "get all meal selections for a registration" queries)

**Unique Constraints**:

- `(registration_id, guest_id)` - One meal selection per guest per registration (guest_id NULL for registrant)

**Relationships**:

- **Event Registration** (many-to-one): `registration_id` → `event_registrations.id`
- **Registration Guest** (many-to-one, optional): `guest_id` → `registration_guests.id` (NULL = registrant's meal)
- **Food Option** (many-to-one): `food_option_id` → `event_food_options.id`

---

## Extended Entities

### User

**New Relationship**:

- **event_registrations** (one-to-many): User can have multiple event registrations

**Schema Change**: None (relationship only, no new columns)

**Query Pattern**:

```python
# Get user's registered events
user.event_registrations  # List[EventRegistration]

# Get only confirmed registrations
[reg for reg in user.event_registrations if reg.status == RegistrationStatus.CONFIRMED]
```

---

### Event

**New Relationship**:

- **registrations** (one-to-many): Event can have multiple registrations

**Existing Fields Used**:

| Field Name | Type | Usage in This Feature |
|------------|------|----------------------|
| `slug` | String(255), unique, indexed | Used for URL routing (`/events/{slug}`) |
| `npo_id` | UUID | Event ownership, branding inheritance |
| `primary_color` | String(7) | Event branding (header, buttons) |
| `secondary_color` | String(7) | Event branding (accents, secondary elements) |
| `logo_url` | String(500) | Event branding (header logo) |
| `banner_url` | String(500) | Event branding (page banner image) |
| `name` | String(255) | Event title displayed on page |
| `event_datetime` | Timestamp | Event date/time displayed on page |
| `description` | Text | Event description displayed on page |
| `location_name` | String(255) | Venue name displayed on page |
| `location_address` | String(500) | Venue address displayed on page |

**Schema Change**: None (all required fields already exist)

**Query Pattern**:

```python
# Get all registrations for an event
event.registrations  # List[EventRegistration]

# Get confirmed attendee count
confirmed_count = len([r for r in event.registrations if r.status == RegistrationStatus.CONFIRMED])
```

---

## Entity Relationships

```text
┌─────────────┐          ┌──────────────────────┐          ┌─────────────┐
│    User     │          │ EventRegistration    │          │    Event    │
│             │          │                      │          │             │
│ - id (PK)   │◄────────┤│ - id (PK)            │├────────►│ - id (PK)   │
│ - email     │          │ - user_id (FK)       │          │ - slug      │
│ - first_name│          │ - event_id (FK)      │          │ - name      │
│ - last_name │          │ - status             │          │             │
│ - role      │          │ - number_of_guests   │          │             │
│             │          │                      │          │             │
│             │          │ UNIQUE(user_id,      │          │             │
│             │          │        event_id)     │          │             │
└─────────────┘          └──────────┬───────────┘          └─────────────┘
     1                              │ *                            1
     │                              │                              │
     │                              │                              │
     │                    ┌─────────┴─────────┐                   │
     │                    │                   │                   │
     │                    ▼ 1                 ▼ 1                 │
     │          ┌──────────────────┐ ┌──────────────────┐         │
     │          │ RegistrationGuest│ │  MealSelection   │         │
     │          │                  │ │                  │         │
     └─────────►│ - id (PK)        │ │ - id (PK)        │         │
       0..1     │ - registration_id│ │ - registration_id│         │
                │ - user_id (FK)   │ │ - guest_id (FK)  │         │
                │ - name           │ │ - food_option_id │         │
                │ - email          │ │                  │         │
                │ - phone          │ │ UNIQUE(reg_id,   │         │
                └────────┬─────────┘ │        guest_id) │         │
                       * │           └────────┬─────────┘         │
                         │                    │ *                 │
                         └────────────────────┘                   │
                                                                  │
                         ┌────────────────────────────────────────┘
                         │
                         ▼ *
              ┌──────────────────┐
              │ EventFoodOption  │
              │                  │
              │ - id (PK)        │
              │ - event_id (FK)  │
              │ - name           │
              │ - description    │
              └──────────────────┘
```

**Relationships Summary**:

1. **User → EventRegistration** (1:many): Primary registrant creates registration
2. **Event → EventRegistration** (1:many): Event can have multiple registrations
3. **EventRegistration → RegistrationGuest** (1:many): Registration can have multiple guests
4. **User → RegistrationGuest** (1:0..1): Guest optionally creates their own account
5. **EventRegistration → MealSelection** (1:many): One meal per attendee (registrant + guests)
6. **RegistrationGuest → MealSelection** (1:1): Each guest has one meal selection
7. **EventFoodOption → MealSelection** (1:many): Meal option can be selected by multiple attendees

---

## Data Validation Rules

### EventRegistration

**Creation Validation**:

1. `user_id` must reference an existing user
2. `event_id` must reference an existing event
3. User cannot already have a CONFIRMED or PENDING registration for the same event
4. Event must not have ended (if enforcing future-only registrations)
5. `number_of_guests` must be >= 1

**Update Validation**:

1. Cannot change `user_id` or `event_id` (immutable after creation)
2. Cannot change status from CANCELLED back to CONFIRMED (one-way cancellation)
3. Cannot cancel after event has started (if enforcing no-cancellation policy)

**Soft Delete**:

- Instead of deleting registration, set `status = CANCELLED`
- Preserves audit trail and historical data

### RegistrationGuest

**Creation Validation**:

1. `registration_id` must reference an existing event registration
2. If `email` provided, must be valid email format
3. If `user_id` provided, must reference an existing user with role "donor"
4. Cannot link same user_id to multiple guests in same registration

**Update Validation**:

1. Can update `name`, `email`, `phone` before event starts
2. Once `user_id` is set (guest created account), cannot be changed
3. Cannot change `registration_id` (immutable)

### MealSelection

**Creation Validation**:

1. `registration_id` must reference an existing event registration
2. `food_option_id` must reference an existing food option for the event
3. If `guest_id` provided, must reference an existing guest in the same registration
4. Event must have meal options configured
5. Cannot have duplicate meal selection for same guest in same registration

**Update Validation**:

1. Can update `food_option_id` before event starts
2. Cannot change `registration_id` or `guest_id` (immutable)

---

## State Transitions

### RegistrationStatus State Machine

```text
        ┌─────────┐
        │ PENDING │
        └────┬────┘
             │
             │ confirm
             ▼
        ┌───────────┐      cancel      ┌───────────┐
        │ CONFIRMED │◄─────────────────┤ CANCELLED │
        └────┬──────┘                  └───────────┘
             │
             │ cancel
             ▼
        ┌───────────┐
        │ CANCELLED │
        └───────────┘

        ┌────────────┐
        │ WAITLISTED │ (future use)
        └────────────┘
```

**Valid Transitions**:

- PENDING → CONFIRMED (admin confirms registration)
- PENDING → CANCELLED (user/admin cancels before confirmation)
- CONFIRMED → CANCELLED (user cancels confirmed registration)
- CONFIRMED → WAITLISTED (not implemented in initial version)
- WAITLISTED → CONFIRMED (not implemented in initial version)

**Invalid Transitions**:

- CANCELLED → CONFIRMED (no reactivation)
- CANCELLED → PENDING (no reactivation)

---

## Query Patterns

### Common Queries

**Get all events a user is registered for**:

```python
async def get_user_registered_events(
    db: AsyncSession,
    user_id: UUID,
    status: RegistrationStatus | None = None,
) -> list[Event]:
    query = (
        select(Event)
        .join(EventRegistration)
        .where(EventRegistration.user_id == user_id)
        .options(selectinload(Event.npo))  # Eager load NPO for branding
    )

    if status:
        query = query.where(EventRegistration.status == status)

    query = query.order_by(Event.event_datetime.asc())

    result = await db.execute(query)
    return result.scalars().all()
```

**Get all registrations for an event**:

```python
async def get_event_registrations(
    db: AsyncSession,
    event_id: UUID,
    status: RegistrationStatus | None = None,
) -> list[EventRegistration]:
    query = (
        select(EventRegistration)
        .where(EventRegistration.event_id == event_id)
        .options(selectinload(EventRegistration.user))  # Eager load user data
    )

    if status:
        query = query.where(EventRegistration.status == status)

    query = query.order_by(EventRegistration.created_at.asc())

    result = await db.execute(query)
    return result.scalars().all()
```

**Check if user is registered for event**:

```python
async def is_user_registered(
    db: AsyncSession,
    user_id: UUID,
    event_id: UUID,
) -> bool:
    result = await db.execute(
        select(EventRegistration)
        .where(
            and_(
                EventRegistration.user_id == user_id,
                EventRegistration.event_id == event_id,
                EventRegistration.status != RegistrationStatus.CANCELLED,
            )
        )
    )
    return result.scalar_one_or_none() is not None
```

**Get confirmed attendee count for event**:

```python
async def get_confirmed_attendee_count(
    db: AsyncSession,
    event_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count(EventRegistration.id))
        .where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
            )
        )
    )
    return result.scalar_one()
```

**Get registration with guests and meal selections**:

```python
async def get_registration_with_details(
    db: AsyncSession,
    registration_id: UUID,
) -> EventRegistration | None:
    result = await db.execute(
        select(EventRegistration)
        .where(EventRegistration.id == registration_id)
        .options(
            selectinload(EventRegistration.user),
            selectinload(EventRegistration.guests),
            selectinload(EventRegistration.meal_selections).selectinload(MealSelection.food_option),
        )
    )
    return result.scalar_one_or_none()
```

**Get guest list for event registration (admin view)**:

```python
async def get_registration_guest_list(
    db: AsyncSession,
    registration_id: UUID,
) -> list[dict]:
    """Returns list of all attendees (registrant + guests) with meal selections."""
    registration = await get_registration_with_details(db, registration_id)
    if not registration:
        return []

    attendees = []

    # Add primary registrant
    registrant_meal = next(
        (ms for ms in registration.meal_selections if ms.guest_id is None),
        None
    )
    attendees.append({
        "type": "registrant",
        "name": f"{registration.user.first_name} {registration.user.last_name}",
        "email": registration.user.email,
        "phone": registration.user.phone,
        "meal_selection": registrant_meal.food_option.name if registrant_meal else None,
    })

    # Add guests
    for guest in registration.guests:
        guest_meal = next(
            (ms for ms in registration.meal_selections if ms.guest_id == guest.id),
            None
        )
        attendees.append({
            "type": "guest",
            "name": guest.name or "Not provided",
            "email": guest.email or "Not provided",
            "phone": guest.phone or "Not provided",
            "meal_selection": guest_meal.food_option.name if guest_meal else "Not selected",
            "has_account": guest.user_id is not None,
        })

    return attendees
```

**Get all attendees for event (admin export)**:

```python
async def get_event_attendee_list(
    db: AsyncSession,
    event_id: UUID,
) -> list[dict]:
    """Returns complete attendee list for event export."""
    registrations = await db.execute(
        select(EventRegistration)
        .where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
            )
        )
        .options(
            selectinload(EventRegistration.user),
            selectinload(EventRegistration.guests),
            selectinload(EventRegistration.meal_selections).selectinload(MealSelection.food_option),
        )
    )

    all_attendees = []
    for registration in registrations.scalars().all():
        attendees = await get_registration_guest_list(db, registration.id)
        for attendee in attendees:
            attendee["primary_registrant_email"] = registration.user.email
        all_attendees.extend(attendees)

    return all_attendees
```

**Get meal selection summary for event (catering counts)**:

```python
async def get_meal_selection_summary(
    db: AsyncSession,
    event_id: UUID,
) -> dict[str, int]:
    """Returns count of each meal selection for catering planning."""
    result = await db.execute(
        select(
            EventFoodOption.name,
            func.count(MealSelection.id).label("count")
        )
        .join(MealSelection, MealSelection.food_option_id == EventFoodOption.id)
        .join(EventRegistration, MealSelection.registration_id == EventRegistration.id)
        .where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.CONFIRMED,
            )
        )
        .group_by(EventFoodOption.name)
    )

    return {row.name: row.count for row in result.all()}
```

---

## Migration Strategy

### Migration 011: Add event_registrations, registration_guests, meal_selections tables

**Up Migration**:

```python
def upgrade() -> None:
    # Create enum type
    op.execute("CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'cancelled', 'waitlisted')")

    # Create event_registrations table
    op.create_table(
        'event_registrations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'confirmed', 'cancelled', 'waitlisted', name='registration_status'), nullable=False),
        sa.Column('ticket_type', sa.String(length=100), nullable=True),
        sa.Column('number_of_guests', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'event_id', name='uq_user_event_registration')
    )

    # Create indexes for event_registrations
    op.create_index('ix_event_registrations_user_id', 'event_registrations', ['user_id'])
    op.create_index('ix_event_registrations_event_id', 'event_registrations', ['event_id'])
    op.create_index('ix_event_registrations_status', 'event_registrations', ['status'])
    op.create_index('idx_user_event_status', 'event_registrations', ['user_id', 'event_id', 'status'])

    # Create registration_guests table
    op.create_table(
        'registration_guests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('registration_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('invited_by_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('invitation_sent_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['registration_id'], ['event_registrations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )

    # Create indexes for registration_guests
    op.create_index('ix_registration_guests_registration_id', 'registration_guests', ['registration_id'])
    op.create_index('ix_registration_guests_user_id', 'registration_guests', ['user_id'])
    op.create_index('ix_registration_guests_email', 'registration_guests', ['email'])

    # Create meal_selections table
    op.create_table(
        'meal_selections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('registration_id', sa.UUID(), nullable=False),
        sa.Column('guest_id', sa.UUID(), nullable=True),
        sa.Column('food_option_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['registration_id'], ['event_registrations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['guest_id'], ['registration_guests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['food_option_id'], ['event_food_options.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('registration_id', 'guest_id', name='uq_registration_guest_meal')
    )

    # Create indexes for meal_selections
    op.create_index('ix_meal_selections_registration_id', 'meal_selections', ['registration_id'])
    op.create_index('ix_meal_selections_guest_id', 'meal_selections', ['guest_id'])
    op.create_index('ix_meal_selections_food_option_id', 'meal_selections', ['food_option_id'])
    op.create_index('idx_registration_guest_meal', 'meal_selections', ['registration_id', 'guest_id'])
```

**Down Migration**:

```python
def downgrade() -> None:
    # Drop meal_selections table
    op.drop_index('idx_registration_guest_meal', table_name='meal_selections')
    op.drop_index('ix_meal_selections_food_option_id', table_name='meal_selections')
    op.drop_index('ix_meal_selections_guest_id', table_name='meal_selections')
    op.drop_index('ix_meal_selections_registration_id', table_name='meal_selections')
    op.drop_table('meal_selections')

    # Drop registration_guests table
    op.drop_index('ix_registration_guests_email', table_name='registration_guests')
    op.drop_index('ix_registration_guests_user_id', table_name='registration_guests')
    op.drop_index('ix_registration_guests_registration_id', table_name='registration_guests')
    op.drop_table('registration_guests')

    # Drop event_registrations table
    op.drop_index('idx_user_event_status', table_name='event_registrations')
    op.drop_index('ix_event_registrations_status', table_name='event_registrations')
    op.drop_index('ix_event_registrations_event_id', table_name='event_registrations')
    op.drop_index('ix_event_registrations_user_id', table_name='event_registrations')
    op.drop_table('event_registrations')

    # Drop enum type
    op.execute("DROP TYPE registration_status")
```

---

## Performance Considerations

### Indexes

- **EventRegistration composite index** `(user_id, event_id, status)` optimizes "user's confirmed events" query
- **EventRegistration foreign key indexes** on `user_id` and `event_id` optimize joins
- **EventRegistration status index** enables fast filtering by registration status
- **RegistrationGuest composite index** `(registration_id, guest_id)` for meal selection queries
- **RegistrationGuest email index** for guest lookup when admin sends invitations
- **MealSelection composite index** `(registration_id, guest_id)` optimizes attendee meal queries
- **Foreign key indexes** on all relationship fields prevent slow joins

### Query Optimization

- Use `selectinload()` to eager load relationships and prevent N+1 queries
- Use `func.count()` for attendee/meal counts instead of fetching all records
- Batch load guests and meal selections when fetching registrations
- Consider materialized view for event statistics (attendee counts, meal summaries)

### Scalability

- Database-level unique constraints prevent race conditions
- Indexed foreign keys support high-volume queries
- Soft delete (status = CANCELLED) avoids cascading deletes
- Guest information is optional (nullable fields) to minimize storage for simple registrations
- Meal selections stored separately to support flexible querying

---

## Security Considerations

### Access Control

- Users can only view/modify their own registrations and guest information
- Users can update guest details and meal selections before event starts
- Event coordinators can view all registrations, guests, and meal selections for their events
- Event coordinators can send individual registration links to guests via admin interface
- Super admins can view/modify all registrations, guests, and meal selections

### Audit Trail

- `created_at` and `updated_at` timestamps track registration lifecycle
- `created_at` and `updated_at` on guests track when information was added/modified
- `invitation_sent_at` tracks when admin sent registration link to guest
- Soft delete preserves historical data for compliance
- Consider adding audit log table for registration/guest/meal changes (future enhancement)

### Privacy

- Registration data contains PII (user_id links to email, name)
- Guest data contains PII (names, emails, phone numbers)
- Meal selections may reveal dietary restrictions (sensitive health information)
- All data must be included in GDPR data export
- All data must be deleted on user data deletion request
- Guest email addresses used only for invitation purposes (no marketing without consent)

---

## Future Enhancements

### Potential Fields to Add (EventRegistration)

1. `registration_source` (String): Track how user found registration link (email, social, direct)
2. `confirmation_token` (String): For email confirmation workflow
3. `qr_code` (String): For check-in at event
4. `checked_in_at` (Timestamp): Track event attendance
5. `payment_id` (UUID): Link to payment for paid events

### Potential Fields to Add (RegistrationGuest)

1. `dietary_restrictions` (Text): Free-form dietary notes beyond meal selections
2. `accessibility_needs` (Text): Collect accessibility requirements
3. `age_group` (Enum): Child/Adult for seating/catering planning
4. `checked_in_at` (Timestamp): Track individual guest check-in

### Potential Fields to Add (MealSelection)

1. `dietary_notes` (Text): Additional notes (allergies, preferences)
2. `portion_size` (Enum): Child/Adult portion for accurate catering counts

### Potential Features

1. Event capacity management (max_attendees field on Event, enforce during registration)
2. Waitlist functionality when event at capacity
3. Email confirmation workflow for guests (PENDING → CONFIRMED status)
4. Ticket types with pricing (VIP, General, Student)
5. Multi-session event registration (select which sessions to attend)
6. Guest seat assignment or table number
7. Registration analytics dashboard (conversion rates, guest-to-registrant ratio)
8. Automated reminder emails for completing guest information or meal selections
9. Bulk guest import (CSV upload for large parties)
10. Guest registration portal (registrant shares link directly with guests)
11. Real-time attendee count widget for event pages
12. Meal selection modifications after initial registration

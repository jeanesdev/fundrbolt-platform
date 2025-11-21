# Donor PWA Backend Implementation Summary

## Overview

This implementation provides the complete backend infrastructure for the donor PWA feature, enabling event registration with guest management and meal selection capabilities.

## What Was Implemented

### Database Layer (Migration 012)

**Tables Created:**
1. `event_registrations` - Links donors to events
   - Tracks registration status (pending, confirmed, cancelled, waitlisted)
   - Stores number of guests and ticket type
   - Unique constraint on (user_id, event_id) prevents duplicates

2. `registration_guests` - Optional guest information
   - Stores guest name, email, phone (all nullable)
   - Links to user account when guest creates one (user_id nullable)
   - Tracks admin invitations (invited_by_admin, invitation_sent_at)

3. `meal_selections` - Meal choices per attendee
   - One selection per attendee (registrant + guests)
   - Unique constraint on (registration_id, guest_id)
   - guest_id is NULL for the registrant's meal

**Indexes Created:**
- Foreign key indexes on all relationships
- Composite index (user_id, event_id, status) for user's confirmed events
- Composite index (registration_id, guest_id) for meal selection queries
- Email index on registration_guests for guest lookup

### Models Layer

**Created 3 new SQLAlchemy models:**
- `EventRegistration` with RegistrationStatus enum
- `RegistrationGuest` for guest details
- `MealSelection` linking to FoodOption

**Updated existing models:**
- User model: Added `event_registrations` and `guest_records` relationships
- Event model: Added `registrations` relationship

### Schemas Layer (Pydantic)

**Request Schemas:**
- EventRegistrationCreateRequest (event_id, number_of_guests, ticket_type)
- EventRegistrationUpdateRequest (number_of_guests, ticket_type, status)
- RegistrationGuestCreateRequest (name, email, phone - all optional)
- RegistrationGuestUpdateRequest (same fields, all optional)
- MealSelectionCreateRequest (registration_id, guest_id, food_option_id)
- MealSelectionUpdateRequest (food_option_id)

**Response Schemas:**
- EventRegistrationResponse with timestamps
- EventRegistrationListResponse with pagination
- RegistrationGuestResponse
- RegistrationGuestListResponse
- MealSelectionResponse
- MealSelectionListResponse
- MealSelectionSummaryResponse for catering planning

### Services Layer

**EventRegistrationService:**
- `create_registration()` - Register user for event with duplicate checking
- `check_duplicate()` - Verify user not already registered
- `get_user_registrations()` - List user's registrations with pagination
- `get_event_registrations()` - List event's registrations (for admin)
- `update_registration()` - Update guest count, ticket type, or status
- `cancel_registration()` - Soft delete via status change
- `get_registration_by_id()` - Get single registration with relationships
- Status transition validation (prevents invalid state changes)

**GuestService:**
- `add_guest()` - Add guest to registration
- `update_guest()` - Update guest information
- `remove_guest()` - Delete guest record
- `get_registration_guests()` - List all guests for a registration
- `link_guest_to_user()` - Link guest record to user account

**MealSelectionService:**
- `create_meal_selection()` - Create meal choice with validation
- `update_meal_selection()` - Change meal choice
- `get_registration_meal_selections()` - List meals for registration
- `get_event_meal_summary()` - Aggregated counts for catering

### API Endpoints

**Public Events API (No Auth Required):**
```
GET /api/v1/public/events
GET /api/v1/public/events/{slug}
```

**Registration API (Auth Required):**
```
POST   /api/v1/registrations
GET    /api/v1/registrations
GET    /api/v1/registrations/{id}
PATCH  /api/v1/registrations/{id}
DELETE /api/v1/registrations/{id}
```

**Guest Management API:**
```
POST   /api/v1/registrations/{id}/guests
GET    /api/v1/registrations/{id}/guests
PATCH  /api/v1/registrations/{id}/guests/{guestId}
DELETE /api/v1/registrations/{id}/guests/{guestId}
```

**Meal Selection API:**
```
POST  /api/v1/registrations/{id}/meal-selections
GET   /api/v1/registrations/{id}/meal-selections
PATCH /api/v1/meal-selections/{id}
```

## Business Rules Enforced

1. **Registration:**
   - One registration per user per event (database constraint)
   - Cannot register for draft events
   - Cannot register for events that have ended
   - Cannot cancel after event has started

2. **Status Transitions:**
   - PENDING → CONFIRMED (admin approval)
   - PENDING → CANCELLED (pre-confirmation cancellation)
   - CONFIRMED → CANCELLED (user cancellation)
   - CANCELLED → * (no transitions allowed)

3. **Guest Management:**
   - Guests belong to registrations (cascade delete)
   - Guest information is optional (all fields nullable)
   - Guest can optionally create their own account (user_id links)

4. **Meal Selections:**
   - One meal per attendee (database constraint)
   - Must select from event's food options
   - Can update meal choice before event
   - Food options cannot be deleted if referenced (RESTRICT)

## Security & Authorization

**All mutation endpoints verify:**
- User authentication (JWT token required)
- Resource ownership (users can only modify their own registrations)
- Valid status transitions
- Related data belongs together (guest belongs to registration, etc.)

**Public endpoints:**
- Only show ACTIVE events (drafts hidden)
- No authentication required for browsing

## What Still Needs to Be Done

### Frontend Implementation (Donor PWA)
- [ ] Setup API clients (axios instances)
- [ ] Create EventCard component for displaying events
- [ ] Create GuestForm component for collecting guest details
- [ ] Create MealSelectionForm component for meal choices
- [ ] Create registration wizard route `/events/:slug/register`
- [ ] Implement multi-step registration flow:
  1. User info (name, email, password)
  2. Guest count
  3. Guest details (optional, can skip)
  4. Meal selections (if event has meal options)
- [ ] Create event listing page `/events`
- [ ] Create event detail page `/events/:slug`
- [ ] Create user registrations page `/profile/events`
- [ ] Add registration cancellation with confirmation modal

### Admin Features (Optional)
- [ ] Admin endpoint for viewing event attendees with meal selections
- [ ] Meal summary dashboard for catering planning
- [ ] Export attendee list to CSV
- [ ] Send individual registration links to guests via email

### Testing
- [ ] Unit tests for services
- [ ] Integration tests for API endpoints
- [ ] End-to-end tests for registration flow

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Update backend README with new endpoints
- [ ] Create quickstart guide for donor registration

## Database Schema Diagram

```
┌─────────────┐          ┌──────────────────────┐          ┌─────────────┐
│    User     │          │ EventRegistration    │          │    Event    │
│             │          │                      │          │             │
│ - id (PK)   │◄────────┤│ - id (PK)            │├────────►│ - id (PK)   │
│ - email     │          │ - user_id (FK)       │          │ - slug      │
│             │          │ - event_id (FK)      │          │ - name      │
│             │          │ - status             │          │             │
│             │          │ - number_of_guests   │          │             │
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
        0..1    │ - registration_id│ │ - registration_id│         │
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

## Files Created/Modified

### New Files:
- `backend/alembic/versions/012_add_event_registration_tables.py`
- `backend/app/models/event_registration.py`
- `backend/app/models/registration_guest.py`
- `backend/app/models/meal_selection.py`
- `backend/app/schemas/event_registration.py`
- `backend/app/schemas/registration_guest.py`
- `backend/app/schemas/meal_selection.py`
- `backend/app/services/event_registration_service.py`
- `backend/app/services/guest_service.py`
- `backend/app/services/meal_selection_service.py`
- `backend/app/api/v1/registrations.py`
- `backend/app/api/v1/public/events.py`

### Modified Files:
- `backend/app/models/__init__.py` (export new models)
- `backend/app/models/user.py` (add relationships)
- `backend/app/models/event.py` (add registrations relationship)
- `backend/app/schemas/__init__.py` (export new schemas)
- `backend/app/api/v1/__init__.py` (register new routes)

## Next Session Recommendations

1. **Start with frontend API clients** - Create axios instances with proper types
2. **Build registration wizard** - Multi-step form with validation
3. **Test end-to-end flow** - Register → Add guests → Select meals
4. **Add error handling** - Proper error messages for all failure cases
5. **Consider admin features** - Attendee list, meal summary, exports

## Notes

- All services include comprehensive logging for debugging
- Pagination is implemented for all list endpoints (max 100 per page)
- Status transitions are validated to prevent invalid state changes
- Ownership is verified on all mutations to prevent unauthorized access
- Eager loading is used to prevent N+1 query problems
- Migration can be rolled back cleanly with the downgrade function

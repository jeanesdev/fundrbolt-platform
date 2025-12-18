# Data Model: Admin PWA UI Cleanup & Role-Based Access Control

**Feature**: 009-admin-pwa-ui
**Date**: 2025-11-17

## Overview

This feature primarily uses existing database entities (User, Role, NPO, Event) without schema modifications. It introduces one new client-side entity (NPO Context) for frontend state management. All entities below are documented to clarify their usage in role-based access control and UI rendering.

---

## Entities

### 1. User (Existing - No changes)

**Source**: `backend/app/models/user.py`

**Purpose**: Represents any person using the platform with authentication and profile information.

**Fields**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | PK | Unique identifier |
| `email` | String(255) | Yes | Unique, lowercase | User's email address (login identifier) |
| `password_hash` | String(255) | Yes | Bcrypt hash | Hashed password (12+ rounds) |
| `first_name` | String(100) | Yes | 1-100 chars | User's first name |
| `last_name` | String(100) | Yes | 1-100 chars | User's last name |
| `phone` | String(20) | No | E.164 format | Phone number (optional) |
| `organization_name` | String(255) | No | Max 255 chars | Optional organization affiliation |
| `address_line1` | String(255) | No | Max 255 chars | Street address line 1 |
| `address_line2` | String(255) | No | Max 255 chars | Street address line 2 (apt/suite) |
| `city` | String(100) | No | Max 100 chars | City |
| `state` | String(100) | No | Max 100 chars | State/province |
| `postal_code` | String(20) | No | Max 20 chars | ZIP/postal code |
| `country` | String(100) | No | Max 100 chars | Country |
| `email_verified` | Boolean | Yes | Default: false | Email verification status |
| `is_active` | Boolean | Yes | Default: false | Account activation status |
| `role_id` | UUID | Yes | FK → Role | User's authorization role |
| `created_at` | DateTime | Yes | Auto | Creation timestamp |
| `updated_at` | DateTime | Yes | Auto | Last update timestamp |

**Relationships**:
- `role`: Many-to-One with `Role` (via `role_id`)
- `sessions`: One-to-Many with `Session`
- `audit_logs`: One-to-Many with `AuditLog`
- `consents`: One-to-Many with `UserConsent`

**Validation Rules** (Profile Update):
1. `email`: Valid email format, unique across users
2. `first_name`, `last_name`: 1-100 characters, no leading/trailing whitespace
3. `phone`: E.164 format (e.g., +1234567890) if provided
4. `organization_name`: Max 255 characters if provided
5. Address fields: Max length constraints, optional
6. Cannot change `password_hash` via profile update (separate endpoint)
7. Cannot change `role_id` via profile update (admin-only endpoint)

**State Transitions**: N/A (profile fields don't have state machine logic)

**Used By**:
- Profile page editing form
- User list filtering by role and NPO
- Search results (name, email)

---

### 2. Role (Existing - No changes)

**Source**: `backend/app/models/role.py`

**Purpose**: Defines authorization levels for user access control.

**Fields**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | PK | Unique identifier |
| `name` | String(50) | Yes | Unique | Role name (e.g., "SuperAdmin", "NPO Admin") |
| `description` | String(255) | No | - | Human-readable description |
| `scope` | String(20) | Yes | Enum: platform, npo, event, own | Access scope level |
| `created_at` | DateTime | Yes | Auto | Creation timestamp |
| `updated_at` | DateTime | Yes | Auto | Last update timestamp |

**Relationships**:
- `users`: One-to-Many with `User`

**Enum: Role Names** (fixed, seeded in database):
- `SuperAdmin` (scope: platform) - Full platform access, can select any NPO or "Fundrbolt Platform"
- `NPO Admin` (scope: npo) - Full access within assigned NPO(s)
- `Event Coordinator` (scope: event) - Event/auction management, read-only NPO access
- `Staff` (scope: event) - Event check-in/registration, read-only NPO access
- `Donor` (scope: own) - Own profile + bidding only (no admin PWA access)

**Validation Rules**: Roles are seeded and immutable (no user-facing CRUD).

**Used By**:
- Route guards (TanStack Router `beforeLoad`)
- Dashboard selection logic
- Navigation menu rendering
- Backend API authorization checks

---

### 3. NPO (Existing - No changes)

**Source**: `backend/app/models/npo.py`

**Purpose**: Represents a Non-Profit Organization as the tenant root for multi-tenant isolation.

**Fields** (subset relevant to this feature):

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | PK | Unique identifier |
| `name` | String(255) | Yes | Unique | NPO name (globally unique) |
| `email` | String(255) | Yes | Valid email | Contact email |
| `status` | Enum | Yes | NPOStatus enum | Approval status |
| `created_at` | DateTime | Yes | Auto | Creation timestamp |

**Enum: NPOStatus**:
- `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SUSPENDED`, `REJECTED`

**Relationships**:
- `events`: One-to-Many with `Event`
- `members`: One-to-Many with `NPOMember` (users assigned to this NPO)
- `branding`: One-to-One with `NPOBranding`

**Validation Rules**: N/A for this feature (no NPO editing in UI cleanup).

**Used By**:
- NPO selector dropdown (top-left corner)
- Backend filtering for role-based data access
- Event/user list filtering by NPO context

---

### 4. Event (Existing - No changes)

**Source**: `backend/app/models/event.py`

**Purpose**: Represents a fundraising event hosted by an NPO.

**Fields** (subset relevant to this feature):

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | PK | Unique identifier |
| `npo_id` | UUID | Yes | FK → NPO | NPO hosting the event |
| `title` | String(255) | Yes | Max 255 chars | Event title |
| `status` | Enum | Yes | EventStatus enum | Publication status |
| `start_datetime` | DateTime | Yes | Future date | Event start time |
| `end_datetime` | DateTime | Yes | After start | Event end time |
| `created_at` | DateTime | Yes | Auto | Creation timestamp |

**Enum: EventStatus**:
- `DRAFT`, `ACTIVE`, `CLOSED`

**Relationships**:
- `npo`: Many-to-One with `NPO` (via `npo_id`)
- `auction_items`: One-to-Many with `AuctionItem`
- `sponsors`: Many-to-Many with `Sponsor`

**Validation Rules**: N/A for this feature (no event editing in UI cleanup).

**Used By**:
- Event list filtering by NPO context and user role
- Search results

---

### 5. NPO Context (New - Frontend state only)

**Source**: `frontend/fundrbolt-admin/src/stores/npo-context.ts` (Zustand store)

**Purpose**: Client-side state representing the currently selected NPO for filtering data across the admin PWA.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selectedNpoId` | UUID \| null | No | ID of currently selected NPO (null = "Fundrbolt Platform" for SuperAdmin) |
| `availableNpos` | Array<{ id: UUID, name: string }> | Yes | NPOs user has access to (role-dependent) |

**State Management**:
- Stored in Zustand global store
- Persisted to localStorage (`npo-context-storage` key)
- Cleared on logout
- Populated on login from backend API (`GET /api/v1/npos?role={user_role}`)

**State Transitions**:
1. **Initial state** (on login): `selectedNpoId = null`, `availableNpos = []`
2. **Load available NPOs**: Fetch from backend based on role → populate `availableNpos`
3. **SuperAdmin auto-select**: Set `selectedNpoId = null` ("Fundrbolt Platform" view)
4. **NPO Admin/Staff auto-select**: Set `selectedNpoId = availableNpos[0].id` (only one NPO)
5. **User selects NPO**: Update `selectedNpoId` → invalidate TanStack Query cache → refetch all data
6. **Logout**: Clear store and localStorage

**Validation Rules**:
- SuperAdmin can select `null` (all NPOs) or any specific NPO ID
- NPO Admin can only select their assigned NPO (selector disabled if only one NPO)
- Event Coordinator can select from NPOs they're registered with
- Staff can only select their assigned NPO (selector disabled)

**Used By**:
- NPO selector component rendering
- Backend API calls (pass `npoId` query param)
- TanStack Query cache invalidation

---

## Entity Relationships

```text
User ──(role_id)──> Role
     \
      \__(npo assignments)__> NPOMember ──> NPO
                                                \
                                                 \__(npo_id)__> Event

NPO Context (frontend) ──(filters queries by)──> NPO, Event, User
```

---

## Data Flow Diagrams

### Profile Update Flow

```text
User edits profile form (ProfileForm.tsx)
  └─> Client validation (Zod schema)
      └─> PATCH /api/v1/users/{id}
          └─> Backend validation (Pydantic schema)
              └─> Update User record (SQLAlchemy)
                  └─> Return updated User
                      └─> Update TanStack Query cache
                          └─> UI reflects changes
```

### NPO Context Selection Flow

```text
User clicks NPO selector (NpoSelector.tsx)
  └─> Display available NPOs from Zustand store
      └─> User selects NPO
          └─> Update store: selectedNpoId = selected_npo_id
              └─> Invalidate TanStack Query cache
                  └─> All queries refetch with new npoId param
                      └─> Backend filters results by NPO
                          └─> UI updates with filtered data
```

### Role-Based Dashboard Routing

```text
User navigates to /dashboard
  └─> Router beforeLoad hook extracts role from JWT
      └─> Role = "SuperAdmin" → SuperAdminDashboard
      └─> Role = "NPO Admin" → NpoAdminDashboard
      └─> Role = "Event Coordinator" → AuctioneerDashboard
      └─> Role = "Staff" → EventDashboard
      └─> Role = "Donor" → Redirect to /unauthorized
```

### Search Flow

```text
User types in search bar (SearchBar.tsx)
  └─> Debounce 300ms
      └─> GET /api/v1/search?q={query}&role={role}&npoId={selectedNpoId}
          └─> Backend searches User, NPO, Event tables
              └─> Apply role-based filtering (see below)
                  └─> Return top 20 results per entity type
                      └─> Display in SearchResults.tsx
```

**Role-Based Filtering Logic** (Backend):

| Role | Filtered Entities | Filter Logic |
|------|------------------|--------------|
| SuperAdmin | All | If `npoId = null`: No filter. If `npoId = X`: Filter by `npo_id = X` |
| NPO Admin | Users, Events | Filter by `npo_id IN (user's assigned NPOs)` |
| Event Coordinator | NPOs (read-only), Events, Users | NPOs: registered NPOs only. Events: assigned events. Users: event attendees |
| Staff | NPO (read-only), Events, Users | NPO: assigned NPO only. Events: assigned events. Users: event attendees |
| Donor | None | No search access in admin PWA |

---

## Validation Summary

| Entity | Validation Location | Framework |
|--------|-------------------|-----------|
| User (Profile) | Frontend: `ProfileForm.tsx` | React Hook Form + Zod |
| User (Profile) | Backend: `app/schemas/user.py` | Pydantic |
| NPO Context | Frontend: `useNpoContext()` hook | TypeScript type guards |
| Search Query | Frontend: `SearchBar.tsx` | Min 2 chars, debounced |
| Search Query | Backend: `app/schemas/search.py` | Pydantic |

---

## No Schema Migrations Required

This feature does **not modify** the database schema. All entities (User, Role, NPO, Event) are existing with sufficient fields for the feature requirements. The NPO Context entity is frontend-only state (Zustand store + localStorage).

**Existing schema validation**:
- ✅ User model has all profile fields (first_name, last_name, email, phone, organization_name, address_*)
- ✅ Role model has name and scope fields
- ✅ NPO model has name and status fields
- ✅ Event model has npo_id foreign key for filtering
- ✅ Database indexes exist on user.email, role.name, npo.name for search performance

**No new migrations needed** - Proceeding to API contract generation.

# Tasks: Event Sponsors

**Feature**: 007-sponsors
**Date**: 2025-11-12
**Input**: Design documents from `.specify/specs/007-sponsors/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sponsors.openapi.yaml

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/`, `backend/alembic/`
- **Frontend**: `frontend/augeo-admin/src/`
- **Tests**: `backend/app/tests/`, `frontend/augeo-admin/src/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create feature branch 007-sponsors if not already created
- [ ] T002 [P] Review existing MediaService and FileUploadService patterns in `backend/app/services/media_service.py` and `backend/app/services/file_upload_service.py`
- [ ] T003 [P] Review EventMedia model pattern in `backend/app/models/event.py` for logo upload reference

**Checkpoint**: Development environment ready, existing patterns understood

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [x] T004 Create Alembic migration in `backend/alembic/versions/XXXX_add_sponsors_table.py` with:
  - sponsors table (25 fields per data-model.md)
  - Foreign keys to events (ON DELETE CASCADE) and users (created_by)
  - Indexes: idx_sponsors_event_id, idx_sponsors_display_order, idx_sponsors_created_by
  - Constraints: UNIQUE(event_id, name), CHECK(donation_amount >= 0), CHECK(logo_size enum)
- [x] T005 Run migration: `cd backend && poetry run alembic upgrade head`
- [x] T006 Verify migration with: `poetry run alembic history` and database inspection

### Backend Core Models

- [x] T007 [P] Create LogoSize enum in `backend/app/models/sponsor.py` with values: xsmall, small, medium, large, xlarge
- [x] T008 Create Sponsor model in `backend/app/models/sponsor.py` with:
  - SQLAlchemy ORM mapping to sponsors table
  - Relationships: event (many-to-one), creator (many-to-one via created_by)
  - Default values: logo_size='large', display_order=0
  - Validation: logo_size enum constraint

### Backend Core Schemas

- [x] T009 [P] Create LogoSize enum in `backend/app/schemas/sponsor.py` (mirror model enum)
- [x] T010 Create SponsorBase schema in `backend/app/schemas/sponsor.py` with all sponsor fields
- [x] T011 Create SponsorCreate schema extending SponsorBase with required logo metadata
- [x] T012 Create SponsorUpdate schema with all optional fields
- [x] T013 Create SponsorResponse schema extending SponsorBase with id, timestamps
- [x] T014 Create SponsorCreateResponse schema with sponsor, upload_url, expires_at
- [x] T015 Create LogoUploadRequest schema with file_name, file_type, file_size
- [x] T016 Create LogoUploadResponse schema with upload_url, expires_at
- [x] T017 Create ReorderRequest schema with sponsor_ids array

### Frontend Core Types

- [x] T018 [P] Create LogoSize enum in `frontend/augeo-admin/src/types/sponsor.ts` (mirror backend)
- [x] T019 Create Sponsor interface in `frontend/augeo-admin/src/types/sponsor.ts` with all 25 fields
- [x] T020 Create SponsorCreateRequest interface
- [x] T021 Create SponsorUpdateRequest interface
- [x] T022 Create SponsorLogoUploadRequest interface
- [x] T023 Create SponsorLogoUploadResponse interface
- [x] T024 Create ReorderSponsorsRequest interface

**Checkpoint**: ✅ Foundation ready - database migrated, models/schemas/types defined, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Add Basic Sponsor Information (Priority: P1) 🎯 MVP

**Goal**: Event organizers can add sponsors with name and logo, see sponsor list with thumbnails

**Independent Test**: Create event → Add sponsor with name and logo → Verify sponsor appears in list with thumbnail

### Backend Services (User Story 1)

- [x] T025 [P] [US1] Create SponsorService in `backend/app/services/sponsor_service.py` with:
  - get_sponsors_for_event(event_id) → List[Sponsor] ✅
  - get_sponsor_by_id(sponsor_id, event_id) → Optional[Sponsor] ✅
  - check_duplicate_name(event_id, name, exclude_id=None) → bool ✅
  - create_sponsor() with auto-increment display_order ✅
- [x] T026 [P] [US1] Create SponsorLogoService in `backend/app/services/sponsor_logo_service.py` wrapping FileUploadService:
  - generate_upload_url(sponsor_id, file_name, file_type, file_size) → (upload_url, expires_at) ✅
  - confirm_upload(sponsor_id) → Sponsor (includes thumbnail generation) ✅
  - generate_thumbnail(blob_name) → thumbnail_blob_name (128x128 using Pillow) ✅
  - delete_logo_blobs(logo_blob_name, thumbnail_blob_name) → None ✅
- [x] T027 [US1] Implement create_sponsor(event_id, data, current_user) in SponsorService with:
  - Validation: name uniqueness per event ✅
  - Generate Azure Blob Storage SAS URL for logo upload ✅
  - Create sponsor record with display_order = max(current) + 1 ✅
  - Return sponsor + upload_url ✅
- [x] T028 [US1] Add file validation to SponsorLogoService:
  - Allowed MIME types: image/png, image/jpeg, image/jpg, image/svg+xml, image/webp ✅
  - Max file size: 5MB (5,242,880 bytes) ✅
  - Min dimensions: 64x64 pixels ✅
  - Max dimensions: 2048x2048 pixels ✅
  - Magic byte validation for file type verification ✅

### Backend API Endpoints (User Story 1)

- [x] T029 [P] [US1] Create sponsors router in `backend/app/api/v1/sponsors.py` with FastAPI router setup ✅
- [x] T030 [US1] Implement POST /events/{event_id}/sponsors endpoint:
  - Permission check: require_event_permissions ✅
  - Call SponsorService.create_sponsor() ✅
  - Return 201 with SponsorCreateResponse ✅
  - Error handling: 400 (validation), 403 (permission), 404 (event not found), 413 (file too large) ✅
- [x] T031 [US1] Implement GET /events/{event_id}/sponsors endpoint:
  - Permission check: require_event_permissions (read) ✅
  - Call SponsorService.get_sponsors_for_event() ✅
  - Return 200 with List[SponsorResponse] ✅
  - Order by: display_order ASC, logo_size DESC ✅
- [x] T032 [US1] Implement POST /events/{event_id}/sponsors/{sponsor_id}/logo/upload-url endpoint:
  - Permission check: require_event_permissions ✅
  - Validate LogoUploadRequest ✅
  - Call SponsorLogoService.generate_upload_url() ✅
  - Return 200 with LogoUploadResponse ✅
- [x] T033 [US1] Implement POST /events/{event_id}/sponsors/{sponsor_id}/logo/confirm endpoint:
  - Permission check: require_event_permissions ✅
  - Call SponsorLogoService.confirm_upload() (generates thumbnail) ✅
  - Return 200 with SponsorResponse ✅
- [x] T034 [US1] Register sponsors router in `backend/app/main.py`:
  - Add router to app with prefix /api/v1 ✅

### Frontend Services (User Story 1)

- [x] T035 [P] [US1] Create SponsorService in `frontend/augeo-admin/src/services/sponsor-service.ts` with:
  - listSponsors(eventId: string) → Promise\<Sponsor\[\]\> ✅
  - createSponsor(eventId: string, data: SponsorCreateRequest) → Promise\<SponsorCreateResponse\> ✅
  - requestLogoUploadUrl(eventId: string, sponsorId: string, request: LogoUploadRequest) → Promise\<LogoUploadResponse\> ✅
  - confirmLogoUpload(eventId: string, sponsorId: string) → Promise\<Sponsor\> ✅
- [x] T036 [US1] Add logo upload helper in SponsorService:
  - uploadLogo(file: File, uploadUrl: string) → Promise\<void\> (PUT to Azure SAS URL) ✅
  - Axios PUT with file content, set Content-Type header ✅

### Frontend State Management (User Story 1)

- [x] T037 [US1] Create sponsor store in `frontend/augeo-admin/src/stores/sponsor-store.ts` with Zustand:
  - State: sponsors: Sponsor[], loading: boolean, error: string | null ✅
  - Actions: fetchSponsors(eventId), addSponsor(eventId, data), clearSponsors() ✅
  - Optimistic updates for add sponsor ✅

### Frontend Components (User Story 1)

- [x] T038 [P] [US1] Create SponsorCard component in `frontend/augeo-admin/src/features/events/components/SponsorCard.tsx`:
  - Display thumbnail logo (lazy loading with loading="lazy") ✅
  - Display sponsor name ✅
  - Apply logo size CSS class based on logo_size field (xsmall=64px, small=96px, medium=128px, large=192px, xlarge=256px) ✅
  - Clickable if website_url provided (open in new tab with rel="noopener noreferrer") ✅
  - Aria-label for accessibility ✅
- [x] T039 [P] [US1] Create SponsorList component in `frontend/augeo-admin/src/features/events/components/SponsorList.tsx`:
  - Grid layout for sponsor cards ✅
  - Loading skeleton state ✅
  - Empty state ("No sponsors yet" with add button) ✅
  - Error state with retry button ✅
- [x] T040 [US1] Create SponsorForm component in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - React Hook Form with Zod validation ✅
  - Name field (required, max 200 chars) ✅
  - Logo file upload (required, 5MB max, format validation) ✅
  - File upload with progress indicator ✅
  - Form validation errors display ✅
  - Submit → call create API → upload logo → confirm upload ✅
- [x] T041 [US1] Create SponsorsTab component in `frontend/augeo-admin/src/features/events/components/SponsorsTab.tsx`:
  - Integrate SponsorList and SponsorForm ✅
  - Fetch sponsors on tab mount using useSponsorStore ✅
  - Add sponsor button toggles form modal/drawer ✅
  - Success toast on sponsor creation ✅
  - Error toast on failures ✅
- [x] T042 [US1] Update EventDetailTabs in `frontend/augeo-admin/src/features/events/components/EventDetail.tsx`:
  - Add "Sponsors" tab to tabs array ✅
  - Conditional render SponsorsTab component when active ✅
  - Lazy load sponsors on tab activation ✅

### Tests (User Story 1)

- [x] T043 [P] [US1] Contract test for POST /events/{id}/sponsors in `backend/app/tests/test_sponsors_api.py`:
  - Test successful sponsor creation with valid data ✅
  - Test upload URL returned in response ✅
  - Test 400 for invalid data (name too long, file size exceeds limit) ✅
  - Test 403 for non-organizer user ✅
  - Test 404 for non-existent event ✅
  - Test 413 for file too large ✅
  - **Result**: 12 contract tests created (merged T043-T046)
- [x] T044 [P] [US1] Contract test for GET /events/{id}/sponsors in `backend/app/tests/test_sponsors_api.py`:
  - Test returns empty array for event with no sponsors ✅
  - Test returns all sponsors ordered by display_order, logo_size ✅
  - Test 404 for non-existent event ✅
  - **Merged into T043**
- [x] T045 [P] [US1] Contract test for POST /sponsors/{id}/logo/upload-url in `backend/app/tests/test_sponsors_api.py`:
  - Test returns valid SAS URL ✅
  - Test expires_at is ~1 hour in future ✅
  - Test 400 for invalid file metadata ✅
  - **Merged into T043**
- [x] T046 [P] [US1] Contract test for POST /sponsors/{id}/logo/confirm in `backend/app/tests/test_sponsors_api.py`:
  - Test thumbnail_url populated after confirmation ✅
  - Test sponsor logo_url accessible ✅
  - **Merged into T043**
- [x] T047 [P] [US1] Service test for SponsorService in `backend/app/tests/test_sponsor_service.py`:
  - Test create_sponsor with unique name ✅
  - Test create_sponsor rejects duplicate name ✅
  - Test get_sponsors_for_event ordering ✅
  - **Result**: 11 service tests created
- [x] T048 [P] [US1] Service test for SponsorLogoService in `backend/app/tests/test_sponsor_logo_service.py`:
  - Test file validation (size, format, dimensions) ✅
  - Test thumbnail generation (128x128 output) ✅
  - Test SAS URL generation ✅
  - **Result**: 15 logo service tests created
- [x] T049 [P] [US1] Integration test for full sponsor creation flow in `backend/app/tests/test_sponsors_integration.py`:
  - Create sponsor → request upload URL → mock upload → confirm → verify thumbnail exists ✅
  - Test duplicate name validation ✅
  - Test file size validation (6MB rejection) ✅
  - Test ordering by display_order ✅
  - **Result**: 4 integration tests created with full Azure Blob Storage mocking
- [x] T050 [P] [US1] Frontend component test for SponsorList in `frontend/augeo-admin/src/tests/features/events/SponsorList.test.tsx`:
  - Test renders empty state ✅
  - Test renders sponsor cards ✅
  - Test loading state ✅
  - Test error state ✅
  - Test group headers by logo size ✅
  - Test add button visibility (readonly vs editable) ✅
  - Test edge cases (single sponsor, same size grouping) ✅
  - **Result**: 19 tests created
- [x] T051 [P] [US1] Frontend component test for SponsorForm in `frontend/augeo-admin/src/tests/features/events/SponsorForm.test.tsx`:
  - Test form validation (name required, file size limit) ✅
  - Test file upload success flow ✅
  - Test error handling ✅
  - Test create mode with all required/optional fields ✅
  - Test edit mode with pre-populated data ✅
  - Test logo preview and clear functionality ✅
  - Test form submission (create and update) ✅
  - Test validation (email, URL, donation amount) ✅
  - Test file type and size passing ✅
  - Test disabled states during submission ✅
  - **Result**: 27 tests created

**Checkpoint**: User Story 1 ✅ 100% COMPLETE - 88 total tests passing (42 backend + 46 frontend). Full test coverage for sponsor creation with logo upload. MVP ready for deployment.

---

## Phase 4: User Story 2 - Configure Sponsor Display Preferences (Priority: P2)

**Goal**: Event organizers can set logo size (xsmall-xlarge) and sponsor level/tier

**Independent Test**: Add sponsor → Set logo_size to "xlarge" and sponsor_level to "Platinum" → Verify display reflects settings

### Frontend Components (User Story 2)

- [x] T052 [P] [US2] Add logo_size field to SponsorForm in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - Dropdown/select for LogoSize enum (xsmall, small, medium, large, xlarge) ✅
  - Default value: "large" ✅ (Fixed from "medium" to match backend)
  - Zod validation with enum ✅
  - **Result**: Already implemented in Phase 3, verified functional
- [x] T053 [P] [US2] Add sponsor_level field to SponsorForm:
  - Text input (optional, max 100 chars) ✅
  - Placeholder: e.g., "Gold", "Platinum", "Title Sponsor" ✅
  - Validation: max length 100 ✅
  - **Result**: Already implemented in Phase 3, verified functional
- [x] T054 [US2] Update SponsorCard in `frontend/augeo-admin/src/features/events/components/SponsorCard.tsx`:
  - Apply CSS size classes based on logo_size (xsmall=64px, small=96px, medium=128px, large=192px, xlarge=256px) ✅
  - Display sponsor_level badge/label if present ✅
  - Tailwind classes: w-16 (xsmall), w-24 (small), w-32 (medium), w-48 (large), w-64 (xlarge) ✅
  - **Result**: Already implemented in Phase 3 with dynamic sizing, verified functional
- [x] T055 [US2] Update SponsorList to maintain visual hierarchy:
  - Sponsors with xlarge logos displayed prominently at top ✅
  - Grid layout adapts to different logo sizes ✅
  - Responsive design for mobile vs desktop ✅
  - **Result**: Already implemented with grouping by size (Title/Platinum/Gold/Silver/Bronze)

### Tests (User Story 2)

- [x] T056 [P] [US2] Contract test for sponsor creation with logo_size in `backend/app/tests/contract/test_sponsors_api.py`:
  - Test logo_size default to "large" if not provided ✅
  - Test logo_size accepts all enum values ✅
  - Test logo_size rejects invalid values ✅
  - Test sponsor_level field ✅
  - **Result**: Already exists (test_create_sponsor_with_default_logo_size, test_create_sponsor_with_all_logo_sizes, test_create_sponsor_rejects_invalid_logo_size, test_create_sponsor_with_sponsor_level)
- [x] T057 [P] [US2] Frontend test for logo_size display in `frontend/augeo-admin/src/tests/features/events/SponsorCard.test.tsx`:
  - Test xlarge logo renders with w-64 (256px) ✅
  - Test xsmall logo renders with w-16 (64px) ✅
  - Test all logo sizes render correct CSS classes ✅
  - Test sponsor_level badge displays ✅
  - Test fallback behavior ✅
  - Test image rendering with object-contain ✅
  - **Result**: 16 tests created

**Checkpoint**: User Story 2 ✅ COMPLETE - logo size and sponsor tier fully configurable with tests (most functionality already existed from Phase 3, added 16 new frontend display tests and fixed default)

---

## Phase 5: User Story 6 - Edit and Remove Sponsors (Priority: P2)

**Goal**: Event organizers can update sponsor information or delete sponsors

**Independent Test**: Create sponsor → Edit name and logo_size → Verify changes persist. Delete sponsor → Verify removed from list

### Backend Services (User Story 6)

- [ ] T058 [P] [US6] Implement update_sponsor(sponsor_id, event_id, data, current_user) in `backend/app/services/sponsor_service.py`:
  - Validate name uniqueness if name changed
  - Update fields provided in SponsorUpdate schema
  - Return updated Sponsor
- [ ] T059 [P] [US6] Implement delete_sponsor(sponsor_id, event_id) in SponsorService:
  - Delete sponsor record (CASCADE to database)
  - Call SponsorLogoService.delete_logo_blobs() to remove Azure blobs
  - Audit log: sponsor.deleted event

### Backend API Endpoints (User Story 6)

- [ ] T060 [US6] Implement PATCH /events/{event_id}/sponsors/{sponsor_id} endpoint in `backend/app/api/v1/sponsors.py`:
  - Permission check: require_event_permissions
  - Call SponsorService.update_sponsor()
  - Return 200 with SponsorResponse
  - Error handling: 400 (validation), 403 (permission), 404 (not found)
- [ ] T061 [US6] Implement DELETE /events/{event_id}/sponsors/{sponsor_id} endpoint:
  - Permission check: require_event_permissions
  - Call SponsorService.delete_sponsor()
  - Return 204 No Content
  - Error handling: 403 (permission), 404 (not found)
- [ ] T062 [US6] Implement GET /events/{event_id}/sponsors/{sponsor_id} endpoint:
  - Permission check: require_event_permissions (read)
  - Call SponsorService.get_sponsor_by_id()
  - Return 200 with SponsorResponse
  - Error handling: 404 (not found)

### Frontend Services (User Story 6)

- [ ] T063 [P] [US6] Add updateSponsor method to `frontend/augeo-admin/src/services/sponsor-service.ts`:
  - updateSponsor(eventId: string, sponsorId: string, data: SponsorUpdateRequest) → Promise\<Sponsor\>
- [ ] T064 [P] [US6] Add deleteSponsor method to SponsorService:
  - deleteSponsor(eventId: string, sponsorId: string) → Promise\<void\>
- [ ] T065 [P] [US6] Add getSponsor method to SponsorService:
  - getSponsor(eventId: string, sponsorId: string) → Promise\<Sponsor\>

### Frontend State Management (User Story 6)

- [ ] T066 [US6] Add update/delete actions to `frontend/augeo-admin/src/stores/sponsor-store.ts`:
  - updateSponsor(eventId, sponsorId, data) with optimistic update
  - deleteSponsor(eventId, sponsorId) with optimistic removal
  - getSponsor(eventId, sponsorId) for fetching single sponsor

### Frontend Components (User Story 6)

- [ ] T067 [P] [US6] Add edit mode to SponsorForm in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - Accept optional sponsor prop for edit mode
  - Pre-populate form with existing sponsor data
  - Submit → call update API instead of create
  - Optional logo replacement (new upload flow)
- [ ] T068 [P] [US6] Add edit/delete buttons to SponsorCard in `frontend/augeo-admin/src/features/events/components/SponsorCard.tsx`:
  - Edit button opens SponsorForm in edit mode
  - Delete button shows confirmation dialog
  - Confirmation → call deleteSponsor → remove from UI
  - Loading/disabled states during operations
- [ ] T069 [US6] Add logo replacement flow to SponsorForm:
  - Optional file upload field in edit mode
  - If new file provided: request upload URL → upload → confirm
  - If no new file: keep existing logo_url
  - Show current logo thumbnail in edit form

### Tests (User Story 6)

- [ ] T070 [P] [US6] Contract test for PATCH /sponsors/{id} in `backend/app/tests/test_sponsors_api.py`:
  - Test update name
  - Test update logo_size
  - Test update optional fields (sponsor_level, contact_name, etc.)
  - Test 400 for duplicate name
  - Test 404 for non-existent sponsor
- [ ] T071 [P] [US6] Contract test for DELETE /sponsors/{id} in `backend/app/tests/test_sponsors_api.py`:
  - Test successful deletion returns 204
  - Test sponsor removed from database
  - Test logo blobs deleted from Azure Storage (mock)
  - Test 404 for non-existent sponsor
- [ ] T072 [P] [US6] Contract test for GET /sponsors/{id} in `backend/app/tests/test_sponsors_api.py`:
  - Test returns sponsor details
  - Test 404 for non-existent sponsor
- [ ] T073 [P] [US6] Frontend test for edit flow in `frontend/augeo-admin/src/tests/features/events/SponsorForm.test.tsx`:
  - Test form pre-populated in edit mode
  - Test update submission
  - Test logo replacement
- [ ] T074 [P] [US6] Frontend test for delete flow in `frontend/augeo-admin/src/tests/features/events/SponsorCard.test.tsx`:
  - Test delete confirmation dialog
  - Test deletion removes sponsor from list

**Checkpoint**: User Story 6 complete - sponsors editable and deletable

---

## Phase 6: User Story 3 - Add Sponsor Contact Information (Priority: P3)

**Goal**: Event organizers can store contact details (name, email, phone, address)

**Independent Test**: Add sponsor with contact information → Verify all contact fields saved and retrievable

### Frontend Components (User Story 3)

- [ ] T075 [P] [US3] Add contact fields section to SponsorForm in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - contact_name (optional, max 200 chars)
  - contact_email (optional, email validation)
  - contact_phone (optional, max 20 chars)
  - Collapsible "Contact Information" accordion/section
- [ ] T076 [P] [US3] Add address fields section to SponsorForm:
  - address_line1 (optional, max 200 chars)
  - address_line2 (optional, max 200 chars)
  - city (optional, max 100 chars)
  - state (optional, max 100 chars)
  - postal_code (optional, max 20 chars)
  - country (optional, max 100 chars)
  - Collapsible "Address" section
- [ ] T077 [US3] Add contact info display to SponsorCard (optional expanded view):
  - Show contact details on hover/click (tooltip or expandable section)
  - Email as mailto: link if present
  - Phone as tel: link if present

### Frontend Validation (User Story 3)

- [ ] T078 [US3] Add Zod validation for contact fields in SponsorForm:
  - contact_email: z.string().email().optional()
  - contact_phone: z.string().max(20).optional()
  - All other contact fields: string max length validations
  - Backend will enforce same validations via Pydantic

### Tests (User Story 3)

- [ ] T079 [P] [US3] Contract test for sponsor with contact info in `backend/app/tests/test_sponsors_api.py`:
  - Test create sponsor with all contact fields
  - Test contact_email validation rejects invalid email
  - Test contact fields persist in database
- [ ] T080 [P] [US3] Frontend test for contact form in `frontend/augeo-admin/src/tests/features/events/SponsorForm.test.tsx`:
  - Test contact fields optional
  - Test email validation
  - Test all contact fields submitted

**Checkpoint**: User Story 3 complete - contact information capturable

---

## Phase 7: User Story 4 - Track Sponsor Financial Information (Priority: P3)

**Goal**: Event organizers can record donation amounts and notes

**Independent Test**: Add sponsor with donation_amount and notes → Verify fields saved and viewable

### Frontend Components (User Story 4)

- [ ] T081 [P] [US4] Add financial fields to SponsorForm in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - donation_amount (optional, number input, non-negative, max 999,999,999.99)
  - notes (optional, textarea, no max length)
  - Collapsible "Financial Information" section
- [ ] T082 [US4] Format donation_amount as currency in SponsorCard:
  - Display with USD currency symbol if present
  - Format: $X,XXX.XX using Intl.NumberFormat
  - Only show if donation_amount > 0

### Frontend Validation (User Story 4)

- [ ] T083 [US4] Add Zod validation for financial fields:
  - donation_amount: z.number().nonnegative().max(999999999.99).optional()
  - notes: z.string().optional()

### Tests (User Story 4)

- [ ] T084 [P] [US4] Contract test for financial fields in `backend/app/tests/test_sponsors_api.py`:
  - Test create sponsor with donation_amount
  - Test donation_amount rejects negative values
  - Test donation_amount max value enforced
  - Test notes field accepts long text
- [ ] T085 [P] [US4] Frontend test for financial form in `frontend/augeo-admin/src/tests/features/events/SponsorForm.test.tsx`:
  - Test donation_amount validation (non-negative)
  - Test notes field

**Checkpoint**: User Story 4 complete - financial tracking enabled

---

## Phase 8: User Story 5 - Link Sponsors to External Resources (Priority: P4)

**Goal**: Sponsor logos/names clickable to sponsor websites

**Independent Test**: Add sponsor with website_url → Click logo → Verify opens sponsor website in new tab

### Frontend Components (User Story 5)

- [ ] T086 [P] [US5] Add website_url field to SponsorForm in `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx`:
  - Text input (optional, URL validation)
  - Placeholder: `https://example.com`
  - Zod validation: z.string().url().optional()
- [ ] T087 [US5] Make SponsorCard logo/name clickable in `frontend/augeo-admin/src/features/events/components/SponsorCard.tsx`:
  - If website_url present: wrap in anchor tag with link
  - target="_blank" rel="noopener noreferrer"
  - aria-label="Visit {sponsor.name} website"
  - Visual indicator (cursor pointer, underline on hover)

### Tests (User Story 5)

- [ ] T088 [P] [US5] Contract test for website_url in `backend/app/tests/test_sponsors_api.py`:
  - Test create sponsor with valid URL
  - Test website_url validation rejects invalid URLs
  - Test website_url is optional
- [ ] T089 [P] [US5] Frontend test for clickable logo in `frontend/augeo-admin/src/tests/features/events/SponsorCard.test.tsx`:
  - Test logo is clickable link if website_url present
  - Test link has target="_blank" and rel="noopener noreferrer"
  - Test logo is not clickable if no website_url

**Checkpoint**: User Story 5 complete - sponsors linkable to websites

---

## Phase 9: Reordering Sponsors (Enhancement)

**Goal**: Event organizers can drag-and-drop reorder sponsors

**Independent Test**: Add 3 sponsors → Drag sponsor #3 to position #1 → Verify order persists

### Backend Services (Reordering)

- [ ] T090 [P] Implement reorder_sponsors(event_id, sponsor_ids_ordered) in `backend/app/services/sponsor_service.py`:
  - Validate all sponsor_ids belong to event
  - Update display_order for each sponsor based on array index
  - Return reordered list

### Backend API Endpoints (Reordering)

- [ ] T091 Implement PATCH /events/{event_id}/sponsors/reorder endpoint in `backend/app/api/v1/sponsors.py`:
  - Permission check: require_event_permissions
  - Call SponsorService.reorder_sponsors()
  - Return 200 with reordered List[SponsorResponse]
  - Error handling: 400 (invalid IDs), 403 (permission), 404 (event not found)

### Frontend Services (Reordering)

- [ ] T092 [P] Add reorderSponsors method to `frontend/augeo-admin/src/services/sponsor-service.ts`:
  - reorderSponsors(eventId: string, sponsorIds: string[]) → Promise<Sponsor[]>

### Frontend State Management (Reordering)

- [ ] T093 Add reorder action to `frontend/augeo-admin/src/stores/sponsor-store.ts`:
  - reorderSponsors(eventId, sponsorIds) with optimistic reorder

### Frontend Components (Reordering)

- [ ] T094 Add drag-and-drop to SponsorList in `frontend/augeo-admin/src/features/events/components/SponsorList.tsx`:
  - Install react-beautiful-dnd or @dnd-kit/core
  - Wrap sponsor cards in draggable components
  - onDragEnd → call reorderSponsors store action
  - Visual feedback during drag (opacity, elevation)

### Tests (Reordering)

- [ ] T095 [P] Contract test for PATCH /sponsors/reorder in `backend/app/tests/test_sponsors_api.py`:
  - Test successful reorder updates display_order
  - Test 400 for invalid sponsor IDs
  - Test 404 for non-existent event
- [ ] T096 [P] Frontend test for drag-and-drop in `frontend/augeo-admin/src/tests/features/events/SponsorList.test.tsx`:
  - Test sponsor order changes after drag
  - Test reorder API called with correct IDs

**Checkpoint**: Reordering complete - sponsors manually sortable

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Documentation

- [ ] T097 [P] Update backend README in `backend/README.md` with sponsor API endpoints
- [ ] T098 [P] Update frontend README in `frontend/augeo-admin/README.md` with Sponsors tab usage
- [ ] T099 [P] Add API examples to quickstart.md based on implementation

### Monitoring

- [ ] T100 [P] Add Prometheus metrics in `backend/app/core/metrics.py`:
  - augeo_sponsor_uploads_total counter (status: success/failure)
  - augeo_sponsor_operations_total counter (operation: create/update/delete, status)
- [ ] T101 [P] Add structured logging for sponsor operations:
  - INFO: Sponsor created/updated/deleted (user_id, event_id, sponsor_id)
  - WARNING: Logo validation failure (file size, type)
  - ERROR: Azure Blob upload failure

### Error Handling

- [ ] T102 Add user-friendly error messages for sponsor operations:
  - "Logo file size exceeds 5MB limit. Please use a smaller image."
  - "Sponsor name already exists for this event. Please choose a different name."
  - "Failed to upload logo. Please try again."
  - "Unable to generate thumbnail. Contact support if this persists."

### Accessibility

- [ ] T103 [P] Ensure sponsor components meet WCAG 2.1 AA:
  - Logo images have alt text: "{sponsor.name} logo"
  - Form labels associated with inputs
  - Keyboard navigation for edit/delete buttons
  - Focus visible on interactive elements
  - Aria-live announcements for upload progress

### Performance Optimization

- [ ] T104 [P] Optimize sponsor list rendering:
  - Lazy load logos with Intersection Observer
  - loading="lazy" attribute on img tags
  - Virtualization if > 50 sponsors (react-window or react-virtualized)
- [ ] T105 [P] Add caching for sponsor list:
  - Zustand store with 5-minute TTL
  - Invalidate cache on create/update/delete
  - Optional: Redis cache on backend (Phase 2 enhancement)

### Security Hardening

- [ ] T106 Review and test security measures:
  - CSRF protection on all mutating endpoints
  - XSS prevention via React escaping
  - File upload validation (MIME type, magic bytes)
  - Permission enforcement on all endpoints
  - Audit logging for all sponsor mutations

### Validation

- [ ] T107 Run quickstart.md validation:
  - Follow all examples in quickstart.md
  - Verify curl commands work
  - Test frontend workflows match documentation
  - Update examples if implementation differs

### Code Quality

- [ ] T108 [P] Run linters and formatters:
  - Backend: `cd backend && poetry run ruff check . && poetry run black .`
  - Frontend: `cd frontend/augeo-admin && pnpm lint && pnpm format`
- [ ] T109 [P] Run type checkers:
  - Backend: `cd backend && poetry run mypy app`
  - Frontend: `cd frontend/augeo-admin && pnpm type-check`
- [ ] T110 Cleanup and refactoring:
  - Remove debug logging
  - Extract magic numbers to constants
  - Add docstrings to service methods
  - Ensure consistent error handling patterns

### Testing

- [ ] T111 Run full test suite:
  - Backend: `cd backend && poetry run pytest --cov=app --cov-report=html`
  - Frontend: `cd frontend/augeo-admin && pnpm test --coverage`
  - Target: 80%+ coverage for new code
- [ ] T112 [P] Manual testing checklist:
  - Add sponsor with all fields populated
  - Add sponsor with only required fields (name, logo)
  - Upload logo at size limits (4.9MB OK, 5.1MB rejected)
  - Upload invalid file type (PDF → rejected)
  - Edit sponsor name, logo, all optional fields
  - Delete sponsor (verify logo blobs removed)
  - Reorder sponsors via drag-and-drop
  - Test permissions (non-organizer cannot manage sponsors)
  - Test across browsers (Chrome, Firefox, Safari)
  - Test responsive design (mobile, tablet, desktop)

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - can start immediately
2. **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
3. **User Story 1 (Phase 3)**: Depends on Foundational - Core functionality (MVP)
4. **User Story 2 (Phase 4)**: Depends on Foundational - Can run in parallel with US1 if desired
5. **User Story 6 (Phase 5)**: Depends on US1 complete (needs edit/delete of created sponsors)
6. **User Story 3 (Phase 6)**: Depends on Foundational - Can run in parallel with US1/US2
7. **User Story 4 (Phase 7)**: Depends on Foundational - Can run in parallel with US1/US2/US3
8. **User Story 5 (Phase 8)**: Depends on US1 (needs clickable logos)
9. **Reordering (Phase 9)**: Depends on US1 (needs list of sponsors to reorder)
10. **Polish (Phase 10)**: Depends on all desired user stories being complete

### Recommended Execution Order

**MVP Path (Fastest to Production)**:

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL - blocks everything)
3. Phase 3: User Story 1 (P1) - Add sponsors with name and logo
4. **STOP AND DEPLOY MVP** - Basic sponsor management functional
5. Phase 4: User Story 2 (P2) - Display preferences
6. Phase 5: User Story 6 (P2) - Edit and delete
7. Phase 6: User Story 3 (P3) - Contact information
8. Phase 7: User Story 4 (P3) - Financial tracking
9. Phase 8: User Story 5 (P4) - Website links
10. Phase 9: Reordering (Enhancement)
11. Phase 10: Polish

**Parallel Team Strategy** (Multiple Developers):

After Phase 2 (Foundational) is complete:

- **Developer A**: User Story 1 (Phase 3) - Core functionality
- **Developer B**: User Story 2 (Phase 4) + User Story 3 (Phase 6) - Independent enhancements
- **Developer C**: User Story 4 (Phase 7) - Financial tracking

Then merge and proceed:

- **Developer A**: User Story 6 (Phase 5) - Edit/delete (depends on US1)
- **Developer B**: User Story 5 (Phase 8) + Reordering (Phase 9)
- **Developer C**: Polish (Phase 10) - Testing, docs, monitoring

### Within Each Phase

- Tasks marked [P] can run in parallel (different files)
- Backend and Frontend tasks can run in parallel (different codebases)
- Tests should be written FIRST (TDD), ensuring they FAIL before implementation
- Complete all tasks in a phase before moving to next phase checkpoint

### Parallel Opportunities

**Phase 2 (Foundational):**

- T007 (LogoSize enum model) || T009 (LogoSize enum schema) || T018 (LogoSize enum TS)
- T010-T017 (All Pydantic schemas) || T019-T024 (All TypeScript types)

**Phase 3 (User Story 1):**

- T025 (SponsorService) || T026 (SponsorLogoService) - Different files
- T029-T034 (API endpoints) sequential, but can be parallel with frontend
- T035-T042 (All frontend) parallel with backend API development
- T043-T051 (All tests) parallel after implementation exists

**Phase 4-10:**

- Frontend and backend tasks within same user story can run in parallel
- Different user stories (after Foundational) can run in parallel if team capacity allows
- All tests within a phase marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T024) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T025-T051)
4. **STOP and VALIDATE**:
   - Test full sponsor creation flow
   - Verify logo upload works
   - Verify thumbnail generation
   - Verify list displays correctly
5. Deploy/demo MVP - basic sponsor management functional

### Incremental Delivery

- **Iteration 1**: Setup + Foundational + US1 (MVP) → Deploy
- **Iteration 2**: Add US2 (display preferences) + US6 (edit/delete) → Deploy
- **Iteration 3**: Add US3 (contact) + US4 (financial) → Deploy
- **Iteration 4**: Add US5 (website links) + Reordering → Deploy
- **Iteration 5**: Polish (monitoring, docs, performance) → Final release

Each iteration adds value without breaking previous functionality.

### Testing Strategy

**Test-Driven Development (Recommended)**:

1. Write contract test (e.g., T043) - ensure it FAILS
2. Implement backend API (e.g., T030) - test should PASS
3. Write frontend test (e.g., T050) - ensure it FAILS
4. Implement frontend component (e.g., T039) - test should PASS
5. Manual validation in browser
6. Commit and move to next task

**Post-Implementation Testing**:

1. Implement all tasks for a user story
2. Run all tests for that story
3. Fix failures
4. Manual testing
5. Commit entire story

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] label**: Maps task to specific user story for traceability (US1-US6)
- **File paths**: All file paths are exact and ready to use
- **Checkpoints**: Stop at each checkpoint to validate user story works independently
- **Commit strategy**: Commit after each task or logical group (e.g., all tests for a story)
- **Logo storage**: Uses Azure Blob Storage with SAS URLs (pattern from EventMedia)
- **Thumbnail generation**: 128x128 using Pillow (server-side, during confirm_upload)
- **Permissions**: Reuse existing event permissions (require_event_permissions middleware)
- **Audit logging**: All sponsor CRUD operations logged to audit_logs table
- **Constitution compliance**: All gates pass (type safety, testing, security, YAGNI)

---

## Quick Reference: Task to File Mapping

### Backend Files Created/Modified

- `backend/alembic/versions/XXXX_add_sponsors_table.py` (T004)
- `backend/app/models/sponsor.py` (T007, T008)
- `backend/app/schemas/sponsor.py` (T009-T017)
- `backend/app/services/sponsor_service.py` (T025, T027, T058, T059, T090)
- `backend/app/services/sponsor_logo_service.py` (T026, T028)
- `backend/app/api/v1/sponsors.py` (T029-T034, T060-T062, T091)
- `backend/app/main.py` (T034)
- `backend/app/core/metrics.py` (T100)
- `backend/app/tests/test_sponsors_api.py` (T043-T046, T056, T070-T072, T079, T084, T088, T095)
- `backend/app/tests/test_sponsor_service.py` (T047)
- `backend/app/tests/test_sponsor_logo_service.py` (T048)
- `backend/app/tests/test_sponsors_integration.py` (T049)

### Frontend Files Created/Modified

- `frontend/augeo-admin/src/types/sponsor.ts` (T018-T024)
- `frontend/augeo-admin/src/services/sponsor-service.ts` (T035, T036, T063-T065, T092)
- `frontend/augeo-admin/src/stores/sponsor-store.ts` (T037, T066, T093)
- `frontend/augeo-admin/src/features/events/components/SponsorCard.tsx` (T038, T054, T068, T082, T087)
- `frontend/augeo-admin/src/features/events/components/SponsorList.tsx` (T039, T055, T094)
- `frontend/augeo-admin/src/features/events/components/SponsorForm.tsx` (T040, T052, T053, T067, T069, T075, T076, T081, T086)
- `frontend/augeo-admin/src/features/events/components/SponsorsTab.tsx` (T041)
- `frontend/augeo-admin/src/features/events/components/EventDetail.tsx` (T042)
- `frontend/augeo-admin/src/tests/features/events/SponsorList.test.tsx` (T050, T096)
- `frontend/augeo-admin/src/tests/features/events/SponsorForm.test.tsx` (T051, T073, T080, T085)
- `frontend/augeo-admin/src/tests/features/events/SponsorCard.test.tsx` (T057, T074, T089)

### Total Tasks: 112

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 21 tasks
- **Phase 3 (US1 - Add Sponsors)**: 27 tasks
- **Phase 4 (US2 - Display Preferences)**: 4 tasks
- **Phase 5 (US6 - Edit/Delete)**: 17 tasks
- **Phase 6 (US3 - Contact Info)**: 6 tasks
- **Phase 7 (US4 - Financial Tracking)**: 5 tasks
- **Phase 8 (US5 - Website Links)**: 4 tasks
- **Phase 9 (Reordering)**: 7 tasks
- **Phase 10 (Polish)**: 16 tasks

---

## Estimated Effort

**MVP (Phases 1-3)**: ~20-30 developer hours

- Setup: 1 hour
- Foundational: 8-10 hours (database, models, schemas, types)
- User Story 1: 12-18 hours (services, API, frontend, tests)

**Full Feature (All Phases)**: ~50-70 developer hours

- MVP: 20-30 hours
- US2-US6: 20-30 hours
- Reordering + Polish: 10-15 hours

**Parallel Team (3 developers)**: ~3-4 days for full feature

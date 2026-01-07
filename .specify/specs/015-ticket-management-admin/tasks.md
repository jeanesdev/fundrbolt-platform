# Tasks: Ticket Package Management

**Date**: 2026-01-06 | **Feature**: 015-ticket-management-admin

## Task Format

Each task follows the structure:
```
- [ ] [T###] [P?] [Story?] Description with file path
```

- **[T###]**: Sequential task ID (T001, T002, etc.)
- **[P]**: Optional marker indicating task can run in parallel with other [P] tasks in same phase
- **[Story?]**: Optional user story label ([US1], [US2], etc.) for story-specific tasks
- **File Path**: Explicit path to file being created/modified (e.g., `backend/app/models/ticket_package.py`)

## Phase 1: Setup (T001-T010)

Project initialization tasks that establish the foundation.

- [ ] [T001] Create Alembic migration for ticket_packages table with all columns (id, event_id, name, description, price, seats_per_package, quantity_limit, sold_count, display_order, image_url, is_enabled, created_by, created_at, updated_at, version) and constraints (CHECK price >= 0, CHECK seats_per_package >= 1 AND seats_per_package <= 100, CHECK quantity_limit >= sold_count, UNIQUE event_id + display_order) - `backend/alembic/versions/YYYYMMDD_create_ticket_packages.py`
- [ ] [T002] Create Alembic migration for custom_ticket_options table with columns (id, package_id, label, option_type, choices, is_required, display_order, created_at) - `backend/alembic/versions/YYYYMMDD_create_custom_ticket_options.py`
- [ ] [T003] Create Alembic migration for option_responses table with columns (id, purchase_id, option_id, response_value, created_at) - `backend/alembic/versions/YYYYMMDD_create_option_responses.py`
- [ ] [T004] Create Alembic migration for promo_codes table with columns (id, event_id, code, discount_type, discount_value, max_total_uses, current_uses, max_uses_per_donor, expires_at, is_active, created_by, created_at, updated_at, version) - `backend/alembic/versions/YYYYMMDD_create_promo_codes.py`
- [ ] [T005] Create Alembic migration for promo_code_applications table with columns (id, promo_code_id, purchase_id, discount_applied, applied_at) - `backend/alembic/versions/YYYYMMDD_create_promo_code_applications.py`
- [ ] [T006] Create Alembic migration for ticket_purchases table with columns (id, event_id, package_id, purchaser_id, purchase_date, total_price, discount_applied, created_at) - `backend/alembic/versions/YYYYMMDD_create_ticket_purchases.py`
- [ ] [T007] Create Alembic migration for assigned_tickets table with columns (id, purchase_id, guest_name, guest_email, qr_code, created_at) - `backend/alembic/versions/YYYYMMDD_create_assigned_tickets.py`
- [ ] [T008] Create Alembic migration for audit_logs table with columns (id, entity_type, entity_id, coordinator_id, field_name, old_value, new_value, changed_at) and PostgreSQL trigger to prevent modifications - `backend/alembic/versions/YYYYMMDD_create_audit_logs.py`
- [ ] [T009] Run Alembic upgrade head to apply all 8 new migrations - `terminal: cd backend && poetry run alembic upgrade head`
- [ ] [T010] Verify database schema with SQLAlchemy introspection to confirm all tables, indexes, constraints, and triggers created successfully - `backend/scripts/verify_ticket_schema.py`

## Phase 2: Foundational (T011-T025)

Shared services, models, and middleware used across user stories.

- [ ] [T011] [P] Create TicketPackage SQLAlchemy model with version_id_col for optimistic locking - `backend/app/models/ticket_package.py`
- [ ] [T012] [P] Create CustomTicketOption SQLAlchemy model with JSONB choices column - `backend/app/models/custom_ticket_option.py`
- [ ] [T013] [P] Create OptionResponse SQLAlchemy model - `backend/app/models/option_response.py`
- [ ] [T014] [P] Create PromoCode SQLAlchemy model with version_id_col for optimistic locking - `backend/app/models/promo_code.py`
- [ ] [T015] [P] Create PromoCodeApplication SQLAlchemy model - `backend/app/models/promo_code_application.py`
- [ ] [T016] [P] Create TicketPurchase SQLAlchemy model - `backend/app/models/ticket_purchase.py`
- [ ] [T017] [P] Create AssignedTicket SQLAlchemy model - `backend/app/models/assigned_ticket.py`
- [ ] [T018] [P] Create AuditLog SQLAlchemy model with immutability flags - `backend/app/models/audit_log.py`
- [ ] [T019] [P] Create TicketPackageBase, TicketPackageCreate, TicketPackageUpdate, TicketPackageResponse Pydantic schemas with validation (price >= 0, name max 100 chars, description max 1000 chars) - `backend/app/schemas/ticket_package.py`
- [ ] [T020] [P] Create CustomOptionBase, CustomOptionCreate, CustomOptionUpdate, CustomOptionResponse Pydantic schemas with option_type enum validation - `backend/app/schemas/custom_ticket_option.py`
- [ ] [T021] [P] Create PromoCodeBase, PromoCodeCreate, PromoCodeUpdate, PromoCodeResponse Pydantic schemas with discount_type enum and code validation (4-20 alphanumeric) - `backend/app/schemas/promo_code.py`
- [ ] [T022] [P] Create TicketPurchaseBase, TicketPurchaseCreate, TicketPurchaseResponse Pydantic schemas - `backend/app/schemas/ticket_purchase.py`
- [ ] [T023] Create AuditService with create_audit_entry() method that logs changes to ticket packages and promo codes with existing sales - `backend/app/services/audit_service.py`
- [ ] [T024] Create ImageService with upload_to_azure_blob(), delete_from_azure_blob(), validate_image() methods for ticket package images (JPG/PNG/WebP, max 5MB, virus scanning with Azure Defender) - `backend/app/services/image_service.py`
- [ ] [T025] Create RedisCacheService with get_cached_sales_count(), set_cached_sales_count(), invalidate_sales_cache(), get_cached_promo_validation(), set_cached_promo_validation() methods with TTL (5s for sales, 60s for promo codes) - `backend/app/services/redis_cache_service.py`

## Phase 3: User Story 1 - Create Basic Ticket Packages (P1) (T026-T045)

**User Story**: As an Event Coordinator, I need to create ticket packages with name, price, description, and number of seats so that donors can purchase tickets to attend my event.

**Why P1**: Package creation is the foundational capability - without it, no tickets can be sold. This is the minimum viable functionality that enables event ticketing.

**Implementation Order**: Backend models → Backend services → Backend endpoints → Frontend API client → Frontend state management → Frontend UI components

### Backend Tasks

- [ ] [T026] [US1] Create TicketPackageService with create_package() method that validates inputs (name required, price >= 0, seats >= 1), sets display_order to max+1, initializes sold_count=0, is_enabled=true - `backend/app/services/ticket_package_service.py`
- [ ] [T027] [US1] Add get_package_by_id() method to TicketPackageService with event_id ownership validation - `backend/app/services/ticket_package_service.py`
- [ ] [T028] [US1] Add list_packages_by_event() method to TicketPackageService with ordering by display_order ASC - `backend/app/services/ticket_package_service.py`
- [ ] [T029] [US1] Create POST /api/v1/admin/events/{event_id}/ticket-packages endpoint with @require_role("event_coordinator", "super_admin") decorator, validates coordinator has access to event - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T030] [US1] Create GET /api/v1/admin/events/{event_id}/ticket-packages endpoint with pagination (default 20 per page), returns packages ordered by display_order - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T031] [US1] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id} endpoint with ownership validation - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T032] [P] [US1] Create ticketPackageApi.ts with createPackage(), getPackages(), getPackageById() methods using axios - `frontend/fundrbolt-admin/src/api/ticketPackageApi.ts`
- [ ] [T033] [US1] Create useTicketPackageStore with Zustand state (packages: TicketPackage[], selectedPackage: TicketPackage | null, loading: boolean, error: string | null) and actions (createPackage, fetchPackages, selectPackage) - `frontend/fundrbolt-admin/src/stores/useTicketPackageStore.ts`
- [ ] [T034] [US1] Create TicketPackageForm component with controlled inputs (name, price, seats, description), validation (name required, price >= 0, seats >= 1, description required), submit handler calling createPackage action - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T034a] [US1] Add client-side debounced validation to TicketPackageForm (300ms delay) with real-time error display for name/price/seats/description fields, ensure validation feedback appears within 1 second per SC-005 - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T035] [US1] Create TicketPackageList component displaying package cards with name, price, seats, sold count, sponsorship badge (if applicable), disabled badge (if applicable) - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageList.tsx`
- [ ] [T036] [US1] Create TicketPackageCard component with package details, edit button, delete button (disabled if sold_count > 0), and click handler to view details - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T037] [US1] Create /events/$eventSlug/tickets route with TicketPackageList and "Create Package" button opening TicketPackageForm dialog - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T038] [US1] Add useEffect in tickets route to fetch packages on mount using fetchPackages action - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T039] [US1] Create TicketPackageFormDialog component wrapping TicketPackageForm with Radix Dialog, cancel/submit buttons, loading state - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageFormDialog.tsx`
- [ ] [T040] [US1] Add optimistic UI updates in createPackage action: add package to store immediately, revert on API error with toast notification - `frontend/fundrbolt-admin/src/stores/useTicketPackageStore.ts`

### Testing Tasks

- [ ] [T041] [P] [US1] Write contract test for POST /api/v1/admin/events/{event_id}/ticket-packages with valid inputs, assert 201 status and package ID returned - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T042] [P] [US1] Write contract test for GET /api/v1/admin/events/{event_id}/ticket-packages, assert 200 status and array of packages with correct schema - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T043] [P] [US1] Write integration test for full package creation flow: coordinator creates package, fetches list, verifies package appears with correct data - `backend/app/tests/integration/test_ticket_package_creation.py`
- [ ] [T044] [P] [US1] Write unit test for TicketPackageService.create_package() with invalid inputs (price < 0, seats < 1, name empty), assert ValidationError raised - `backend/app/tests/services/test_ticket_package_service.py`
- [ ] [T045] [P] [US1] Write frontend component test for TicketPackageForm with React Testing Library, simulate form submission, verify createPackage called with correct data - `frontend/fundrbolt-admin/src/components/tickets/__tests__/TicketPackageForm.test.tsx`

## Phase 4: User Story 2 - Edit and Delete Packages (P1) (T046-T065)

**User Story**: As an Event Coordinator, I need to edit existing ticket packages (name, price, description, seats) and delete unused packages so that I can correct mistakes, update details, or remove packages I no longer need.

**Why P1**: Edit/delete are essential CRUD operations that enable coordinators to maintain accurate package information throughout the event planning lifecycle.

**Implementation Order**: Backend services (audit logging) → Backend endpoints → Frontend state updates → Frontend edit/delete UI

### Backend Tasks

- [ ] [T046] [US2] Add update_package() method to TicketPackageService with optimistic locking (version column increment), validates ownership, allows all field edits regardless of sold_count, creates audit_logs entry if sold_count > 0 using AuditService - `backend/app/services/ticket_package_service.py`
- [ ] [T047] [US2] Add soft_delete_package() method to TicketPackageService that checks sold_count == 0, sets is_enabled=false if sold > 0, raises ValidationError if attempting hard delete with sales - `backend/app/services/ticket_package_service.py`
- [ ] [T048] [US2] Add get_audit_trail() method to TicketPackageService that fetches all audit_logs for a package_id ordered by changed_at DESC - `backend/app/services/ticket_package_service.py`
- [ ] [T049] [US2] Create PATCH /api/v1/admin/events/{event_id}/ticket-packages/{package_id} endpoint with optimistic locking retry logic (3 attempts with exponential backoff), returns warning message if sold_count > 0 - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T050] [US2] Create DELETE /api/v1/admin/events/{event_id}/ticket-packages/{package_id} endpoint that soft-deletes if sold_count > 0, hard-deletes (CASCADE) if sold_count == 0, requires confirmation - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T051] [US2] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/audit-trail endpoint returning array of audit log entries with coordinator names - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T052] [P] [US2] Add updatePackage(), deletePackage(), getAuditTrail() methods to ticketPackageApi.ts - `frontend/fundrbolt-admin/src/api/ticketPackageApi.ts`
- [ ] [T053] [US2] Add updatePackage, deletePackage actions to useTicketPackageStore with optimistic updates and error handling - `frontend/fundrbolt-admin/src/stores/useTicketPackageStore.ts`
- [ ] [T054] [US2] Update TicketPackageForm to accept initialValues prop for edit mode, populate fields with existing data - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T055] [US2] Create EditPackageDialog component that loads package data, shows warning banner if sold_count > 0, calls updatePackage on submit - `frontend/fundrbolt-admin/src/components/tickets/EditPackageDialog.tsx`
- [ ] [T056] [US2] Create DeleteConfirmDialog component with Radix AlertDialog, shows "Cannot delete" message if sold_count > 0, requires confirmation if sold_count == 0 - `frontend/fundrbolt-admin/src/components/tickets/DeleteConfirmDialog.tsx`
- [ ] [T057] [US2] Add edit button to TicketPackageCard that opens EditPackageDialog with package data - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T058] [US2] Add delete button to TicketPackageCard that opens DeleteConfirmDialog, disable if sold_count > 0 with tooltip "Cannot delete packages with sales" - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T059] [US2] Create AuditTrailPanel component displaying timeline of changes with coordinator names, timestamps, field names, old/new values - `frontend/fundrbolt-admin/src/components/tickets/AuditTrailPanel.tsx`
- [ ] [T060] [US2] Add "View Audit Trail" button to TicketPackageCard (visible only if sold_count > 0) that opens AuditTrailPanel in side drawer - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`

### Testing Tasks

- [ ] [T061] [P] [US2] Write contract test for PATCH /api/v1/admin/events/{event_id}/ticket-packages/{package_id} with valid updates, assert 200 and updated package returned - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T062] [P] [US2] Write contract test for DELETE /api/v1/admin/events/{event_id}/ticket-packages/{package_id} with sold_count == 0, assert 204 status - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T063] [P] [US2] Write integration test for edit with audit trail: create package, simulate purchase (sold_count = 1), edit package, verify audit_logs entry created with correct old/new values - `backend/app/tests/integration/test_ticket_package_edit_audit.py`
- [ ] [T064] [P] [US2] Write integration test for delete prevention: create package, simulate purchase, attempt delete, assert ValidationError with message "Cannot delete packages with sales" - `backend/app/tests/integration/test_ticket_package_delete.py`
- [ ] [T065] [P] [US2] Write unit test for optimistic locking: simulate concurrent edits with stale version, assert first edit succeeds, second edit retries and succeeds after refetch - `backend/app/tests/services/test_ticket_package_optimistic_locking.py`

## Phase 5: User Story 3 - Limited Quantity (P2) (T066-T080)

**User Story**: As an Event Coordinator, I need to optionally set a maximum quantity limit on ticket packages so that I can control event capacity and prevent overselling.

**Why P2**: Quantity limits are important for capacity management but not required for basic ticketing (unlimited packages are valid). This adds control once basic creation/editing is working.

**Implementation Order**: Backend validation logic → Backend endpoints → Frontend quantity UI → Sold-out indicators

### Backend Tasks

- [ ] [T066] [US3] Add set_quantity_limit() method to TicketPackageService that validates limit >= sold_count, updates quantity_limit column (NULL for unlimited) - `backend/app/services/ticket_package_service.py`
- [ ] [T067] [US3] Add check_availability() method to TicketPackageService that returns boolean (quantity_limit IS NULL OR sold_count < quantity_limit) AND is_enabled == true - `backend/app/services/ticket_package_service.py`
- [ ] [T068] [US3] Add increment_sold_count() method to TicketPackageService with optimistic locking, checks availability before increment, raises OutOfStockError if unavailable - `backend/app/services/ticket_package_service.py`
- [ ] [T069] [US3] Update PATCH /api/v1/admin/events/{event_id}/ticket-packages/{package_id} endpoint to validate quantity_limit >= sold_count when updating limit - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T070] [US3] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/availability endpoint returning {available: boolean, sold_count: number, quantity_limit: number | null} - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T071] [P] [US3] Add getAvailability() method to ticketPackageApi.ts - `frontend/fundrbolt-admin/src/api/ticketPackageApi.ts`
- [ ] [T072] [US3] Add quantity_limit field to TicketPackageForm with checkbox "Enable quantity limit" and number input (min 1, max 10000), disable input if checkbox unchecked - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T073] [US3] Update EditPackageDialog to validate quantity_limit >= sold_count before submitting, show error toast if invalid - `frontend/fundrbolt-admin/src/components/tickets/EditPackageDialog.tsx`
- [ ] [T074] [US3] Create QuantityIndicator component displaying "X/Y sold" badge if quantity_limit set, "X sold" if unlimited - `frontend/fundrbolt-admin/src/components/tickets/QuantityIndicator.tsx`
- [ ] [T075] [US3] Add QuantityIndicator to TicketPackageCard showing sold count and limit - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T076] [US3] Create SoldOutBadge component with red background and "Sold Out" text - `frontend/fundrbolt-admin/src/components/tickets/SoldOutBadge.tsx`
- [ ] [T077] [US3] Add SoldOutBadge to TicketPackageCard if sold_count >= quantity_limit (when limit set) - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`

### Testing Tasks

- [ ] [T078] [P] [US3] Write contract test for PATCH with quantity_limit reduction below sold_count, assert 400 status and validation error message - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T079] [P] [US3] Write integration test for sell-out scenario: create package with quantity_limit=2, simulate 2 purchases, attempt 3rd purchase, assert OutOfStockError raised - `backend/app/tests/integration/test_ticket_package_sellout.py`
- [ ] [T080] [P] [US3] Write concurrency test for race condition: spawn 10 concurrent purchase requests for last 1 available ticket, assert exactly 1 succeeds and 9 fail with OutOfStockError - `backend/app/tests/integration/test_ticket_package_race_condition.py`

## Phase 6: User Story 4 - Custom Options (P2) (T081-T100)

**User Story**: As an Event Coordinator, I need to add up to 4 custom options (Boolean, Multi-Select, Text Input) to ticket packages so that I can collect specific information from donors during purchase.

**Why P2**: Custom options enable personalized registration (meal preferences, accessibility needs, etc.) which is important for event planning but not blocking for basic ticket sales.

**Implementation Order**: Backend models → Backend services → Backend endpoints → Frontend option management UI → Frontend option response collection

### Backend Tasks

- [ ] [T081] [US4] Create CustomOptionService with create_option() method that validates package_id exists, enforces max 4 options per package (application-level check), validates choices array for multi_select type - `backend/app/services/custom_option_service.py`
- [ ] [T082] [US4] Add update_option() method to CustomOptionService that allows editing all fields, prevents deletion if package has sales (soft-disable via is_required=false) - `backend/app/services/custom_option_service.py`
- [ ] [T083] [US4] Add delete_option() method to CustomOptionService that checks sold_count == 0 on parent package, CASCADE deletes option_responses - `backend/app/services/custom_option_service.py`
- [ ] [T084] [US4] Add list_options_by_package() method to CustomOptionService ordered by display_order ASC - `backend/app/services/custom_option_service.py`
- [ ] [T085] [US4] Add validate_option_responses() method to CustomOptionService that checks required options have non-NULL responses, validates multi_select responses are in choices array - `backend/app/services/custom_option_service.py`
- [ ] [T086] [US4] Create POST /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/custom-options endpoint with max 4 options validation - `backend/app/api/v1/admin/custom_options.py`
- [ ] [T087] [US4] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/custom-options endpoint returning options ordered by display_order - `backend/app/api/v1/admin/custom_options.py`
- [ ] [T088] [US4] Create PATCH /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/custom-options/{option_id} endpoint - `backend/app/api/v1/admin/custom_options.py`
- [ ] [T089] [US4] Create DELETE /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/custom-options/{option_id} endpoint with sold_count validation - `backend/app/api/v1/admin/custom_options.py`

### Frontend Tasks

- [ ] [T090] [P] [US4] Create customOptionApi.ts with createOption(), getOptions(), updateOption(), deleteOption() methods - `frontend/fundrbolt-admin/src/api/customOptionApi.ts`
- [ ] [T091] [US4] Create CustomOptionForm component with fields (label, option_type dropdown, choices array input for multi_select, is_required checkbox), dynamic rendering based on type - `frontend/fundrbolt-admin/src/components/tickets/CustomOptionForm.tsx`
- [ ] [T092] [US4] Create CustomOptionsList component displaying list of options with drag handles (for reordering), edit/delete buttons - `frontend/fundrbolt-admin/src/components/tickets/CustomOptionsList.tsx`
- [ ] [T093] [US4] Add CustomOptionsList to TicketPackageCard expanded view (below package details) - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T094] [US4] Create "Add Custom Option" button that opens CustomOptionForm dialog, disable if package already has 4 options - `frontend/fundrbolt-admin/src/components/tickets/CustomOptionsList.tsx`
- [ ] [T095] [US4] Create OptionResponseForm component (for donor-facing purchase flow, out of scope for admin UI but needed for testing) rendering Boolean checkbox, Multi-Select radio group, Text Input textarea based on option_type - `frontend/fundrbolt-admin/src/components/tickets/OptionResponseForm.tsx`
- [ ] [T096] [US4] Add option response collection to useTicketPackageStore.submitPurchase() action that validates required options before API call - `frontend/fundrbolt-admin/src/stores/useTicketPackageStore.ts`

### Testing Tasks

- [ ] [T097] [P] [US4] Write contract test for POST /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/custom-options with all 3 types (boolean, multi_select, text_input), assert 201 and correct schema - `backend/app/tests/api/v1/admin/test_custom_options_contract.py`
- [ ] [T098] [P] [US4] Write contract test for POST exceeding 4 options limit, assert 400 status and error message "Maximum 4 custom options per package" - `backend/app/tests/api/v1/admin/test_custom_options_contract.py`
- [ ] [T099] [P] [US4] Write integration test for option response validation: create option with is_required=true, simulate purchase with missing response, assert ValidationError - `backend/app/tests/integration/test_custom_option_validation.py`
- [ ] [T100] [P] [US4] Write integration test for optional option: create option with is_required=false, simulate purchase without response, verify option_responses entry has NULL response_value - `backend/app/tests/integration/test_custom_option_optional.py`

## Phase 7: User Story 7 - Promo Codes (P2) (T101-T125)

**User Story**: As an Event Coordinator, I need to create promo codes with percentage or dollar discounts, optional usage limits, and optional expiration dates so that I can offer special pricing to specific donor groups.

**Why P2**: Promo codes are valuable for marketing and fundraising strategy but not required for basic ticket functionality. Enables pricing flexibility once core package sales work.

**Implementation Order**: Backend models → Backend services (discount calculation) → Backend endpoints → Frontend promo code management → Frontend validation UI

### Backend Tasks

- [ ] [T101] [US7] Create PromoCodeService with create_promo_code() method that validates code format (4-20 alphanumeric), ensures uniqueness per event, validates discount_value ranges (percentage: 1-100, fixed: > 0) - `backend/app/services/promo_code_service.py`
- [ ] [T102] [US7] Add validate_promo_code() method to PromoCodeService that checks is_active, expires_at > now, max_total_uses not exceeded, max_uses_per_donor not exceeded (query promo_code_applications), uses Redis cache (60s TTL) for validation results - `backend/app/services/promo_code_service.py`
- [ ] [T103] [US7] Add calculate_discount() method to PromoCodeService that applies percentage or fixed discount, enforces price floor of $0, returns {final_price: Decimal, discount_applied: Decimal} - `backend/app/services/promo_code_service.py`
- [ ] [T104] [US7] Add apply_promo_code() method to PromoCodeService with optimistic locking on promo_codes.version, increments current_uses, creates promo_code_applications entry, invalidates Redis cache - `backend/app/services/promo_code_service.py`
- [ ] [T105] [US7] Add get_usage_stats() method to PromoCodeService returning {times_used: number, remaining_uses: number | null, total_discount_given: Decimal} - `backend/app/services/promo_code_service.py`
- [ ] [T106] [US7] Create POST /api/v1/admin/events/{event_id}/promo-codes endpoint with code uniqueness validation - `backend/app/api/v1/admin/promo_codes.py`
- [ ] [T107] [US7] Create GET /api/v1/admin/events/{event_id}/promo-codes endpoint with pagination, returns codes with usage stats - `backend/app/api/v1/admin/promo_codes.py`
- [ ] [T108] [US7] Create PATCH /api/v1/admin/events/{event_id}/promo-codes/{code_id} endpoint allowing activation/deactivation and limit updates - `backend/app/api/v1/admin/promo_codes.py`
- [ ] [T109] [US7] Create DELETE /api/v1/admin/events/{event_id}/promo-codes/{code_id} endpoint with cascade delete of promo_code_applications - `backend/app/api/v1/admin/promo_codes.py`
- [ ] [T110] [US7] Create POST /api/v1/public/events/{event_id}/promo-codes/validate endpoint that calls validate_promo_code() and returns validation result + calculated discount preview - `backend/app/api/v1/public/promo_codes.py`

### Frontend Tasks

- [ ] [T111] [P] [US7] Create promoCodeApi.ts with createPromoCode(), getPromoCodes(), updatePromoCode(), deletePromoCode(), validatePromoCode() methods - `frontend/fundrbolt-admin/src/api/promoCodeApi.ts`
- [ ] [T112] [US7] Create PromoCodeForm component with fields (code input uppercase transform, discount_type radio, discount_value, max_total_uses checkbox+input, max_uses_per_donor checkbox+input, expires_at datetime picker), validation on blur - `frontend/fundrbolt-admin/src/components/tickets/PromoCodeForm.tsx`
- [ ] [T113] [US7] Create PromoCodesList component displaying promo code cards with code, discount, usage stats (X/Y used), expiration date, active/inactive toggle - `frontend/fundrbolt-admin/src/components/tickets/PromoCodesList.tsx`
- [ ] [T114] [US7] Create PromoCodeCard component showing code badge, discount value, usage progress bar, "Expired" badge if past expires_at, edit/delete buttons - `frontend/fundrbolt-admin/src/components/tickets/PromoCodeCard.tsx`
- [ ] [T115] [US7] Add "Promo Codes" tab to tickets route (/events/$eventSlug/tickets?tab=promo-codes) showing PromoCodesList - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T116] [US7] Create PromoCodeUsagePanel component displaying detailed usage stats: times_used, remaining_uses, total_discount_given, list of applications with purchaser names - `frontend/fundrbolt-admin/src/components/tickets/PromoCodeUsagePanel.tsx`
- [ ] [T117] [US7] Add "View Usage" button to PromoCodeCard that opens PromoCodeUsagePanel in side drawer - `frontend/fundrbolt-admin/src/components/tickets/PromoCodeCard.tsx`

### Testing Tasks

- [ ] [T118] [P] [US7] Write contract test for POST /api/v1/admin/events/{event_id}/promo-codes with valid percentage code, assert 201 and code returned - `backend/app/tests/api/v1/admin/test_promo_codes_contract.py`
- [ ] [T119] [P] [US7] Write contract test for POST with duplicate code in same event, assert 409 Conflict - `backend/app/tests/api/v1/admin/test_promo_codes_contract.py`
- [ ] [T120] [P] [US7] Write integration test for promo code expiration: create code with expires_at in past, attempt validation, assert error "Promo code expired" - `backend/app/tests/integration/test_promo_code_expiration.py`
- [ ] [T121] [P] [US7] Write integration test for usage limit: create code with max_total_uses=2, apply twice, attempt 3rd application, assert error "Promo code usage limit reached" - `backend/app/tests/integration/test_promo_code_usage_limit.py`
- [ ] [T122] [P] [US7] Write integration test for discount calculation: create percentage code (20% off), apply to $100 package, assert final_price=$80, discount_applied=$20 - `backend/app/tests/integration/test_promo_code_discount_calculation.py`
- [ ] [T123] [P] [US7] Write integration test for price floor: create fixed discount code ($150 off), apply to $100 package, assert final_price=$0, discount_applied=$100 - `backend/app/tests/integration/test_promo_code_price_floor.py`
- [ ] [T124] [P] [US7] Write concurrency test for usage limit race condition: create code with max_total_uses=1, spawn 5 concurrent applications, assert exactly 1 succeeds with optimistic locking - `backend/app/tests/integration/test_promo_code_race_condition.py`
- [ ] [T125] [P] [US7] Write unit test for Redis cache: validate code, verify cache hit on 2nd validation within 60s TTL, verify cache miss after invalidation - `backend/app/tests/services/test_promo_code_cache.py`

## Phase 8: User Story 5 - Sponsorship Indicator (P3) (T126-T135)

**User Story**: As an Event Coordinator, I need to mark certain ticket packages as "sponsorships" so that I can differentiate sponsorship-level tickets from regular attendee tickets in reports and displays.

**Why P3**: Sponsorship indicator is a classification enhancement that aids reporting but doesn't affect core ticketing functionality. Can be added after primary features work.

**Implementation Order**: Backend field addition → Backend filtering → Frontend UI toggle → Frontend sponsorship badge

### Backend Tasks

- [ ] [T126] [US5] Add is_sponsorship boolean column to ticket_packages table via Alembic migration (default false) - `backend/alembic/versions/YYYYMMDD_add_sponsorship_indicator.py`
- [ ] [T127] [US5] Update TicketPackageCreate/Update schemas to include is_sponsorship field - `backend/app/schemas/ticket_package.py`
- [ ] [T128] [US5] Add filter_by_sponsorship() method to TicketPackageService that returns packages where is_sponsorship == true - `backend/app/services/ticket_package_service.py`
- [ ] [T129] [US5] Update GET /api/v1/admin/events/{event_id}/ticket-packages endpoint to accept ?sponsorships_only=true query param - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T130] [US5] Add is_sponsorship checkbox to TicketPackageForm with label "Mark as sponsorship package" - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T131] [US5] Create SponsorshipBadge component with gold/premium styling and "Sponsorship" text - `frontend/fundrbolt-admin/src/components/tickets/SponsorshipBadge.tsx`
- [ ] [T132] [US5] Add SponsorshipBadge to TicketPackageCard if is_sponsorship == true - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T133] [US5] Add "Show Sponsorships Only" filter checkbox to TicketPackageList that calls getPackages({sponsorships_only: true}) - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageList.tsx`

### Testing Tasks

- [ ] [T134] [P] [US5] Write contract test for GET /api/v1/admin/events/{event_id}/ticket-packages?sponsorships_only=true, assert only packages with is_sponsorship=true returned - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T135] [P] [US5] Write integration test for sponsorship filtering: create 2 sponsorship packages and 1 regular, filter by sponsorships_only, verify only 2 returned - `backend/app/tests/integration/test_ticket_package_sponsorship_filter.py`

## Phase 9: User Story 6 - Upload Images (P3) (T136-T150)

**User Story**: As an Event Coordinator, I need to upload images to ticket packages so that donors see visual representations of each ticket offering, making packages more attractive and informative.

**Why P3**: Images enhance presentation and conversion but aren't required for ticket sales to function. Can be added as a polish feature after core functionality works.

**Implementation Order**: Backend Azure Blob Storage integration → Backend upload/delete endpoints → Frontend file upload UI → Frontend image display

### Backend Tasks

- [ ] [T136] [US6] Update ImageService.upload_to_azure_blob() to generate unique filenames (UUID + extension), upload to "ticket-package-images" container, return public URL - `backend/app/services/image_service.py`
- [ ] [T137] [US6] Update ImageService.validate_image() to check file extension (jpg/jpeg/png/webp), file size <= 5MB, use Azure Defender for virus scanning before storage - `backend/app/services/image_service.py`
- [ ] [T138] [US6] Add delete_image() method to ImageService that removes blob from Azure Storage and updates package image_url to NULL - `backend/app/services/image_service.py`
- [ ] [T139] [US6] Create POST /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/image endpoint accepting multipart/form-data with "image" field, validates format/size, calls ImageService, updates package image_url - `backend/app/api/v1/admin/ticket_packages.py`
- [ ] [T140] [US6] Create DELETE /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/image endpoint that calls ImageService.delete_image() and nullifies image_url - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T141] [P] [US6] Add uploadImage(), deleteImage() methods to ticketPackageApi.ts with multipart/form-data content type - `frontend/fundrbolt-admin/src/api/ticketPackageApi.ts`
- [ ] [T142] [US6] Create ImageUploadInput component with drag-and-drop zone, file picker button, preview thumbnail, format/size validation (show error toast if invalid) - `frontend/fundrbolt-admin/src/components/tickets/ImageUploadInput.tsx`
- [ ] [T143] [US6] Add ImageUploadInput to TicketPackageForm below description field with label "Package Image (optional)" - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageForm.tsx`
- [ ] [T144] [US6] Create PackageImageDisplay component showing thumbnail with "Replace" and "Remove" buttons, placeholder if no image - `frontend/fundrbolt-admin/src/components/tickets/PackageImageDisplay.tsx`
- [ ] [T145] [US6] Add PackageImageDisplay to TicketPackageCard showing image thumbnail (200x200px) with object-fit cover - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T146] [US6] Add loading spinner to ImageUploadInput during upload, disable input until upload completes - `frontend/fundrbolt-admin/src/components/tickets/ImageUploadInput.tsx`

### Testing Tasks

- [ ] [T147] [P] [US6] Write contract test for POST /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/image with valid JPG, assert 200 and image_url returned - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T148] [P] [US6] Write contract test for POST with invalid file type (PDF), assert 400 and error message "Invalid image format" - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T149] [P] [US6] Write contract test for POST with oversized file (6MB), assert 400 and error message "Image exceeds 5MB limit" - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T150] [P] [US6] Write integration test for full image workflow: create package, upload image, verify image_url populated, delete image, verify image_url NULL - `backend/app/tests/integration/test_ticket_package_image_workflow.py`

## Phase 10: User Story 8 - Reorder Ticket Packages (P3) (T151-T165)

**User Story**: As an Event Coordinator, I need to drag and drop ticket packages to reorder them so that I can control which packages appear first on the donor-facing ticket purchase page.

**Why P3**: Display order is a presentation enhancement that affects user experience but doesn't impact core functionality. Packages can be listed in any order and still function correctly.

**Implementation Order**: Backend reordering logic → Backend endpoint → Frontend dnd-kit integration → Frontend drag handles

### Backend Tasks

- [ ] [T151] [US8] Add reorder_packages() method to TicketPackageService that accepts array of package IDs in new order, updates display_order for each (atomic transaction), validates all IDs belong to event - `backend/app/services/ticket_package_service.py`
- [ ] [T152] [US8] Create PUT /api/v1/admin/events/{event_id}/ticket-packages/reorder endpoint accepting {package_ids: UUID[]} in desired order, calls reorder_packages() - `backend/app/api/v1/admin/ticket_packages.py`

### Frontend Tasks

- [ ] [T153] [P] [US8] Add reorderPackages() method to ticketPackageApi.ts - `frontend/fundrbolt-admin/src/api/ticketPackageApi.ts`
- [ ] [T154] [US8] Install @dnd-kit/core and @dnd-kit/sortable packages with pnpm - `terminal: cd frontend/fundrbolt-admin && pnpm add @dnd-kit/core @dnd-kit/sortable`
- [ ] [T155] [US8] Wrap TicketPackageList with DndContext from @dnd-kit/core, implement onDragEnd handler that updates local state and calls reorderPackages API - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageList.tsx`
- [ ] [T156] [US8] Refactor TicketPackageCard to use SortableContext and useSortable hook from @dnd-kit/sortable, add drag handle icon with CSS cursor:grab - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T157] [US8] Add visual feedback during drag: opacity 0.5 on dragging item, drop indicator line between packages - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageList.tsx`
- [ ] [T158] [US8] Add optimistic UI update in reorderPackages action: reorder local packages array immediately, revert on API error - `frontend/fundrbolt-admin/src/stores/useTicketPackageStore.ts`

### Testing Tasks

- [ ] [T159] [P] [US8] Write contract test for PUT /api/v1/admin/events/{event_id}/ticket-packages/reorder with valid package_ids array, assert 200 and new order persisted - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T160] [P] [US8] Write contract test for PUT with invalid package ID (not belonging to event), assert 400 and error message - `backend/app/tests/api/v1/admin/test_ticket_packages_contract.py`
- [ ] [T161] [P] [US8] Write integration test for reordering: create 3 packages (order: 0, 1, 2), reorder to [2, 0, 1], fetch packages, verify display_order updated correctly - `backend/app/tests/integration/test_ticket_package_reorder.py`
- [ ] [T162] [P] [US8] Write frontend component test for drag-and-drop: render TicketPackageList with 3 packages, simulate drag package 2 to position 0, verify reorderPackages called with correct IDs - `frontend/fundrbolt-admin/src/components/tickets/__tests__/TicketPackageList.test.tsx`

### Documentation Tasks

- [ ] [T163] [US8] Document @dnd-kit accessibility features in README: keyboard navigation (Space to lift, Arrow keys to move, Escape to cancel) - `frontend/fundrbolt-admin/README.md`
- [ ] [T164] [US8] Add drag-and-drop UX guidelines to UI style guide: drag handle placement, visual feedback, animation timing (200ms) - `docs/frontend-style-guide.md`
- [ ] [T165] [US8] Update quickstart.md with reordering API usage example showing PUT request body format - `.specify/specs/015-ticket-management-admin/quickstart.md`

## Phase 11: User Story 9 - View Ticket Sales and Revenue Data (P1) (T166-T185)

**User Story**: As an Event Coordinator, I need to view comprehensive sales data for each ticket package (quantity sold, purchasers, assigned guests, revenue) so that I can track event capacity, revenue progress, and understand who is attending.

**Why P1**: Sales visibility is critical for event management and decision-making. Without this reporting, coordinators would have no way to track progress toward goals or manage event logistics.

**Implementation Order**: Backend services → Backend real-time updates → Backend CSV export → Frontend polling → Frontend sales UI

### Backend Tasks

- [ ] [T166] [US9] Create SalesTrackingService with get_sales_summary() method returning {total_revenue: Decimal, total_tickets_sold: number, packages_sold_out: number} for an event - `backend/app/services/sales_tracking_service.py`
- [ ] [T167] [US9] Add get_package_sales_details() method to SalesTrackingService returning {purchasers: [{name, email, purchase_date, assigned_guests: [{name, email}], promo_code_used, discount_applied, final_price}]} for a package - `backend/app/services/sales_tracking_service.py`
- [ ] [T168] [US9] Add get_real_time_sales_count() method to SalesTrackingService with Redis cache (5s TTL), falls back to DB query on cache miss - `backend/app/services/sales_tracking_service.py`
- [ ] [T169] [US9] Add export_sales_to_csv() method to SalesTrackingService using pandas for streaming export (memory-efficient for 10k+ rows), includes columns: package_name, purchaser_name, purchaser_email, purchase_date, guest_name, guest_email, promo_code, discount_applied, final_price - `backend/app/services/sales_tracking_service.py`
- [ ] [T170] [US9] Create GET /api/v1/admin/events/{event_id}/ticket-packages/sales-summary endpoint returning sales summary with 3-second polling recommendation in response headers (X-Polling-Interval: 3000) - `backend/app/api/v1/admin/sales_tracking.py`
- [ ] [T171] [US9] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/sales-details endpoint with pagination (50 purchasers per page) - `backend/app/api/v1/admin/sales_tracking.py`
- [ ] [T172] [US9] Create GET /api/v1/admin/events/{event_id}/ticket-packages/{package_id}/sales-count endpoint with Redis caching for real-time updates - `backend/app/api/v1/admin/sales_tracking.py`
- [ ] [T173] [US9] Create GET /api/v1/admin/events/{event_id}/ticket-packages/export-csv endpoint that calls export_sales_to_csv() and returns CSV file with Content-Disposition header - `backend/app/api/v1/admin/sales_tracking.py`
- [ ] [T174] [US9] Update TicketPackageService.increment_sold_count() to invalidate Redis sales cache after incrementing - `backend/app/services/ticket_package_service.py`

### Frontend Tasks

- [ ] [T175] [P] [US9] Create salesTrackingApi.ts with getSalesSummary(), getSalesDetails(), getSalesCount(), exportCsv() methods - `frontend/fundrbolt-admin/src/api/salesTrackingApi.ts`
- [ ] [T176] [US9] Create SalesSummaryCard component displaying total revenue (formatted $X,XXX), total tickets sold, sold-out count with refresh indicator - `frontend/fundrbolt-admin/src/components/tickets/SalesSummaryCard.tsx`
- [ ] [T177] [US9] Add SalesSummaryCard to tickets route header showing event-level sales stats - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T178] [US9] Create SalesDetailsPanel component showing purchaser list with expandable rows for assigned guests, promo code badge, discounted price - `frontend/fundrbolt-admin/src/components/tickets/SalesDetailsPanel.tsx`
- [ ] [T179] [US9] Add "View Sales" button to TicketPackageCard that opens SalesDetailsPanel in side drawer with pagination - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T180] [US9] Create useRealTimeSales hook using setInterval (3s) to poll getSalesCount(), auto-updates sold_count in store - `frontend/fundrbolt-admin/src/hooks/useRealTimeSales.ts`
- [ ] [T181] [US9] Add useRealTimeSales hook to tickets route, pass polling status to SalesSummaryCard for visual indicator (pulsing dot) - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T182] [US9] Create ExportCsvButton component that calls exportCsv API, triggers browser download, shows loading spinner during export - `frontend/fundrbolt-admin/src/components/tickets/ExportCsvButton.tsx`
- [ ] [T183] [US9] Add ExportCsvButton to SalesSummaryCard with tooltip "Export all ticket sales to CSV" - `frontend/fundrbolt-admin/src/components/tickets/SalesSummaryCard.tsx`

### Testing Tasks

- [ ] [T184] [P] [US9] Write integration test for real-time sales: create package, simulate purchase in background thread, poll sales_count endpoint 3 times, verify count increments within 3 seconds - `backend/app/tests/integration/test_sales_tracking_realtime.py`
- [ ] [T185] [P] [US9] Write integration test for CSV export: create 100 ticket purchases across 3 packages, export CSV, parse response, verify all 100 rows present with correct columns - `backend/app/tests/integration/test_sales_tracking_csv_export.py`

## Phase 12: Polish & Cross-Cutting (T186-T200)

Final tasks for error handling, performance optimization, documentation, and deployment.

### Error Handling

- [ ] [T186] [P] Add custom exception handlers to FastAPI app for OutOfStockError, PromoCodeInvalidError, DuplicateCodeError with specific HTTP status codes and error messages - `backend/app/main.py`
- [ ] [T187] [P] Create error boundary component in frontend to catch and display user-friendly error messages for ticket operations - `frontend/fundrbolt-admin/src/components/errors/TicketErrorBoundary.tsx`
- [ ] [T188] [P] Add toast notifications for all ticket CRUD operations: success (green), error (red), warning (yellow for edit with sales) - `frontend/fundrbolt-admin/src/components/tickets/TicketToastNotifications.tsx`

### Performance Optimization

- [ ] [T189] [P] Add database indexes: CREATE INDEX idx_ticket_packages_sold_count ON ticket_packages(sold_count) for sales queries - `backend/alembic/versions/YYYYMMDD_add_performance_indexes.py`
- [ ] [T190] [P] Implement pagination for all list endpoints (packages, promo codes, sales details) with consistent page_size default (20) - `backend/app/api/v1/admin/*`
- [ ] [T191] [P] Add React.memo to TicketPackageCard to prevent unnecessary re-renders during drag-and-drop - `frontend/fundrbolt-admin/src/components/tickets/TicketPackageCard.tsx`
- [ ] [T192] [P] Lazy load SalesDetailsPanel and AuditTrailPanel components with React.lazy() and Suspense - `frontend/fundrbolt-admin/src/routes/events/$eventSlug/tickets.tsx`
- [ ] [T192a] [P] Write load test with pytest-xdist simulating 100+ concurrent Event Coordinators creating and editing ticket packages, measure API latency (target p95 <300ms), verify no degradation per SC-011 - `backend/app/tests/load/test_ticket_package_concurrency.py`

### Documentation

- [ ] [T193] Update OpenAPI spec in contracts/openapi.yaml with all implemented endpoints, request/response examples, error codes - `.specify/specs/015-ticket-management-admin/contracts/openapi.yaml`
- [ ] [T194] Create API documentation page in docs/ explaining ticket management endpoints, authentication, rate limits - `docs/api/ticket-management.md`
- [ ] [T195] Update backend README with ticket management setup instructions: migrations, Redis cache config, Azure Blob Storage setup - `backend/README.md`
- [ ] [T196] Update frontend README with ticket management UI documentation: component structure, state management, dnd-kit usage - `frontend/fundrbolt-admin/README.md`
- [ ] [T197] Create user guide for Event Coordinators: "How to Create Ticket Packages", "How to Use Promo Codes", "How to Track Sales" - `docs/user-guides/ticket-management-coordinator-guide.md`

### Deployment & Monitoring

- [ ] [T198] Add Prometheus metrics for ticket operations: ticket_packages_created_total, ticket_purchases_total, promo_codes_redeemed_total - `backend/app/services/metrics_service.py`
- [ ] [T199] Create deployment checklist: run migrations, configure Azure Blob Storage container, set Redis cache TTL environment variables, verify virus scanning enabled - `docs/deployment/ticket-management-deployment.md`
- [ ] [T200] Add health check for ticket package system: verify database connectivity, Azure Storage connectivity, Redis cache connectivity - `backend/app/api/v1/health.py`

---

## Task Summary

**Total Tasks**: 203
- **Phase 1 (Setup)**: 10 tasks
- **Phase 2 (Foundational)**: 15 tasks
- **Phase 3 (US1 - Create Packages - P1)**: 21 tasks (added T034a)
- **Phase 4 (US2 - Edit/Delete - P1)**: 20 tasks
- **Phase 5 (US3 - Quantity Limits - P2)**: 15 tasks
- **Phase 6 (US4 - Custom Options - P2)**: 20 tasks
- **Phase 7 (US7 - Promo Codes - P2)**: 25 tasks
- **Phase 8 (US5 - Sponsorship - P3)**: 10 tasks
- **Phase 9 (US6 - Images - P3)**: 16 tasks (added T140a)
- **Phase 10 (US8 - Reordering - P3)**: 15 tasks
- **Phase 11 (US9 - Sales Tracking - P1)**: 20 tasks
- **Phase 12 (Polish)**: 16 tasks (added T192a)

**Parallel Execution Opportunities**: 85 tasks marked with [P] can run in parallel within their phases

**Story Distribution**:
- **US1 (P1)**: 21 tasks (T026-T045, T034a) - Create basic packages
- **US2 (P1)**: 20 tasks (T046-T065) - Edit/delete with audit trail
- **US3 (P2)**: 15 tasks (T066-T080) - Quantity limits
- **US4 (P2)**: 20 tasks (T081-T100) - Custom options
- **US7 (P2)**: 25 tasks (T101-T125) - Promo codes
- **US5 (P3)**: 10 tasks (T126-T135) - Sponsorship indicator
- **US6 (P3)**: 16 tasks (T136-T150, T140a) - Image uploads
- **US8 (P3)**: 15 tasks (T151-T165) - Drag-and-drop reordering
- **US9 (P1)**: 20 tasks (T166-T185) - Sales tracking

**Suggested MVP Scope** (implement first):
- Phase 1: Setup (T001-T010)
- Phase 2: Foundational (T011-T025)
- Phase 3: US1 - Create Packages (T026-T045, T034a)
- Phase 11: US9 - Sales Tracking (T166-T185)

**Total Estimated Effort**: 203 tasks across 12 phases covering 9 user stories. Each task represents 30 minutes to 2 hours of work depending on complexity.

## Dependency Graph

```
Phase 1 (Setup)
  └─> Phase 2 (Foundational)
        ├─> Phase 3 (US1 - Create Packages - P1) [MVP Core]
        │     ├─> Phase 4 (US2 - Edit/Delete - P1)
        │     └─> Phase 11 (US9 - Sales Tracking - P1) [MVP Core]
        ├─> Phase 5 (US3 - Quantity Limits - P2) [Can run parallel with Phase 6, 7]
        ├─> Phase 6 (US4 - Custom Options - P2) [Can run parallel with Phase 5, 7]
        ├─> Phase 7 (US7 - Promo Codes - P2) [Can run parallel with Phase 5, 6]
        ├─> Phase 8 (US5 - Sponsorship - P3) [Can run parallel with Phase 9, 10]
        ├─> Phase 9 (US6 - Images - P3) [Can run parallel with Phase 8, 10]
        └─> Phase 10 (US8 - Reordering - P3) [Can run parallel with Phase 8, 9]
              └─> Phase 12 (Polish) [Final phase after all stories complete]
```

**Parallel Execution Example** (after Phase 2 complete):
- **Week 1**: Phase 3 (US1) + Phase 11 (US9) [MVP delivery]
- **Week 2**: Phase 4 (US2) solo [Requires US1]
- **Week 3**: Phase 5 (US3) + Phase 6 (US4) + Phase 7 (US7) [All independent]
- **Week 4**: Phase 8 (US5) + Phase 9 (US6) + Phase 10 (US8) [All independent]
- **Week 5**: Phase 12 (Polish) [After all stories]

**Note**: This task breakdown follows the spec.md user story priorities and quickstart.md implementation guide. Each task includes explicit file paths and implementation details to enable independent execution.

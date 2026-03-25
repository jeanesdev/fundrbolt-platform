# Tasks: Ticket Purchasing & Assignment

**Input**: Design documents from `/specs/036-ticket-purchasing/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and shared models/schemas

- [X] T001 Create Alembic migration for ticket purchasing tables in backend/alembic/versions/xxx_add_ticket_purchasing.py — add `ticket_assignments` table, `ticket_invitations` table, `max_tickets_per_donor` column to events, `sponsorship_sponsor_id` column to ticket_purchases, `assignment_status` column to assigned_tickets (see data-model.md)
- [X] T002 Add TicketAssignment SQLAlchemy model to backend/app/models/ticket_management.py — fields: id, assigned_ticket_id, ticket_purchase_id, event_id, assigned_by_user_id, guest_name, guest_email, assignee_user_id, registration_id, status (assigned/invited/registered/cancelled), invitation_sent_at, invitation_count, registered_at, cancelled_at, cancelled_by, is_self_assignment, timestamps. Add relationships to AssignedTicket, TicketPurchase, User, EventRegistration.
- [X] T003 Add TicketInvitation SQLAlchemy model to backend/app/models/ticket_management.py — fields: id, assignment_id, email_address, invitation_token (unique), token_expires_at, sent_at, opened_at, registered_at, created_at. Add relationship to TicketAssignment.
- [X] T004 [P] Add `max_tickets_per_donor` column to Event model in backend/app/models/event.py — INTEGER, NULLABLE, default 20, CHECK >= 1
- [X] T005 [P] Add `sponsorship_sponsor_id` FK column to TicketPurchase model in backend/app/models/ticket_management.py — FK to sponsors.id, NULLABLE, ON DELETE SET NULL
- [X] T006 [P] Add `assignment_status` column to AssignedTicket model in backend/app/models/ticket_management.py — VARCHAR(20), default 'unassigned', CHECK IN ('unassigned', 'assigned', 'registered')
- [X] T007 Create Pydantic request/response schemas in backend/app/schemas/ticket_purchasing.py — CartItem, CheckoutRequest, CheckoutResponse, CartValidationRequest/Response, PurchaseListResponse, TicketInventoryResponse, PurchaseHistoryResponse, AssignTicketRequest/Response, AssignmentUpdateRequest, SelfRegisterRequest, InvitationSendRequest/Response, InvitationValidateResponse, InvitationRegisterRequest/Response, SponsorshipDetailsInput, SponsorLogoUploadResponse

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services that multiple user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create ticket purchasing service in backend/app/services/ticket_purchasing_service.py — methods: validate_cart(event_id, items, promo_code, user_id) → CartValidationResult, checkout(event_id, checkout_request, user_id) → CheckoutResult. Checkout creates TicketPurchase records, increments sold_count (soft oversell — no hard gate), generates AssignedTicket entries with QR codes, processes payment via existing PaymentTransactionService, creates Sponsor entries for sponsorship packages. Validate per-donor ticket cap (max_tickets_per_donor).
- [X] T009 Create ticket assignment service in backend/app/services/ticket_assignment_service.py — methods: assign_ticket(assigned_ticket_id, guest_name, guest_email, user_id) → TicketAssignment, update_assignment(assignment_id, guest_name, guest_email, user_id), cancel_assignment(assignment_id, user_id, actor_type), self_register(assignment_id, user_id, meal_selection, custom_responses) → registration_id, cancel_registration(assignment_id, user_id, actor_type). Detect self-assignment by comparing guest_email to user's email. Enforce state transitions: assigned→invited→registered, assigned/invited→cancelled.
- [X] T010 Create ticket invitation service in backend/app/services/ticket_invitation_service.py — methods: send_invitation(assignment_id, personal_message, user_id) → InvitationResult, resend_invitation(assignment_id, user_id), validate_token(token) → InvitationValidation, register_via_invitation(token, user_id, registration_data) → RegistrationResult. Generate HMAC-signed tokens with expiry (event_date + 24h). Rate limit: max 5 sends per assignment. Email contains event details, inviter name, registration link.
- [X] T011 [P] Create API client functions in frontend/donor-pwa/src/lib/api/ticket-purchases.ts — getPublicTickets(slug), validateCart(eventId, items, promoCode), checkout(eventId, request), getMyPurchases(eventId), getMyInventory(), getPurchaseHistory(page, perPage), uploadSponsorLogo(eventId, file)
- [X] T012 [P] Create API client functions in frontend/donor-pwa/src/lib/api/ticket-assignments.ts — assignTicket(ticketId, name, email), updateAssignment(assignmentId, name, email), cancelAssignment(assignmentId), selfRegister(assignmentId, data), cancelRegistration(assignmentId)
- [X] T013 [P] Create API client functions in frontend/donor-pwa/src/lib/api/ticket-invitations.ts — sendInvitation(assignmentId, message?), resendInvitation(assignmentId), validateInvitationToken(token), registerViaInvitation(token, data)
- [X] T014 [P] Create Zustand cart store in frontend/donor-pwa/src/stores/ticket-cart-store.ts — state: items (packageId, quantity)[], eventId, promoCode. Actions: addItem, removeItem, updateQuantity, clearCart, setPromoCode. Persist to localStorage via zustand/middleware persist. Scope cart to single event (clear on event change). Compute totals.

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Public Ticket Browsing (Priority: P1) 🎯 MVP

**Goal**: Anonymous visitors can see event details and available ticket packages with prices

**Independent Test**: Navigate to event URL unauthenticated → see event details and ticket packages → click "Buy Tickets" → prompted to sign in

### Implementation for User Story 1

- [X] T015 [US1] Create public tickets API endpoint in backend/app/api/v1/public_tickets.py — GET /api/v1/events/{event_slug}/tickets (no auth). Fetch event by slug, list enabled ticket packages with custom options, compute quantity_remaining (quantity_limit - sold_count, or null if unlimited), set is_sold_out flag. Return event summary + packages array per public-tickets.md contract.
- [X] T016 [US1] Register public_tickets router in backend/app/api/v1/__init__.py or backend/app/main.py — mount at /api/v1/ prefix, no auth dependency
- [X] T017 [US1] Replace stub in frontend/donor-pwa/src/routes/events.$slug.tickets.tsx — fetch packages via getPublicTickets(slug), render TicketPackageList component. Show event hero (name, date, venue, banner). Show auth prompt CTA ("Sign in to buy tickets") for unauthenticated users. Show "Add to Cart" buttons for authenticated users. Handle empty state (no packages), sold-out badges, ticket sales closed message.
- [ ] T018 [US1] Create TicketPackageList component in frontend/donor-pwa/src/features/tickets/TicketPackageList.tsx — render cards for each package: name, description, price, seats_per_package, image, sold-out badge. Quantity selector (1 to per-package limit). "Add to Cart" button (disabled if sold out or unauthenticated). Responsive: 1 column mobile, 2 columns tablet+.

**Checkpoint**: Anonymous users can browse ticket packages on event page

---

## Phase 4: User Story 2 — Multi-Package Cart & Checkout (Priority: P1) 🎯 MVP

**Goal**: Authenticated donors add packages to cart, apply promo codes, and complete checkout with payment

**Independent Test**: Log in → add packages to cart → apply promo code → complete payment → see confirmation

### Implementation for User Story 2

- [X] T019 [US2] Create checkout API endpoint in backend/app/api/v1/ticket_purchases.py — POST /api/v1/events/{event_id}/tickets/checkout (auth required). Parse CheckoutRequest, call ticket_purchasing_service.checkout(), return CheckoutResponse. Handle payment failures (402), validation errors (400), per-donor cap exceeded (409).
- [X] T020 [US2] Create cart validation API endpoint in backend/app/api/v1/ticket_purchases.py — POST /api/v1/events/{event_id}/tickets/validate-cart (auth required). Parse CartValidationRequest, call ticket_purchasing_service.validate_cart(), return CartValidationResponse with item details, promo discount, total, warnings.
- [X] T021 [US2] Create sponsor logo upload endpoint in backend/app/api/v1/ticket_purchases.py — POST /api/v1/events/{event_id}/tickets/sponsorship-logo (auth required). Accept multipart file upload, validate image type/size, upload to Azure Blob Storage temp path, return blob_name + preview_url.
- [X] T022 [US2] Create TicketCart component in frontend/donor-pwa/src/features/tickets/TicketCart.tsx — cart drawer/sidebar showing: package cards with quantity +/- controls, line totals, promo code input with validation, subtotal/discount/total summary, "Proceed to Checkout" button. Remove item button. Cart badge showing item count. Sync with ticket-cart-store.
- [X] T023 [US2] Create SponsorshipInfoForm component in frontend/donor-pwa/src/features/tickets/SponsorshipInfoForm.tsx — form for sponsorship packages: company name (required), logo upload (required, drag-and-drop), website URL (optional), contact name (optional), contact email (optional). Logo preview. Validation. Only shown when cart contains is_sponsorship=true packages.
- [X] T024 [US2] Update frontend/donor-pwa/src/routes/events.$slug.tickets.checkout.tsx — replace single-package flow with multi-package cart checkout. Steps: (1) Review Cart (from cart store), (2) Sponsorship Details (if applicable, using SponsorshipInfoForm), (3) Payment Method (existing PaymentMethodSelector), (4) Review & Pay, (5) Confirmation. Call validateCart before payment. Call checkout on submit. Show success with purchase summary and assigned ticket numbers.
- [ ] T052 [US2] Add order confirmation email — send email immediately after successful purchase with: order summary (packages, quantities, prices), total amount, ticket numbers, payment confirmation reference, link to ticket inventory page. Use Fundrbolt email branding. Called from checkout service on successful payment.

**Checkpoint**: Donors can purchase multiple ticket packages in a single checkout

---

## Phase 5: User Story 3 — Ticket Inventory & Assignment (Priority: P1) 🎯 MVP

**Goal**: Donors view purchased tickets, assign them to guests, and self-register

**Independent Test**: View ticket inventory → assign ticket to guest → assign to self → complete self-registration → ticket statuses update correctly

### Implementation for User Story 3

- [X] T025 [US3] Create purchases list API endpoint in backend/app/api/v1/ticket_purchases.py — GET /api/v1/events/{event_id}/tickets/purchases (auth required). List donor's purchases with assigned tickets and assignment details. Include summary counts (total, assigned, registered, unassigned).
- [X] T026 [US3] Create ticket inventory API endpoint in backend/app/api/v1/ticket_purchases.py — GET /api/v1/tickets/my-inventory (auth required). List all tickets across all events grouped by event. Include summary counts per event.
- [X] T027 [US3] Create ticket assignment API endpoints in backend/app/api/v1/ticket_assignments.py — POST /api/v1/tickets/{assigned_ticket_id}/assign (assign ticket), PATCH /api/v1/tickets/assignments/{assignment_id} (update assignment), DELETE /api/v1/tickets/assignments/{assignment_id} (cancel assignment). All require auth as ticket purchaser.
- [X] T028 [US3] Create self-register API endpoint in backend/app/api/v1/ticket_assignments.py — POST /api/v1/tickets/assignments/{assignment_id}/self-register (auth required, must be assignee). Create EventRegistration, RegistrationGuest, meal selection, custom option responses. Update assignment status to 'registered'. Link registration to assignment.
- [X] T029 [US3] Create cancel-registration API endpoint in backend/app/api/v1/ticket_assignments.py — POST /api/v1/tickets/assignments/{assignment_id}/cancel-registration (auth required). Auth check: must be either the assigned guest OR the original ticket purchaser (coordinator-level cancel). Cancel registration, soft-delete RegistrationGuest, return ticket to unassigned pool. Update assignment status to 'cancelled'. Note: admin-side cancel UI is out of scope for this feature; admins use this API directly or via a future admin UI task.
- [X] T030 [US3] Register ticket_purchases and ticket_assignments routers in backend/app/api/v1/__init__.py or backend/app/main.py
- [X] T031 [US3] Create TicketInventory component in frontend/donor-pwa/src/features/tickets/TicketInventory.tsx — dashboard showing tickets grouped by event. Each event section shows: event name, date, ticket counts (total/assigned/registered/unassigned). Each ticket card shows: ticket number, package name, assignment status, guest name (if assigned). "Assign" button for unassigned tickets. "Assign to Myself" shortcut.
- [X] T032 [US3] Create TicketAssignmentForm component in frontend/donor-pwa/src/features/tickets/TicketAssignmentForm.tsx — modal/dialog for assigning a ticket: guest name input, guest email input, submit button. Validation (required fields, email format). Shows self-assignment detection message when email matches user's.
- [X] T033 [US3] Create TicketAssignmentCard component in frontend/donor-pwa/src/features/tickets/TicketAssignmentCard.tsx — card displaying assignment: guest name, email, status badge (assigned/invited/registered/cancelled), actions (reassign, cancel, send invitation). Different states for each status.
- [X] T034 [US3] Create self-registration inline flow in frontend/donor-pwa/src/features/tickets/SelfRegistrationFlow.tsx — when self-assignment detected, show inline registration form: meal selection dropdown (from event food options), custom ticket option responses (from package custom options), submit button. On success, redirect to event home page.
- [X] T035 [US3] Add ticket inventory route in frontend/donor-pwa/src/routes/ — new route for /tickets (authenticated) showing TicketInventory component. Add navigation link.

**Checkpoint**: Donors can view, assign, self-register, and manage their tickets

---

## Phase 6: User Story 4 — Guest Invitation & Registration (Priority: P2)

**Goal**: Donors send email invitations to assigned guests; guests create accounts and register

**Independent Test**: Assign ticket → send invitation → click link → create account → register → see event on home page

### Implementation for User Story 4

- [X] T036 [US4] Create invitation API endpoints in backend/app/api/v1/ticket_invitations.py — POST /invite (send invitation), POST /resend-invite (resend), GET /invitations/{token}/validate (validate token, public), POST /invitations/{token}/register (register via token, auth required). Rate limit sending to 5 per assignment.
- [X] T037 [US4] Create invitation email template — HTML email using Fundrbolt branding (logo, brand colors from feature 016). Content: event banner image (from event_media), event name, date/time, venue with address, inviter's full name, optional personal message, guest name, "Register Now" CTA button linking to /invite/{token}. Footer: event organizer contact, Fundrbolt branding. Use existing EmailService infrastructure from backend/app/services/email_service.py.
- [X] T038 [US4] Register ticket_invitations router in backend/app/api/v1/__init__.py or backend/app/main.py
- [X] T039 [US4] Create invitation registration route in frontend/donor-pwa/src/routes/invite.$token.tsx — validate token on load, show event details and guest info, prompt sign-in/create account if unauthenticated, show registration form (meal selection + custom options) if authenticated, submit registration, show confirmation and redirect to event.
- [X] T040 [US4] Create InvitationRegistration component in frontend/donor-pwa/src/features/tickets/InvitationRegistration.tsx — multi-step flow: (1) Token validation + event preview, (2) Auth prompt (if not signed in), (3) Registration form (meal + custom options + phone), (4) Confirmation. Handle expired tokens, already-registered state.
- [X] T041 [US4] Wire "Send Invitation" and "Resend" buttons in TicketAssignmentCard — call sendInvitation/resendInvitation API, update UI with invitation_sent_at and count. Show toast on success. Disable resend if guest already registered.

**Checkpoint**: Full invitation → registration flow works end-to-end

---

## Phase 7: User Story 5 — Sponsorship Package Info Collection (Priority: P2)

**Goal**: Sponsorship packages trigger sponsor detail collection during checkout

**Independent Test**: Add sponsorship package to cart → fill sponsor details → checkout → sponsor appears on event page

### Implementation for User Story 5

- [X] T042 [US5] Add sponsorship handling to ticket_purchasing_service.py checkout method — when cart contains is_sponsorship=true packages, require sponsorship_details in request. On successful payment, create Sponsor entry via existing SponsorService: set name, logo (move from temp blob to permanent), website_url, contact fields. Link sponsor.id to ticket_purchase.sponsorship_sponsor_id.
- [X] T043 [US5] Integrate SponsorshipInfoForm into checkout flow — in CartCheckout (T024), conditionally show sponsorship step between cart review and payment. Validate required fields (company name, logo). Upload logo to temp blob via sponsorship-logo endpoint. Pass sponsorship_details to checkout request.

**Checkpoint**: Sponsorship purchases create visible sponsor entries

---

## Phase 8: User Story 6 — Unregistered Donor Landing Experience (Priority: P2)

**Goal**: Authenticated donors with no registrations see ticket inventory instead of empty state

**Independent Test**: Log in as donor with tickets but no registrations → see My Tickets dashboard instead of "no events" message

### Implementation for User Story 6

- [X] T044 [US6] Update authenticated home page in frontend/donor-pwa/src/routes/_authenticated/home.tsx — after fetching events, if user has no registrations, fetch ticket inventory via getMyInventory(). If inventory has tickets: show TicketInventory component with CTAs to assign/register. If no tickets either: show "Browse Events" prompt (existing behavior). If user has registrations: existing behavior (redirect to event).
- [X] T045 [US6] Add "Register Myself" quick action to TicketInventory — for each event with unassigned tickets, show a "Register Myself" button that assigns one ticket to self and triggers SelfRegistrationFlow.

**Checkpoint**: No-registration landing shows useful ticket inventory

---

## Phase 9: User Story 7 — Resend Invitation & Assignment Management (Priority: P3)

**Goal**: Donors can resend invitations, cancel and reassign tickets

**Independent Test**: Resend invitation → cancel assignment → reassign to different person

### Implementation for User Story 7

- [X] T046 [US7] Wire resend/cancel/reassign actions in TicketAssignmentCard — "Resend Invitation" calls resendInvitation API (show count). "Cancel Assignment" calls cancelAssignment API (confirm dialog). "Reassign" opens TicketAssignmentForm pre-filled. Update assignment status after each action.

**Checkpoint**: Assignment management actions work

---

## Phase 10: User Story 8 — Purchase History & Receipts (Priority: P3)

**Goal**: Donors view purchase history and download receipts

**Independent Test**: View purchase history → see all orders → download receipt PDF

### Implementation for User Story 8

- [X] T047 [US8] Create purchase history API endpoint in backend/app/api/v1/ticket_purchases.py — GET /api/v1/tickets/purchase-history (auth required, paginated). List all purchases across events with package details, promo code, total, receipt URL.
- [X] T048 [US8] Create PurchaseHistory component in frontend/donor-pwa/src/features/tickets/PurchaseHistory.tsx — list of purchase cards: event name, date purchased, packages/quantities, promo discount, total amount, payment status, "Download Receipt" link. Pagination.
- [X] T049 [US8] Add purchase history route in frontend/donor-pwa/src/routes/ — /tickets/history (authenticated) showing PurchaseHistory component. Add navigation link from ticket inventory.

**Checkpoint**: Purchase history with receipt download works

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T050 [P] Add audit logging for ticket purchasing and assignment actions — log purchases, assignments, cancellations, invitations in ticket_audit_log via existing TicketAuditLog model
- [ ] T051 [P] Add oversold package warning to admin dashboard — query packages where sold_count > quantity_limit, display warning badge in admin ticket management UI
- [X] T053 Run backend CI checks — cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short
- [X] T054 Run frontend CI checks — cd frontend/donor-pwa && pnpm lint && pnpm format:check && pnpm build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (models and schemas must exist)
- **US1 (Phase 3)**: Depends on Phase 2 (needs public tickets API client)
- **US2 (Phase 4)**: Depends on Phase 2 (needs cart store and checkout service)
- **US3 (Phase 5)**: Depends on Phase 2 (needs assignment service and API clients)
- **US4 (Phase 6)**: Depends on US3 (needs assignment to exist before inviting)
- **US5 (Phase 7)**: Depends on US2 (extends checkout flow)
- **US6 (Phase 8)**: Depends on US3 (needs ticket inventory component)
- **US7 (Phase 9)**: Depends on US4 (needs invitation functionality)
- **US8 (Phase 10)**: Depends on US2 (needs purchases to exist)
- **Polish (Phase 11)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Independent after foundational — no story dependencies
- **US2 (P1)**: Independent after foundational — no story dependencies
- **US3 (P1)**: Independent after foundational — no story dependencies
- **US4 (P2)**: Depends on US3 (ticket assignments must exist)
- **US5 (P2)**: Depends on US2 (checkout flow must exist)
- **US6 (P2)**: Depends on US3 (ticket inventory must exist)
- **US7 (P3)**: Depends on US4 (invitation functionality)
- **US8 (P3)**: Depends on US2 (purchase records)

### Within Each User Story

- Models before services
- Services before endpoints
- Backend before frontend
- Core implementation before integration

### Parallel Opportunities

- T004, T005, T006 can run in parallel (different model columns)
- T011, T012, T013, T014 can run in parallel (different frontend files)
- US1, US2, US3 can run in parallel after foundational phase
- T050, T051 can run in parallel (different cross-cutting files)

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup (database schema)
2. Complete Phase 2: Foundational (services + API clients + cart store)
3. Complete Phase 3: US1 — Public ticket browsing
4. Complete Phase 4: US2 — Cart & checkout
5. Complete Phase 5: US3 — Ticket inventory & assignment
6. **STOP and VALIDATE**: Test stories 1-3 independently
7. Deploy/demo if ready — this is the MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test → Deploy (public ticket browsing)
3. US2 → Test → Deploy (full purchasing)
4. US3 → Test → Deploy (ticket management — MVP complete!)
5. US4 → Test → Deploy (invitations)
6. US5 → Test → Deploy (sponsorship)
7. US6 → Test → Deploy (landing page)
8. US7 + US8 → Test → Deploy (management + history)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Cart store uses Zustand persist middleware with localStorage
- Payment uses existing Deluxe HPF stub (feature 033)
- Sponsor creation reuses existing SponsorService (feature 007)
- Registration flow reuses existing registration models/services (feature 010)
- All hooks in donor PWA must be placed before early returns (known pattern)

# Tasks: 052-impact-donations — Impact Donations

**Input**: Design documents from `.specify/specs/052-impact-donations/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Surface the existing category field and impact-statement behavior through the shared auction-item types and schemas.

- [ ] T001 Update `backend/app/schemas/auction_item.py` to accept and return `category` on create/update payloads so Impact can be persisted end-to-end
- [ ] T002 Update `frontend/fundrbolt-admin/src/types/auction-item.ts` and `frontend/donor-pwa/src/types/auction-item.ts` to include `category` on auction item create/update/detail types

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make Impact Donations safe to use before story-specific UI polish.

- [ ] T003 Update `backend/app/services/auction_item_service.py` to persist the `category` field on create and update operations
- [ ] T004 Update `backend/app/services/auction_bid_service.py` to reject standard bids for items whose category is `Impact` while preserving `buy_now` handling
- [ ] T005 Update `backend/app/api/v1/auction_items.py` and `backend/app/api/v1/admin_auction_dashboard.py` responses to include category consistently in list/detail payloads

**Checkpoint**: Impact items can be stored, published, and protected from standard bids.

---

## Phase 3: User Story 1 - Admin Impact Donations (Priority: P1) 🎯 MVP

**Goal**: Admins can create, edit, and identify Impact Donations from a dedicated tab in Auction Items.

**Independent Test**: An admin can create an Impact item, save it, and see it grouped under the Impact Donations tab.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Add category selection and impact-statement labeling in `frontend/fundrbolt-admin/src/features/events/components/AuctionItemForm.tsx`
- [ ] T007 [P] [US1] Add an Impact Donations tab and category filter in `frontend/fundrbolt-admin/src/features/events/AuctionItemsIndexPage.tsx` and `frontend/fundrbolt-admin/src/features/events/components/AuctionItemList.tsx`
- [ ] T008 [P] [US1] Show an Impact badge and impact-statement summary in `frontend/fundrbolt-admin/src/features/events/components/AuctionItemCard.tsx` and `frontend/fundrbolt-admin/src/features/events/auction-items/AuctionItemDetailPage.tsx`
- [ ] T009 [US1] Add backend validation so Impact items require buy-now settings and a non-empty impact statement in `backend/app/services/auction_item_service.py`

**Checkpoint**: Admin Impact items can be created, edited, and recognized consistently in the admin UI.

---

## Phase 4: User Story 2 - Donor Purchase Flow (Priority: P2)

**Goal**: Donors can find Impact Donations in the Win It experience, filter them, and complete buy-now purchases without bidding.

**Independent Test**: A donor can filter to Impact, open the item, and buy it now while bids remain blocked.

### Implementation for User Story 2

- [ ] T010 [P] [US2] Add the Impact category to the donor gallery category filter and carry category through item mapping in `frontend/donor-pwa/src/components/event-home/AuctionGallery.tsx`
- [ ] T011 [P] [US2] Show Impact-specific badges and buy-now-only presentation in `frontend/donor-pwa/src/components/event-home/AuctionItemCard.tsx`
- [ ] T012 [P] [US2] Suppress bid controls for Impact items and keep buy-now confirmation in `frontend/donor-pwa/src/components/event-home/AuctionItemDetailModal.tsx`
- [ ] T013 [US2] Ensure donor-facing auction item detail and home-page item mapping preserve category and buy-now totals in `frontend/donor-pwa/src/features/events/EventHomePage.tsx` and `frontend/donor-pwa/src/features/events/auction-items/AuctionItemDetailPage.tsx`

**Checkpoint**: Impact items are discoverable in donor UI and are buy-now only in both presentation and backend enforcement.

---

## Phase 5: User Story 3 - Item Video Support (Priority: P3)

**Goal**: Admins can upload video media for auction items and donors can view that media on item detail pages.

**Independent Test**: An admin uploads a video and a donor can see it in the item experience.

### Implementation for User Story 3

- [ ] T014 [P] [US3] Update `frontend/fundrbolt-admin/src/features/events/components/MediaUploadZone.tsx` and `frontend/fundrbolt-admin/src/features/events/components/AuctionItemForm.tsx` copy/labels to make video upload explicit for auction items
- [ ] T015 [P] [US3] Render video media in `frontend/donor-pwa/src/components/event-home/AuctionItemDetailModal.tsx` when a video is present in the item's media list
- [ ] T016 [US3] Add or update backend contract/validation tests in `backend/app/tests/contract/test_auction_items_api.py` and `backend/app/tests/contract/test_auction_bids_api.py` for category persistence and Impact bid rejection

**Checkpoint**: Video uploads are visible in the item experience, and Impact Donation behavior remains intact.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and repo validation.

- [ ] T017 Update `quickstart.md` and `contracts/README.md` if any wording changes are needed after implementation details settle
- [ ] T018 Run `cd backend && poetry run ruff check .`, `cd backend && poetry run ruff format --check .`, `cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`, and `cd backend && poetry run pytest -v --tb=short`
- [ ] T019 Run `cd frontend/fundrbolt-admin && pnpm lint`, `cd frontend/fundrbolt-admin && pnpm format:check`, and `cd frontend/fundrbolt-admin && pnpm build`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) must complete before foundational work.
- Foundational (Phase 2) blocks all user stories.
- User Stories 1, 2, and 3 can then proceed in priority order.

### User Story Dependencies

- User Story 1 establishes the category and admin creation flow.
- User Story 2 depends on the category value and bid guard from Phase 2.
- User Story 3 depends on the existing media upload pipeline and donor item detail rendering.

### Parallel Opportunities

- T006 and T007 can run in parallel.
- T010, T011, and T012 can run in parallel once the foundational category guard exists.
- T014 and T015 can run in parallel with the donor media work.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational tasks.
2. Implement the admin category/Impact Donation UI.
3. Validate that Impact items save and display correctly.

### Incremental Delivery

1. Add the admin workflow.
2. Add donor filtering and buy-now-only presentation.
3. Add video display enhancements.
4. Validate with backend and frontend checks.

## Notes

- Keep `Impact` as the canonical category label.
- Reuse the existing description field as the impact statement.
- Do not add a new database migration.

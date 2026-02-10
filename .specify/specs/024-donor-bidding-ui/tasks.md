---
description: "Task list for Donor Bidding UI"
---

# Tasks: Donor Bidding UI

**Input**: Design documents from `/specs/024-donor-bidding-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare new files required across backend and frontends

- [ ] T001 Create backend model stubs in backend/app/models/watch_list_entry.py, backend/app/models/item_view.py, backend/app/models/item_promotion.py, backend/app/models/buy_now_availability.py
- [ ] T002 [P] Create backend schema stubs in backend/app/schemas/watch_list.py, backend/app/schemas/item_view.py, backend/app/schemas/item_promotion.py, backend/app/schemas/buy_now.py, backend/app/schemas/auction_engagement.py
- [ ] T003 [P] Create backend service stubs in backend/app/services/watch_list_service.py, backend/app/services/item_view_service.py, backend/app/services/item_promotion_service.py, backend/app/services/buy_now_service.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data model, schemas, and service foundations required by all user stories

- [ ] T004 Update auction item model fields in backend/app/models/auction_item.py
- [ ] T005 Update bid model fields in backend/app/models/auction_bid.py
- [ ] T006 Update model exports in backend/app/models/__init__.py
- [ ] T007 Create Alembic migration for new tables/columns in backend/alembic/versions/ (new migration file)
- [ ] T008 Update schemas for item and bid fields in backend/app/schemas/auction_item.py and backend/app/schemas/auction_bid.py
- [ ] T009 Extend services for bidding rules and buy-now validation in backend/app/services/auction_item_service.py and backend/app/services/auction_bid_service.py
- [ ] T010 Implement watch list and item view persistence in backend/app/services/watch_list_service.py and backend/app/services/item_view_service.py
- [ ] T011 Add API router modules in backend/app/api/v1/watchlist.py and backend/app/api/v1/admin_auction_items.py
- [ ] T012 Register new routers in backend/app/api/v1/__init__.py and backend/app/api/v1/admin.py
- [ ] T013 Update contracts for any new endpoints in .specify/specs/024-donor-bidding-ui/contracts/openapi.yaml

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Bid on an item from the gallery (Priority: P1) 🎯 MVP

**Goal**: Donors can see current bids in the gallery, open a vertical bid slider, confirm with a slide, place bids or max bids, and see buy-now state.

**Independent Test**: From the donor gallery, open bid slider, confirm a bid, see success notification and updated current bid; buy-now shows disabled with explanation when unavailable.

### Implementation for User Story 1

- [ ] T014 [US1] Update donor types in frontend/donor-pwa/src/types/auction-item.ts and frontend/donor-pwa/src/types/auction-gallery.ts
- [ ] T015 [P] [US1] Update donor API service for gallery/detail/bid/max-bid/buy-now in frontend/donor-pwa/src/services/auctionItemService.ts
- [ ] T016 [US1] Implement donor endpoints for gallery, detail, bid, max-bid, buy-now in backend/app/api/v1/auction_items.py and backend/app/api/v1/auction_bids.py
- [ ] T017 [US1] Update gallery page to render bid UI in frontend/donor-pwa/src/features/events/auction-items/AuctionItemsIndexPage.tsx
- [ ] T018 [P] [US1] Update auction item card UI in frontend/donor-pwa/src/features/events/components/AuctionItemCard.tsx
- [ ] T019 [P] [US1] Create bid slider modal in frontend/donor-pwa/src/features/events/components/BidSliderModal.tsx
- [ ] T020 [P] [US1] Create bid confirmation slide component in frontend/donor-pwa/src/features/events/components/BidConfirmSlide.tsx
- [ ] T021 [US1] Create bid success toast in frontend/donor-pwa/src/components/BidSuccessToast.tsx
- [ ] T022 [US1] Wire bid flow and success toast in frontend/donor-pwa/src/features/events/auction-items/AuctionItemsIndexPage.tsx

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Explore item details and manage a watch list (Priority: P2)

**Goal**: Donors can view item details with images and bid counts, add/remove watch list items, see watched items prominently, and record view duration.

**Independent Test**: Open item detail, swipe images, toggle watch list, confirm watched items section in gallery and watcher count badge.

### Implementation for User Story 2

- [ ] T023 [US2] Extend donor service for watch list and view tracking in frontend/donor-pwa/src/services/auctionItemService.ts
- [ ] T024 [P] [US2] Create watch list toggle UI in frontend/donor-pwa/src/features/events/components/WatchListButton.tsx
- [ ] T025 [P] [US2] Create view tracking hook in frontend/donor-pwa/src/hooks/useItemViewTracking.ts
- [ ] T026 [US2] Update item detail UI in frontend/donor-pwa/src/features/events/auction-items/AuctionItemDetailPage.tsx
- [ ] T027 [US2] Update gallery to show watched items section in frontend/donor-pwa/src/features/events/auction-items/AuctionItemsIndexPage.tsx
- [ ] T028 [US2] Implement watch list endpoints in backend/app/api/v1/watchlist.py
- [ ] T029 [US2] Add item view tracking endpoint in backend/app/api/v1/auction_items.py and wire to backend/app/services/item_view_service.py

**Checkpoint**: User Story 2 is fully functional and testable independently

---

## Phase 5: User Story 3 - Admin insights and promotion controls (Priority: P3)

**Goal**: Admins can see engagement details, manage item promotions, and control buy-now availability.

**Independent Test**: Open admin item detail, view watchers/bids/views, set promotion badge/notice, and update buy-now availability.

### Implementation for User Story 3

- [ ] T030 [US3] Update admin types for engagement and promotion in frontend/fundrbolt-admin/src/types/auction-item.ts
- [ ] T031 [P] [US3] Update admin API service for engagement/promotion/buy-now in frontend/fundrbolt-admin/src/services/auctionItemService.ts
- [ ] T032 [P] [US3] Create engagement panel in frontend/fundrbolt-admin/src/features/events/auction-items/components/EngagementPanel.tsx
- [ ] T033 [P] [US3] Create promotion editor in frontend/fundrbolt-admin/src/features/events/auction-items/components/PromotionEditor.tsx
- [ ] T034 [P] [US3] Create buy-now editor in frontend/fundrbolt-admin/src/features/events/auction-items/components/BuyNowEditor.tsx
- [ ] T035 [US3] Update admin item detail page in frontend/fundrbolt-admin/src/features/events/auction-items/AuctionItemDetailPage.tsx
- [ ] T036 [US3] Update admin item gallery list in frontend/fundrbolt-admin/src/features/events/auction-items/AuctionItemsIndexPage.tsx
- [ ] T037 [US3] Implement admin endpoints in backend/app/api/v1/admin_auction_items.py
- [ ] T038 [US3] Implement admin promotion and buy-now services in backend/app/services/item_promotion_service.py and backend/app/services/buy_now_service.py

**Checkpoint**: User Story 3 is fully functional and testable independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Add consistent disabled-state copy in frontend/donor-pwa/src/features/events/components/BidSliderModal.tsx and frontend/donor-pwa/src/features/events/components/AuctionItemCard.tsx
- [ ] T040 [P] Run quickstart validation steps in .specify/specs/024-donor-bidding-ui/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- Phase 1 tasks T002–T003 can run in parallel
- Phase 2 tasks T004–T012 can be split by backend model/schema/service ownership
- In Phase 3, tasks T018–T020 can run in parallel with T015
- In Phase 4, tasks T024–T025 can run in parallel with T023
- In Phase 5, tasks T032–T034 can run in parallel with T031

---

## Parallel Example: User Story 1

- T018 Update auction item card UI in frontend/donor-pwa/src/features/events/components/AuctionItemCard.tsx
- T019 Create bid slider modal in frontend/donor-pwa/src/features/events/components/BidSliderModal.tsx
- T020 Create bid confirmation slide component in frontend/donor-pwa/src/features/events/components/BidConfirmSlide.tsx

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate User Story 1 independently from the donor gallery

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 → validate bidding flow
3. User Story 2 → validate item detail + watch list
4. User Story 3 → validate admin engagement + promotions

---

## Notes

- [P] tasks = different files, no dependencies
- Each user story is independently completable and testable
- Avoid scope creep beyond specified requirements

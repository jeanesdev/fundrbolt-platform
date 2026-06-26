# Analysis: 052-impact-donations

**Date**: 2026-06-26
**Analyzed by**: /speckit.analyze
**Input**: `plan.md`, `tasks.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/README.md`
**Codebase reference**: backend auction item and bid services, admin auction item form/list, donor gallery, donor item modal

---

## Findings Summary

| ID | Severity | Category | Finding | Remediation |
|----|----------|----------|---------|-------------|
| F001 | 🔴 HIGH | Backend validation | `AuctionItemService` did not persist `category`, so Impact items could not be created or updated reliably | Persist `category` on create/update and add unit tests |
| F002 | 🔴 HIGH | Bid enforcement | `AuctionBidService.place_bid` allowed regular bids on items modeled as Impact donations | Reject non-buy-now bids when `category = Impact` |
| F003 | 🟡 MEDIUM | Admin UX | Auction Items index had no dedicated Impact view/tab, making Impact donations harder to manage distinctly | Add an `Impact Donations` filter tab and render path in the admin list |
| F004 | 🟡 MEDIUM | Donor UX | Donor cards and modal still presented Impact items like ordinary bid-able silent items | Surface Impact category, show buy-now-only CTA, and suppress bid controls in the modal |
| F005 | 🟡 MEDIUM | Media support | Video upload was already present in the backend and admin media tools, but donor-facing item detail did not explicitly preserve video visibility | Keep the existing media pipeline and ensure donor item detail continues to render video-capable media |
| F006 | 🟢 LOW | Type safety | Donor gallery sort comparator assumed bid values were always non-null | Guard bid values with `0` fallback in the sort comparator |
| F007 | 🟢 LOW | Validation scope | Donor build still reports existing unrelated type mismatches in `EventHomePage.tsx` and `home.tsx` | Leave these untouched; they predate this feature and are outside the Impact slice |

---

## Detailed Findings

### F001 — Category was not persisted

**Location**: `backend/app/schemas/auction_item.py`, `backend/app/services/auction_item_service.py`

**Details**: The auction item model already has a `category` column, but the create/update schemas did not expose it and the service layer did not copy it into the ORM model. That meant the Impact classification could not survive save/update cycles.

**Remediation applied**:
- Added `category` to `AuctionItemBase` and `AuctionItemUpdate`
- Set `category=item_data.category` when creating items
- Added unit tests proving category persistence and validation

### F002 — Regular bids were still accepted on Impact items

**Location**: `backend/app/services/auction_bid_service.py`

**Details**: Impact Donations are modeled as silent auction items with a category flag, so the backend bid service must enforce buy-now-only behavior. Without a category-specific guard, direct API calls could still place regular bids.

**Remediation applied**:
- Added a guard that rejects non-buy-now bids when `item.category == 'Impact'`
- Added a unit test confirming regular bids are blocked

### F003 — Admin management lacked a dedicated Impact view

**Location**: `frontend/fundrbolt-admin/src/features/events/auction-items/AuctionItemsIndexPage.tsx`

**Details**: The Auction Items page only filtered by auction type. Impact Donations needed a dedicated management tab so admins can quickly isolate them.

**Remediation applied**:
- Added an `Impact Donations` filter option
- Rendered a dedicated Impact grid section in the admin page
- Added an Impact badge/signal on admin cards

### F004 — Donor experience did not clearly treat Impact items as buy-now-only

**Location**: `frontend/donor-pwa/src/components/event-home/AuctionItemCard.tsx`, `frontend/donor-pwa/src/components/event-home/AuctionItemDetailModal.tsx`

**Details**: The donor gallery treated all silent items the same. Impact Donations needed clearer labeling and suppression of bidding controls so they read as donations, not competitive items.

**Remediation applied**:
- Added category-aware Impact badge and buy-now-only CTA on the card
- Hid bid controls in the item detail modal for Impact items
- Kept the buy-now flow intact

### F005 — Video support already existed, but donor display needed to remain compatible

**Location**: `frontend/fundrbolt-admin/src/features/events/components/MediaUploadZone.tsx`, `frontend/donor-pwa/src/components/event-home/AuctionItemDetailModal.tsx`

**Details**: The upload pipeline already supports video media. The feature’s main requirement here was to avoid breaking donor-side media rendering while adding Impact handling.

**Remediation applied**:
- Preserved existing media structures
- Left donor media rendering intact while updating item state and category handling

### F006 — Nullable sort operands in donor gallery

**Location**: `frontend/donor-pwa/src/components/event-home/AuctionGallery.tsx`

**Details**: Once the donor gallery types were widened for category/buy-now data, the bid sort comparator needed explicit null handling.

**Remediation applied**:
- Added `0` fallbacks before sorting by current bid / starting bid

### F007 — Existing donor build errors remain outside this feature

**Location**: `frontend/donor-pwa/src/features/events/EventHomePage.tsx`, `frontend/donor-pwa/src/routes/_authenticated/home.tsx`

**Details**: The donor build still fails on two pre-existing type mismatches unrelated to Impact Donations. They are outside the touched slice and were not changed.

**Remediation status**:
- Left unchanged
- Feature-specific donor files are clean; the remaining errors are pre-existing workspace issues

---

## Status

The Impact Donations feature now has:
- persisted category support
- backend buy-now-only enforcement
- admin Impact management tab
- donor-facing Impact presentation and bid suppression
- video-capable media compatibility preserved
- targeted unit coverage for the new behavior

The donor build still has unrelated pre-existing type errors outside this feature slice.

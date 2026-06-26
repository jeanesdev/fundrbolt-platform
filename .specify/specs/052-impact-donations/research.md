# Research: 052-impact-donations — Impact Donations

**Date**: 2026-06-26 | **Branch**: `052-impact-donations`

## 1. Data Model Strategy

### Decision: Reuse the existing `auction_items.category` column with the canonical value `Impact`

**Rationale**: The repository already has a nullable `category` column on `auction_items`, and both admin and donor surfaces already pass category data through nearby analytics and gallery code. Reusing the existing column avoids a migration and keeps the feature aligned with the clarification that Impact Donations are silent auction items with an Impact flag/category.

**Alternatives considered**:
- Add a new `impact_statement` column and a new item subtype. Rejected because it would require a migration and create a second public item model for a concept already expressible with the current schema.
- Encode Impact Donations as a separate table. Rejected as over-engineering for a category-level variation of existing item behavior.

## 2. Impact Statement Handling

### Decision: Use the existing item description as the donor-facing impact statement

**Rationale**: The current auction item model already stores rich text description and the donor UI already renders it prominently. Labeling this field as the impact statement in the admin form satisfies the feature request without adding schema churn.

**Alternatives considered**:
- Add a dedicated impact_statement field. Rejected because the repository already has a suitable text field and the user-facing behavior does not need a separate persisted column.

## 3. Buy-Now-Only Enforcement

### Decision: Enforce buy-now-only behavior in the bid service for items with category `Impact`

**Rationale**: `AuctionBidService.place_bid` is the central gate for bid creation. Allowing the UI to hide bid controls is not sufficient because bids can still be submitted through direct requests. The backend must reject standard bids for Impact items while still allowing `buy_now` requests.

**Alternatives considered**:
- Rely on frontend-only suppression. Rejected because it leaves the feature bypassable.
- Add a new auction type. Rejected because the clarification selected a category/flag model, not a new type.

## 4. Donor Gallery and Tabs

### Decision: Extend the existing gallery category filter and admin list into a visible Impact tab

**Rationale**: The donor gallery already maintains category state and derives categories from loaded items. The admin auction-item list already groups by auction type. Adding an Impact tab is a localized change that matches user expectations without changing the underlying item model.

**Alternatives considered**:
- Create a separate Impact Donations page. Rejected because the feature explicitly asked for an in-place tab.

## 5. Video Media

### Decision: Preserve the existing video media pipeline and expose it consistently in the item detail view

**Rationale**: The media upload component and backend media model already support videos. The main missing piece is making sure donor-facing item detail can display video media, not just accept it on upload.

**Alternatives considered**:
- Add a new video upload system. Rejected because the repo already has one.

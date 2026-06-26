# Data Model: 052-impact-donations — Impact Donations

**Date**: 2026-06-26 | **Branch**: `052-impact-donations`

## Overview

Impact Donations reuse the existing auction item record. No new tables or migrations are required.

## Entities

### AuctionItem

**Purpose**: Represents both standard silent auction items and Impact Donations.

**Relevant fields**:
- `category`: nullable string; canonical value `Impact` identifies an Impact Donation.
- `auction_type`: remains `silent` for Impact Donations.
- `description`: serves as the impact statement for the donation.
- `buy_now_enabled`: must be `true` for Impact Donations.
- `buy_now_price`: required for buy-now purchase flow.
- `starting_bid` and `bid_increment`: retained for model compatibility, but standard bids are blocked when `category = Impact`.
- `status`: draft/published lifecycle remains unchanged.
- `quantity_available`: remains the inventory control for buy-now fulfillment.

**Relationships**:
- Has many `AuctionItemMedia` records.
- Belongs to one event.

**Validation rules**:
- Impact Donations must have a non-empty description/impact statement.
- Impact Donations must be classified with category `Impact`.
- Standard bids are rejected for Impact Donations.

### AuctionItemMedia

**Purpose**: Stores images and videos attached to an auction item.

**Relevant fields**:
- `media_type`: supports `image` and `video`.
- `file_path`, `file_name`, `mime_type`, `display_order`, `thumbnail_path`, `video_url`.

**Relationships**:
- Belongs to one `AuctionItem`.

**Validation rules**:
- Video uploads remain valid for Impact Donations and other auction items.

### Donation Total

**Purpose**: The aggregate donation revenue reported for an event.

**Source**:
- Buy-now purchases for Impact Donations contribute to the same donation totals as other buy-now donations.

## State and Behavior Notes

- Impact Donations follow the same draft/publish lifecycle as other auction items.
- Donor-facing presentation is category-driven, not a separate item type.
- Buy-now purchase completion is the only supported buyer action for Impact Donations.

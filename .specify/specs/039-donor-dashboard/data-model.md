# Data Model: Donor Dashboard

**Feature**: 039-donor-dashboard
**Date**: 2026-04-06

## Overview

No new database tables or migrations are required. All donor dashboard data is computed from existing models via aggregation queries. This document defines the computed/derived entities returned by the API.

## Existing Models Used (Read-Only)

### Source Models

| Model | Table | Key Fields Used |
|-------|-------|-----------------|
| `User` | `users` | `id`, `first_name`, `last_name`, `email`, `phone`, `is_active` |
| `Event` | `events` | `id`, `npo_id`, `slug`, `name`, `status`, `event_datetime` |
| `NPO` | `npos` | `id`, `name` |
| `TicketPurchase` | `ticket_purchases` | `event_id`, `user_id`, `total_price`, `payment_status` |
| `AuctionBid` | `auction_bids` | `event_id`, `auction_item_id`, `user_id`, `bid_amount`, `bid_status`, `bid_type` |
| `AuctionItem` | `auction_items` | `id`, `event_id`, `category`, `auction_type`, `title` |
| `QuickEntryBid` | `quick_entry_live_bids` | `event_id`, `item_id`, `donor_user_id`, `amount`, `status` |
| `QuickEntryBuyNowBid` | `quick_entry_buy_now_bids` | `event_id`, `item_id`, `donor_user_id`, `amount` |
| `QuickEntryDonation` | `quick_entry_paddle_raise_donations` | `event_id`, `donor_user_id`, `amount` |
| `PaddleRaiseContribution` | `paddle_raise_contributions` | `event_id`, `user_id`, `amount` |
| `Donation` | `donations` | `event_id`, `donor_user_id`, `amount`, `status`, `is_paddle_raise` |
| `EventRegistration` | `event_registrations` | `id`, `user_id`, `event_id`, `status` |
| `RegistrationGuest` | `registration_guests` | `registration_id`, `user_id`, `checked_in`, `check_in_time` |
| `NPOMember` | `npo_members` | `user_id`, `npo_id`, `role`, `status` |

## Derived Entities (API Response Shapes)

### DonorLeaderboardEntry

Represents one donor in the ranked leaderboard.

| Field | Type | Source |
|-------|------|--------|
| `user_id` | UUID | `User.id` |
| `first_name` | string | `User.first_name` |
| `last_name` | string | `User.last_name` |
| `email` | string | `User.email` |
| `is_active` | boolean | `User.is_active` |
| `total_given` | decimal | Sum of all giving categories below |
| `events_attended` | integer | Count of events where `RegistrationGuest.checked_in = True` |
| `ticket_total` | decimal | Sum of `TicketPurchase.total_price` (COMPLETED) |
| `donation_total` | decimal | Sum of `Donation.amount` (ACTIVE) + `QuickEntryDonation.amount` + `PaddleRaiseContribution.amount` |
| `silent_auction_total` | decimal | Sum of winning `AuctionBid.bid_amount` (SILENT items) |
| `live_auction_total` | decimal | Sum of winning `QuickEntryBid.amount` |
| `buy_now_total` | decimal | Sum of `QuickEntryBuyNowBid.amount` |

### DonorProfile

Detailed view of a single donor's activity.

| Field | Type | Source |
|-------|------|--------|
| `user_id` | UUID | `User.id` |
| `first_name` | string | `User.first_name` |
| `last_name` | string | `User.last_name` |
| `email` | string | `User.email` |
| `phone` | string | `User.phone` |
| `is_active` | boolean | `User.is_active` |
| `total_given` | decimal | Aggregate across all categories |
| `events_attended` | integer | Check-in count |
| `event_history` | list[EventAttendance] | Per-event breakdown |
| `bid_history` | list[BidRecord] | All bids placed |
| `donation_history` | list[DonationRecord] | All donations |
| `ticket_history` | list[TicketRecord] | All ticket purchases |
| `category_interests` | list[CategoryInterest] | Bid activity by auction item category |
| `outbid_summary` | OutbidSummary | Outbid metrics |

### EventAttendance

| Field | Type | Source |
|-------|------|--------|
| `event_id` | UUID | `Event.id` |
| `event_name` | string | `Event.name` |
| `event_date` | datetime | `Event.event_datetime` |
| `npo_id` | UUID | `Event.npo_id` |
| `npo_name` | string | `NPO.name` |
| `checked_in` | boolean | `RegistrationGuest.checked_in` |
| `total_given_at_event` | decimal | Sum for this donor at this event |

### BidRecord

| Field | Type | Source |
|-------|------|--------|
| `bid_id` | UUID | `AuctionBid.id` or `QuickEntryBid.id` |
| `event_id` | UUID | Source event |
| `event_name` | string | `Event.name` |
| `item_id` | UUID | `AuctionItem.id` |
| `item_title` | string | `AuctionItem.title` |
| `item_category` | string | `AuctionItem.category` |
| `bid_amount` | decimal | The bid amount |
| `bid_status` | string | WINNING / OUTBID / ACTIVE / CANCELLED |
| `bid_type` | string | SILENT / LIVE / BUY_NOW |
| `created_at` | datetime | When bid was placed |

### OutbidSummary

| Field | Type | Source |
|-------|------|--------|
| `total_outbid_amount` | decimal | Sum of max bid on each lost item |
| `items_bid_on` | integer | Count of distinct items bid on |
| `items_won` | integer | Count of items with WINNING status |
| `items_lost` | integer | `items_bid_on - items_won` |
| `win_rate` | decimal | `items_won / items_bid_on` (0 if none) |

### CategoryInterest

| Field | Type | Source |
|-------|------|--------|
| `category` | string | `AuctionItem.category` enum value |
| `bid_count` | integer | Number of bids placed on items in this category |
| `total_bid_amount` | decimal | Sum of all bids in this category |
| `items_won` | integer | Winning bids in this category |

### BidWarEntry

| Field | Type | Source |
|-------|------|--------|
| `user_id` | UUID | `User.id` |
| `first_name` | string | `User.first_name` |
| `last_name` | string | `User.last_name` |
| `bid_war_count` | integer | Number of distinct items with 3+ bids from this donor |
| `total_bids_in_wars` | integer | Total bids across all bid war items |
| `top_war_items` | list[BidWarItem] | Top 5 items by bid count |

### BidWarItem

| Field | Type | Source |
|-------|------|--------|
| `item_id` | UUID | `AuctionItem.id` |
| `item_title` | string | `AuctionItem.title` |
| `bid_count` | integer | Number of bids from this donor on this item |
| `highest_bid` | decimal | Max bid from this donor on this item |
| `won` | boolean | Whether this donor won the item |

## Key Query Patterns

### Leaderboard Aggregation (per-donor totals)
1. Start with `User` table
2. LEFT JOIN each revenue source, grouped by `user_id`
3. Filter by `Event.npo_id IN (accessible_npo_ids)` and `Event.status IN (ACTIVE, CLOSED)`
4. Optionally filter by single `event_id` (This Event mode)
5. Compute sums per category, total, and attendance count
6. ORDER BY `total_given DESC`, paginate

### Outbid Calculation
1. CTE: For each AuctionItem, identify winning bid (max `bid_amount` where `bid_status = WINNING`)
2. For each donor-item pair, find their max bid where `bid_status = OUTBID`
3. Sum those max bids per donor = `total_outbid_amount`
4. Count distinct items per donor for `items_lost`

### Bid War Detection
1. GROUP BY `(user_id, auction_item_id)`, COUNT bids
2. HAVING count >= 3
3. Re-group by `user_id`, count distinct items = `bid_war_count`

# Data Model: Duplicate Event

**Feature**: 031-duplicate-event
**Date**: 2025-03-04

## Overview

Event duplication creates a new `Event` record plus associated child records. No schema changes or migrations are required — all existing tables and columns support the clone operation.

## Entity Cloning Matrix

### Event (source → clone)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `npo_id` | Copy | Same NPO |
| `name` | Transform | `"{source.name} (Copy)"` |
| `slug` | Generate | Via `_generate_unique_slug()` |
| `custom_slug` | Clear | `NULL` |
| `tagline` | Copy | Same value |
| `status` | Override | `DRAFT` |
| `event_datetime` | Clear | `NULL` — admin must set new date |
| `timezone` | Copy | Same value |
| `venue_name` | Copy | Same value |
| `venue_address` | Copy | Same value |
| `venue_city` | Copy | Same value |
| `venue_state` | Copy | Same value |
| `venue_zip` | Copy | Same value |
| `attire` | Copy | Same value |
| `fundraising_goal` | Copy | Same value |
| `primary_contact_name` | Copy | Same value |
| `primary_contact_email` | Copy | Same value |
| `primary_contact_phone` | Copy | Same value |
| `description` | Copy | Same value |
| `logo_url` | Copy | Same value (shared ref) |
| `primary_color` | Copy | Same value |
| `secondary_color` | Copy | Same value |
| `background_color` | Copy | Same value |
| `accent_color` | Copy | Same value |
| `hero_transition_style` | Copy | Same value |
| `table_count` | Copy | Same value |
| `max_guests_per_table` | Copy | Same value |
| `seating_layout_image_url` | Conditional | `NULL` by default; deep-copied media asset URL when `include_media=true` |
| `version` | Reset | `1` |
| `created_by` | Set | Current user ID |
| `updated_by` | Set | Current user ID |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### FoodOption (always cloned)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `name` | Copy | Same value |
| `description` | Copy | Same value |
| `display_order` | Copy | Same value |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### TicketPackage (always cloned)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `created_by` | Set | Current user ID |
| `name` | Copy | Same value |
| `description` | Copy | Same value |
| `price` | Copy | Same value |
| `seats_per_package` | Copy | Same value |
| `quantity_limit` | Copy | Same value |
| `sold_count` | Reset | `0` |
| `display_order` | Copy | Same value |
| `image_url` | Copy | Same value (shared ref) |
| `is_enabled` | Copy | Same value (preserve state) |
| `is_sponsorship` | Copy | Same value |
| `version` | Reset | `1` |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### CustomTicketOption (cloned with parent TicketPackage)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `ticket_package_id` | Set | New TicketPackage ID |
| `option_label` | Copy | Same value |
| `option_type` | Copy | Same value |
| `choices` | Copy | Same JSONB value |
| `is_required` | Copy | Same value |
| `display_order` | Copy | Same value |
| `created_at` | Auto | DB default |

### EventTable (always cloned)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `table_number` | Copy | Same value |
| `custom_capacity` | Copy | Same value |
| `table_name` | Copy | Same value |
| `table_captain_id` | Clear | `NULL` (no guests to assign) |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### Sponsor (always cloned)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `created_by` | Set | Current user ID |
| `name` | Copy | Same value |
| `logo_url` | Copy | Same value (shared ref) |
| `logo_blob_name` | Copy | Same value (shared ref) |
| `thumbnail_url` | Copy | Same value (shared ref) |
| `thumbnail_blob_name` | Copy | Same value (shared ref) |
| `logo_size` | Copy | Same value |
| `display_order` | Copy | Same value |
| `website_url` | Copy | Same value |
| `sponsor_level` | Copy | Same value |
| `contact_name` | Copy | Same value |
| `contact_email` | Copy | Same value |
| `contact_phone` | Copy | Same value |
| `donation_amount` | Copy | Same value |
| `description` | Copy | Same value |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### EventMedia (optional — cloned when `include_media=true`)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `media_type` | Copy | Same value |
| `usage_tag` | Copy | Same value |
| `file_url` | Generate | New blob URL (deep-copied) |
| `file_name` | Copy | Same value |
| `file_type` | Copy | Same value |
| `mime_type` | Copy | Same value |
| `blob_name` | Generate | New blob path under new event namespace |
| `file_size` | Copy | Same value |
| `display_order` | Copy | Same value |
| `status` | Copy | Same value |
| `uploaded_by` | Set | Current user ID |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### EventLink (optional — cloned when `include_links=true`)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `link_type` | Copy | Same value |
| `url` | Copy | Same value |
| `label` | Copy | Same value |
| `platform` | Copy | Same value |
| `display_order` | Copy | Same value |
| `created_by` | Set | Current user ID |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

### DonationLabel (optional — cloned when `include_donation_labels=true`)

| Field | Action | Clone Value |
|---|---|---|
| `id` | Generate | New UUID |
| `event_id` | Set | New event ID |
| `name` | Copy | Same value |
| `is_active` | Copy | Same value |
| `retired_at` | Clear | `NULL` |
| `created_at` | Auto | DB default |
| `updated_at` | Auto | DB default |

## Entities NOT Cloned

The following relationships are explicitly excluded from duplication:

| Entity | Reason |
|---|---|
| `EventRegistration` | Transactional data — registrations belong to the source event |
| `RegistrationGuest` | Child of registrations — not cloned |
| `MealSelection` | Child of registrations — not cloned |
| `AuctionItem` | Per spec — auction items are event-specific |
| `AuctionBid` | Transactional data — bids belong to the source event |
| `PromoCode` | Marketing data — promo codes are event-specific campaigns |
| `TicketPurchase` | Transactional data — purchases belong to the source event |
| `Donation` | Transactional data — donations belong to the source event |
| `DonationLabelAssignment` | Transactional data — assignments belong to specific donations |

## Blob Storage Deep-Copy (Media)

When `include_media=true`, blobs are server-side copied:

```
Source blob path:  events/{source_event_id}/media/{filename}
Target blob path:  events/{new_event_id}/media/{filename}
```

Implementation: Azure Blob Storage `start_copy_from_url()` with the source blob's SAS URL. New `MediaService.copy_blob()` static method handles this.

## Database Transaction Strategy

All database operations wrapped in a single transaction:
1. Create new `Event` record
2. Clone `FoodOption` records
3. Clone `TicketPackage` + `CustomTicketOption` records
4. Clone `EventTable` records
5. Clone `Sponsor` records
6. (Optional) Deep-copy `EventMedia` blobs, then create `EventMedia` records
7. (Optional) Clone `EventLink` records
8. (Optional) Clone `DonationLabel` records
9. Commit

If any step fails, the entire transaction rolls back. Blob copies that already completed before a rollback become orphans — they'll be cleaned up by a future storage cleanup job (or are negligible cost).

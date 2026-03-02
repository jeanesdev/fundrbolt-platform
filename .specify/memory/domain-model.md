# Fundrbolt Domain Model

## Core Entities

### Organization
**Description:** Nonprofit or entity running fundraising events

**Attributes:**
- `id` (UUID, primary key)
- `name` (string, required)
- `logo_url` (string, nullable, Azure Blob path)
- `contact_email` (string, required)
- `stripe_account_id` (string, nullable, for payouts)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `events` (one-to-many → Event)
- `users` (many-to-many → User, via OrganizationUser)

---

### User
**Description:** Any person using the platform (coordinator, donor, staff, auctioneer, admin)

**Attributes:**
- `id` (UUID, primary key)
- `email` (string, unique, required)
- `password_hash` (string, required)
- `first_name` (string, required)
- `last_name` (string, required)
- `phone` (string, nullable, for SMS)
- `role` (enum: superadmin, event_coordinator, auctioneer, staff, bidder)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `organizations` (many-to-many → Organization, via OrganizationUser)
- `bids` (one-to-many → Bid)
- `paddles` (one-to-many → Paddle)

---

### Event
**Description:** A single fundraising gala/auction

**Attributes:**
- `id` (UUID, primary key)
- `organization_id` (UUID, foreign key → Organization)
- `name` (string, required)
- `slug` (string, unique, for URL like /galas/spring-gala-2025)
- `date` (datetime, required)
- `venue` (string, nullable)
- `brand_primary_color` (string, hex code, nullable)
- `brand_secondary_color` (string, hex code, nullable)
- `logo_url` (string, nullable, overrides org logo if set)
- `status` (enum: draft, active, closed)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `organization` (many-to-one → Organization)
- `auctions` (one-to-many → Auction)
- `paddles` (one-to-many → Paddle)
- `staff_assignments` (many-to-many → User, via EventStaff)

---

### Auction
**Description:** Live or silent auction within an event

**Attributes:**
- `id` (UUID, primary key)
- `event_id` (UUID, foreign key → Event)
- `type` (enum: live, silent)
- `name` (string, required, e.g., "Live Auction", "Silent Auction - Travel")
- `start_time` (datetime, nullable, auto-start for live)
- `end_time` (datetime, nullable, auto-close for silent)
- `status` (enum: pending, active, closed)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `event` (many-to-one → Event)
- `items` (one-to-many → Item)

---

### Item
**Description:** Individual auction item/lot

**Attributes:**
- `id` (UUID, primary key)
- `auction_id` (UUID, foreign key → Auction)
- `name` (string, required)
- `description` (text, nullable)
- `image_url` (string, nullable, Azure Blob path)
- `starting_bid` (decimal, required)
- `bid_increment` (decimal, required, e.g., $25)
- `fair_market_value` (decimal, nullable, for tax receipts)
- `current_high_bid` (decimal, nullable, denormalized for performance)
- `current_high_bidder_id` (UUID, nullable, foreign key → User)
- `status` (enum: draft, active, sold, unsold)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `auction` (many-to-one → Auction)
- `bids` (one-to-many → Bid)
- `current_high_bidder` (many-to-one → User, nullable)

---

### Bid
**Description:** A bid placed on an item

**Attributes:**
- `id` (UUID, primary key)
- `item_id` (UUID, foreign key → Item)
- `user_id` (UUID, foreign key → User)
- `amount` (decimal, required)
- `is_winning` (boolean, denormalized, updated when outbid)
- `created_at` (datetime, immutable, serves as bid timestamp)

**Relationships:**
- `item` (many-to-one → Item)
- `user` (many-to-one → User)

**Business Rules:**
- `amount` must be >= `item.starting_bid` (if first bid)
- `amount` must be >= `item.current_high_bid + item.bid_increment` (if not first)
- Bids are immutable (no updates/deletes)

---

### Paddle
**Description:** Digital bid paddle assigned to a user for an event

**Attributes:**
- `id` (UUID, primary key)
- `event_id` (UUID, foreign key → Event)
- `user_id` (UUID, foreign key → User)
- `paddle_number` (integer, unique per event, e.g., 42)
- `is_active` (boolean, can be locked by auctioneer)
- `created_at` (datetime)
- `updated_at` (datetime)

**Relationships:**
- `event` (many-to-one → Event)
- `user` (many-to-one → User)

**Business Rules:**
- One user can have multiple paddles per event (e.g., couple has 2 devices, 1 account)
- `paddle_number` must be unique within an event

---

## Join Tables (Many-to-Many)

### OrganizationUser
Links users to organizations with roles.

**Attributes:**
- `organization_id` (UUID, foreign key → Organization)
- `user_id` (UUID, foreign key → User)
- `role` (enum: owner, admin, member)

---

### EventStaff
Links staff/auctioneers to events.

**Attributes:**
- `event_id` (UUID, foreign key → Event)
- `user_id` (UUID, foreign key → User)
- `role` (enum: auctioneer, staff)

---

## Enums

### UserRole
- `superadmin` - Platform admin (you)
- `event_coordinator` - Organizes events for an organization
- `auctioneer` - Controls live auctions
- `staff` - Event support (check-in, logistics)
- `bidder` - Donor/attendee

### EventStatus
- `draft` - Being set up
- `active` - Live/ongoing
- `closed` - Completed

### AuctionType
- `live` - Real-time auctioneer-led
- `silent` - Timed bidding, no auctioneer
- `padel_raise` - Straight donation, real-time auctioneer-led

### ItemStatus
- `draft` - Not visible to bidders
- `active` - Available for bidding
- `sold` - Auction closed, item won
- `unsold` - Auction closed, no bids or reserve not met

# Data Model: Donor Notifications

**Feature**: 035-donor-notifications
**Date**: 2026-03-12

## New Tables

### 1. `notifications`

Stores every notification instance created for a donor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | Unique notification ID |
| event_id | UUID | FK → events.id, NOT NULL, INDEX | Event this notification belongs to |
| user_id | UUID | FK → users.id, NOT NULL, INDEX | Target donor |
| notification_type | ENUM | NOT NULL | Type of notification (see enum below) |
| title | VARCHAR(200) | NOT NULL | Short notification title |
| body | TEXT | NOT NULL | Notification message body |
| priority | ENUM | NOT NULL, default NORMAL | LOW, NORMAL, HIGH, URGENT |
| data | JSONB | nullable | Structured metadata: { item_id, bid_amount, item_name, admin_name, deep_link, animation_type } |
| is_read | BOOLEAN | NOT NULL, default FALSE | Whether donor has read this notification |
| read_at | TIMESTAMP(tz) | nullable | When the notification was read |
| campaign_id | UUID | FK → notification_campaigns.id, nullable | Link to admin campaign (for custom notifications) |
| created_by | UUID | FK → users.id, nullable | Admin who triggered this (null for system-generated) |
| expires_at | TIMESTAMP(tz) | nullable, INDEX | Auto-cleanup date (event_end + 30 days) |
| created_at | TIMESTAMP(tz) | NOT NULL, default now() | Creation timestamp |

**Indexes**:
- `ix_notifications_user_event` on (user_id, event_id, created_at DESC) — primary query: list notifications for user+event
- `ix_notifications_user_unread` on (user_id, event_id) WHERE is_read = FALSE — badge count query
- `ix_notifications_expires` on (expires_at) WHERE expires_at IS NOT NULL — cleanup job

**Notification Type Enum** (`notification_type_enum`):
- `outbid` — Another donor placed a higher bid
- `auction_opened` — Silent auction is now open
- `auction_closing_soon` — Auction closes in X minutes
- `auction_closed` — Auction has ended
- `item_won` — Donor won an auction item
- `admin_bid_placed` — Admin placed bid on donor's behalf
- `paddle_raise` — Admin recorded paddle raise donation
- `checkout_reminder` — Outstanding balance reminder
- `bid_confirmation` — Bid was successfully placed
- `proxy_bid_triggered` — Proxy bid was auto-executed
- `welcome` — Event check-in welcome
- `custom` — Admin-composed custom message

**Priority Enum** (`notification_priority_enum`):
- `low` — Informational (bid confirmation, welcome)
- `normal` — Standard (auction opened, item won)
- `high` — Time-sensitive (outbid, auction closing soon)
- `urgent` — Action required (checkout reminder)

### 2. `notification_delivery_status`

Tracks delivery status per notification per channel.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique delivery record |
| notification_id | UUID | FK → notifications.id, NOT NULL, INDEX | Parent notification |
| channel | ENUM | NOT NULL | INAPP, PUSH, EMAIL, SMS |
| status | ENUM | NOT NULL, default PENDING | PENDING, SENT, DELIVERED, FAILED, SKIPPED |
| sent_at | TIMESTAMP(tz) | nullable | When delivery was attempted |
| failure_reason | TEXT | nullable | Error message if delivery failed |
| external_id | VARCHAR(255) | nullable | External provider message ID (Twilio SID, Azure message ID) |
| created_at | TIMESTAMP(tz) | NOT NULL, default now() | Record creation |

**Indexes**:
- `ix_delivery_notification` on (notification_id, channel) — unique together
- `ix_delivery_pending` on (status) WHERE status = 'PENDING' — retry failed deliveries

**Delivery Channel Enum** (`delivery_channel_enum`):
- `inapp` — In-app notification center
- `push` — Web Push notification
- `email` — Email delivery
- `sms` — SMS delivery

**Delivery Status Enum** (`delivery_status_enum`):
- `pending` — Queued for delivery
- `sent` — Sent to provider
- `delivered` — Confirmed delivered (provider callback)
- `failed` — Delivery failed
- `skipped` — Channel disabled by user preference or missing contact info

### 3. `notification_preferences`

Per-donor, per-channel, per-type opt-in/out settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique preference record |
| user_id | UUID | FK → users.id, NOT NULL | Donor |
| notification_type | ENUM | NOT NULL | Which notification type |
| channel | ENUM | NOT NULL | Which delivery channel |
| enabled | BOOLEAN | NOT NULL, default TRUE | Whether this type+channel is enabled |
| updated_at | TIMESTAMP(tz) | NOT NULL, default now() | Last updated |
| created_at | TIMESTAMP(tz) | NOT NULL, default now() | Record creation |

**Constraints**:
- UNIQUE (user_id, notification_type, channel) — one preference per user/type/channel combo

**Default preferences for new donors** (seeded on first access):
- In-app: always enabled (cannot be toggled off)
- Push: disabled until contextual opt-in prompt accepted
- Email: enabled by default
- SMS: disabled by default (opt-in required)

### 4. `push_subscriptions`

Stores Web Push API subscription objects per device.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique subscription ID |
| user_id | UUID | FK → users.id, NOT NULL, INDEX | Donor who subscribed |
| endpoint | TEXT | NOT NULL, UNIQUE | Push service endpoint URL |
| p256dh_key | TEXT | NOT NULL | Client public key (base64url) |
| auth_key | TEXT | NOT NULL | Auth secret (base64url) |
| platform | VARCHAR(20) | nullable | ios, android, desktop (detected from user agent) |
| is_active | BOOLEAN | NOT NULL, default TRUE | Whether subscription is valid |
| deactivated_at | TIMESTAMP(tz) | nullable | When subscription was deactivated |
| deactivation_reason | VARCHAR(100) | nullable | expired, permission_revoked, unsubscribed |
| user_agent | TEXT | nullable | Device user agent string |
| created_at | TIMESTAMP(tz) | NOT NULL, default now() | Subscription creation |

**Indexes**:
- `ix_push_sub_user_active` on (user_id) WHERE is_active = TRUE — get active subscriptions for push delivery

### 5. `notification_campaigns`

Admin-initiated custom notification campaigns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique campaign ID |
| event_id | UUID | FK → events.id, NOT NULL | Event scope |
| sender_id | UUID | FK → users.id, NOT NULL | Admin who composed it |
| message | TEXT | NOT NULL | Notification message (max 500 chars) |
| recipient_criteria | JSONB | NOT NULL | { type: "all_attendees" | "all_bidders" | "table" | "individual", table_number?: int, user_ids?: UUID[] } |
| channels | JSONB | NOT NULL | ["inapp", "push", "email", "sms"] |
| recipient_count | INTEGER | NOT NULL, default 0 | Total recipients targeted |
| delivered_count | INTEGER | NOT NULL, default 0 | Successfully delivered count |
| failed_count | INTEGER | NOT NULL, default 0 | Failed delivery count |
| status | ENUM | NOT NULL, default DRAFT | DRAFT, SENDING, SENT, FAILED |
| sent_at | TIMESTAMP(tz) | nullable | When campaign was dispatched |
| created_at | TIMESTAMP(tz) | NOT NULL, default now() | Campaign creation |

**Campaign Status Enum** (`campaign_status_enum`):
- `draft` — Composed but not sent
- `sending` — Currently being delivered
- `sent` — All deliveries attempted
- `failed` — Campaign delivery failed entirely

## State Transitions

### Notification Lifecycle

```
Created → [per-channel delivery] → Read → [expires_at reached] → Purged

Delivery per channel:
  PENDING → SENT → DELIVERED
  PENDING → SENT → FAILED (retry once)
  PENDING → SKIPPED (preference disabled or missing contact)
```

### Push Subscription Lifecycle

```
Created (is_active=TRUE)
  → Deactivated (is_active=FALSE, reason=expired) — 410 Gone from push endpoint
  → Deactivated (is_active=FALSE, reason=permission_revoked) — user revoked in OS
  → Deactivated (is_active=FALSE, reason=unsubscribed) — user opted out
  → Re-created — user reinstalls PWA and re-subscribes (new subscription row)
```

### Campaign Lifecycle

```
DRAFT → SENDING → SENT
DRAFT → SENDING → FAILED
```

## Relationships

```
User 1──→ N Notification (user_id)
User 1──→ N NotificationPreference (user_id)
User 1──→ N PushSubscription (user_id)
Event 1──→ N Notification (event_id)
Event 1──→ N NotificationCampaign (event_id)
Notification 1──→ N NotificationDeliveryStatus (notification_id)
NotificationCampaign 1──→ N Notification (campaign_id)
User 1──→ N NotificationCampaign (sender_id)
```

## Validation Rules

- `notifications.body`: max 2000 characters
- `notifications.title`: max 200 characters
- `notification_campaigns.message`: max 500 characters (per FR-008/US7)
- `push_subscriptions.endpoint`: must be valid URL
- `notification_preferences`: (user_id, notification_type, channel) must be unique
- `notification_delivery_status`: (notification_id, channel) must be unique
- SMS body: max 160 characters including link (per FR-016)
- `notifications.data.animation_type`: must be one of: confetti, flash, pulse, none

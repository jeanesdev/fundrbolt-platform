# Quickstart: Donor Notifications (035)

## Prerequisites

- Docker running (PostgreSQL, Redis)
- Backend running (`make dev-backend`)
- Donor PWA running (`cd frontend/donor-pwa && pnpm dev`)
- Admin PWA running (`cd frontend/fundrbolt-admin && pnpm dev`)

## New Infrastructure

### Celery Worker

A Celery worker is required for background notification delivery:

```bash
cd backend
poetry run celery -A app.celery_app worker --loglevel=info --concurrency=4
```

For development, run alongside the API server.

### Celery Beat (Scheduler)

Handles scheduled notifications (auction closing soon, checkout reminders, cleanup):

```bash
cd backend
poetry run celery -A app.celery_app beat --loglevel=info
```

### Socket.IO

Socket.IO is integrated into the FastAPI ASGI application — no separate process.
Redis is used as the Socket.IO adapter for pub/sub across workers.

## Environment Variables (New)

Add to `backend/.env`:

```env
# Web Push (VAPID)
VAPID_PRIVATE_KEY=<base64url-encoded ECDSA private key>
VAPID_PUBLIC_KEY=<base64url-encoded ECDSA public key>
VAPID_CLAIMS_EMAIL=mailto:admin@fundrbolt.com

# Twilio SMS
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_FROM_NUMBER=<your-twilio-phone-number>

# Celery
CELERY_BROKER_URL=redis://localhost:6379/2
CELERY_RESULT_BACKEND=redis://localhost:6379/3
```

### Generating VAPID Keys

```bash
cd backend
poetry run python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('Private:', v.private_pem())
print('Public:', v.public_key_urlsafe_base64())
"
```

## Database Migration

After pulling this branch:

```bash
cd backend
poetry run alembic upgrade head
```

New tables created:
- `notifications`
- `notification_delivery_status`
- `notification_preferences`
- `push_subscriptions`
- `notification_campaigns`

New enums:
- `notification_type_enum`
- `notification_priority_enum`
- `delivery_channel_enum`
- `delivery_status_enum`
- `campaign_status_enum`

## Testing Notifications

### Trigger an outbid notification

1. Register two donors for an event
2. Open the donor PWA as Donor A and place a bid on a silent auction item
3. Open the donor PWA as Donor B and place a higher bid on the same item
4. Donor A should receive:
   - In-app toast with flash animation
   - Notification bell badge increments
   - Notification appears in notification center
   - Push notification (if push is enabled)

### Test push notifications

1. In the donor PWA, accept the push notification prompt when it appears
2. Lock the phone/minimize the browser
3. From the admin PWA, send a custom notification to that donor
4. The device should display a native push notification

### Test spoof mode

1. Log in as a super admin in the donor PWA
2. Select a spoofed donor user
3. Notifications should show for the spoofed user, not the admin
4. Socket.IO room should be joined for the spoofed user ID

### Test admin custom notifications

1. In the admin PWA, navigate to an event → Notifications
2. Compose a message, select recipients (all attendees / table / individual)
3. Select channels (in-app, push, email, SMS)
4. Send the notification
5. Check the campaign status updates to "sent"
6. Verify recipients received the notification on selected channels

## Architecture Overview

```
Donor PWA
  ├── Socket.IO client ←──→ Socket.IO server (FastAPI ASGI)
  ├── Service Worker (push) ←── Web Push API ←── pywebpush
  └── Notification Center UI (Radix Sheet)

Backend
  ├── NotificationService (create, deliver, read)
  ├── PushService (subscribe, send via pywebpush)
  ├── SMSService (send via Twilio)
  ├── EmailService (existing, extended for notification templates)
  ├── Celery Worker (async delivery, scheduled tasks)
  └── Socket.IO (real-time notification:new events)

Admin PWA
  └── Notifications panel (compose, send, view campaigns)
```

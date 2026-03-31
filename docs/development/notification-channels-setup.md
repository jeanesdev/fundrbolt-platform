# Notification Channels Setup Guide

This guide covers setting up the three external notification channels: **Web Push (VAPID)**, **Email (Azure Communication Services)**, and **SMS (Twilio)**.

> **Current status of your dev environment:**
>
> | Channel | Status | Notes |
> |---------|--------|-------|
> | Web Push (VAPID) | ✅ Configured | Keys already in `.env` |
> | Email (ACS) | ✅ Configured | Connection string already in `.env` |
> | SMS (Twilio) | ❌ Not configured | Needs account + credentials |
>
> All three channels degrade gracefully — if credentials are missing, the backend logs a warning and skips delivery. Nothing crashes.

---

## Table of Contents

1. [Web Push Notifications (VAPID)](#1-web-push-notifications-vapid)
2. [Email (Azure Communication Services)](#2-email-azure-communication-services)
3. [SMS (Twilio)](#3-sms-twilio)
4. [Notification Preferences](#4-notification-preferences)
5. [Testing Notifications](#5-testing-notifications)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Web Push Notifications (VAPID)

Web push uses the VAPID (Voluntary Application Server Identification) protocol to send push notifications to browsers/PWAs via the Push API.

### How It Works

1. Donor PWA requests the VAPID public key from `GET /api/v1/notifications/push/vapid-key`
2. Browser creates a push subscription using `PushManager.subscribe()` with that key
3. Donor PWA sends the subscription to `POST /api/v1/notifications/push/subscribe`
4. Backend stores the subscription (endpoint URL + encryption keys) in `push_subscriptions` table
5. When a notification is created, the backend uses `pywebpush` to send it to all active subscriptions

### Environment Variables

```bash
# backend/.env

# PEM-encoded EC private key (include literal \n for newlines)
VAPID_PRIVATE_KEY=<your-pem-encoded-private-key-here>

# URL-safe base64-encoded public key (~87 chars, no padding)
VAPID_PUBLIC_KEY=BDQwGWmv...your-key...

# Contact email for push service operators (must start with mailto:)
VAPID_CLAIMS_EMAIL=mailto:admin@fundrbolt.com
```

### Generating New VAPID Keys

If you need to regenerate keys (e.g., for a new environment):

```bash
cd backend && poetry run python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('VAPID_PRIVATE_KEY (paste as single line with literal \\\\n):')
print(v.private_pem().decode().replace(chr(10), '\\\\n'))
print()
print('VAPID_PUBLIC_KEY:')
print(v.public_key)
"
```

Copy the output into your `backend/.env`. The private key must be on a single line with literal `\n` characters (not actual newlines).

> **Important**: If you regenerate keys, all existing push subscriptions become invalid. Users will need to re-subscribe (the donor PWA handles this automatically on next visit).

### Requirements

- `pywebpush` package — already in `pyproject.toml`
- Redis running (for Celery task delivery)
- Donor PWA must be served over HTTPS or localhost (Push API requirement)
- For iOS: the PWA must be installed to the home screen (Safari doesn't support push in-browser)

---

## 2. Email (Azure Communication Services)

Email notifications use Azure Communication Services (ACS) to send transactional emails.

### Environment Variables

```bash
# backend/.env

# ACS connection string (from Azure Portal)
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://your-resource.unitedstates.communication.azure.com/;accesskey=your-access-key

# Sender address (must be configured in ACS)
EMAIL_FROM_ADDRESS=DoNotReply@fundrbolt.com

# Display name for the sender
EMAIL_FROM_NAME=FundrBolt
```

### Setting Up ACS in Azure (if not already done)

#### Step 1: Create an Azure Communication Services Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource** → search for **Communication Services**
3. Click **Create**
4. Fill in:
   - **Subscription**: Your Azure subscription
   - **Resource group**: `fundrbolt-dev-rg` (or your resource group)
   - **Resource name**: `fundrbolt-dev-comm` (or similar)
   - **Data location**: United States (or your preferred region)
5. Click **Review + Create** → **Create**

#### Step 2: Get the Connection String

1. Open your Communication Services resource
2. Go to **Settings** → **Keys**
3. Copy the **Connection string** (either Primary or Secondary)
4. Paste into `backend/.env` as `AZURE_COMMUNICATION_CONNECTION_STRING`

#### Step 3: Set Up Email Domain

1. In your Communication Services resource, go to **Email** → **Domains**
2. Click **Add domain**
3. Choose **Custom domain** and enter `fundrbolt.com` (or your domain)
4. Azure will give you DNS records to add:

   | Record Type | Name | Value |
   |-------------|------|-------|
   | TXT | `_dmarc.fundrbolt.com` | `v=DMARC1; p=reject; ...` |
   | TXT | `fundrbolt.com` | `v=spf1 include:spf.protection.outlook.com ...` |
   | CNAME | `selector1-azurecomm-prod-net._domainkey.fundrbolt.com` | *(Azure provides this)* |
   | CNAME | `selector2-azurecomm-prod-net._domainkey.fundrbolt.com` | *(Azure provides this)* |

5. Add these DNS records to your domain registrar

6. Click **Verify** once DNS has propagated (can take up to 48 hours, usually 15-30 minutes)

#### Step 4: Add Sender Addresses

1. After domain verification, go to **Email** → **Domains** → click your domain
2. Under **MailFrom addresses**, click **Add**
3. Add `DoNotReply` with display name `FundrBolt`

   ```
   Username: DoNotReply
   Display Name: FundrBolt Platform
   ```

4. The full sender address will be `DoNotReply@fundrbolt.com`

#### Step 5: Link Email Domain to Communication Resource

1. Go back to your Communication Services resource
2. Go to **Email** → **Domains**
3. Click **Connect domain** and select the verified domain

### Mock Mode

If `AZURE_COMMUNICATION_CONNECTION_STRING` is not set (or set to `None`), the email service runs in **mock mode** — it logs the email content but doesn't actually send. This is useful for local development.

### Verifying Email Works

```bash
# Quick test from the backend
cd backend && poetry run python -c "
import asyncio
from app.services.email_service import EmailService
from app.core.config import settings

async def test():
    svc = EmailService()
    result = await svc.send_email(
        to_email='your-email@example.com',
        subject='FundrBolt Test',
        html_content='<h1>It works!</h1>'
    )
    print('Sent!' if result else 'Failed (check logs)')

asyncio.run(test())
"
```

See also: [docs/operations/email-configuration.md](../operations/email-configuration.md) for the full production email setup guide including SPF/DKIM/DMARC details.

---

## 3. SMS (Twilio)

SMS notifications use Twilio to send text messages. This is optional — most users will rely on push + email.

### Environment Variables

```bash
# backend/.env

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

### Setting Up Twilio

#### Step 1: Create a Twilio Account

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio) and sign up
2. Verify your email and phone number

#### Step 2: Get Your Credentials

1. From the [Twilio Console](https://console.twilio.com/) dashboard, copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (click to reveal)
2. Paste into `backend/.env`

#### Step 3: Get a Phone Number

1. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Search for a number with **SMS** capability in your desired area code
3. Purchase the number (trial accounts get a free number)
4. Copy the number (in `+1XXXXXXXXXX` format) into `TWILIO_FROM_NUMBER`

#### Trial Account Limitations

With a free Twilio trial:
- You can only send to **verified phone numbers** (numbers you've confirmed in the console)
- Messages are prefixed with "Sent from your Twilio trial account"
- You get ~$15 of trial credit

To verify a number for testing:
1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the phone number and verify via SMS or call

#### Upgrading to Production

When ready for real SMS delivery:
1. Upgrade your Twilio account (add billing)
2. Register for A2P 10DLC (required for US SMS):
   - Go to **Messaging** → **Compliance** → **Trust Hub**
   - Complete business registration
   - Register a messaging campaign (e.g., "Event notifications")
3. This process takes 1-2 weeks for approval

### SMS Message Format

The backend truncates SMS to 160 characters. Notification messages are formatted as:
```
[FundrBolt] {notification title}: {notification body (truncated)}
```

---

## 4. Notification Preferences

Users must **explicitly opt in** to each delivery channel. By default, only **in-app** notifications are enabled.

- The first time a user visits their notification preferences (`Settings → Alerts`), default preferences are seeded with all channels disabled except in-app.
- Users toggle push/email/SMS on per notification type (e.g., bid updates, event announcements).
- Admin campaigns can use `override_channels` to bypass user preferences for urgent communications.

**To test all channels**: After configuring the services above, go to `Settings → Alerts` in the donor PWA and enable Push, Email, and/or SMS for each notification type.

---

## 5. Testing Notifications

### From the Admin PWA

1. Log into the Admin PWA at `http://localhost:5173`
2. Navigate to an event → **Notifications** tab
3. Click **Send Custom Notification**
4. Fill in title/body, select audience, and send
5. Check the donor PWA for the notification

### What to Expect Per Channel

| Channel | Where It Appears |
|---------|-----------------|
| **In-App** | Bell icon badge + notification panel in donor PWA. Always works. |
| **Toast** | Pop-up toast in donor PWA (requires active Socket.IO connection to Redis). |
| **Push** | OS-level notification (requires VAPID keys + user subscribed + PWA installed on iOS). |
| **Email** | Branded HTML email to user's email address (requires ACS configured). |
| **SMS** | Text message to user's phone (requires Twilio configured + user has phone number). |

### Checking Delivery Status

Notification delivery status is tracked per channel in the `notification_delivery_statuses` table:
- `PENDING` — queued but not yet attempted
- `SENT` — successfully handed off to the delivery provider
- `FAILED` — delivery attempt failed
- `DELIVERED` — confirmed delivered (where supported)

---

## 6. Troubleshooting

### Push notifications don't arrive

1. **Check VAPID keys**: `grep VAPID backend/.env` — both private and public keys must be set
2. **Check subscription**: In donor PWA, go to `Settings → Alerts` and toggle push on. If you see "Push notifications are not configured", the VAPID public key isn't reaching the frontend.
3. **iOS requires home screen install**: Push API is not available in Safari browser — the PWA must be added to the home screen
4. **Browser permission**: Check that notification permission is "granted" (not "denied") in browser settings
5. **Check backend logs**: Look for `VAPID keys not configured` or `No active push subscriptions`

### Emails don't send

1. **Mock mode**: If `AZURE_COMMUNICATION_CONNECTION_STRING` is unset, emails are logged only
2. **Sender domain**: The `EMAIL_FROM_ADDRESS` domain must be verified in ACS
3. **Check backend logs**: Look for `EmailService` log entries or ACS error codes
4. **DNS propagation**: After adding DNS records, domain verification can take up to 48 hours

### SMS doesn't send

1. **Missing package**: Run `cd backend && poetry run python -c "import twilio; print('OK')"` — if it fails, run `poetry install`
2. **Trial restrictions**: Twilio trial accounts can only send to verified numbers
3. **Missing phone number**: The user's account must have a phone number set
4. **Check backend logs**: Look for `Twilio credentials not configured` or `twilio` import errors

### Toasts don't appear

1. **Socket.IO connection**: Toasts require a live WebSocket connection. Check browser devtools Network → WS tab for an active `socket.io` connection.
2. **Redis running**: Socket.IO uses Redis as the pub/sub backend for cross-process messaging. Verify Redis is running: `redis-cli ping`
3. **Notification panel open**: Toasts are suppressed when the notification panel (bell icon sheet) is already open.

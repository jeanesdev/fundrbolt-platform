# Research: Donor Notifications

**Feature**: 035-donor-notifications
**Date**: 2026-03-12
**Status**: Complete

## 1. Real-Time Delivery: Socket.IO with FastAPI

**Decision**: Use python-socketio (async mode) mounted on the existing FastAPI ASGI app, with socket.io-client on the frontend.

**Rationale**: The constitution mandates Socket.IO for bidirectional WebSocket with auto-reconnect, rooms per event, and fallback to long-polling. python-socketio integrates cleanly with FastAPI's ASGI server (Uvicorn) by mounting it as an ASGI sub-application. Redis is used as the Socket.IO message queue for horizontal scaling.

**Alternatives considered**:
- **Server-Sent Events (SSE)**: Simpler, unidirectional, but constitution specifies Socket.IO. SSE lacks room-based routing and auto-reconnect built-in.
- **Raw WebSockets (websockets library)**: Lower-level, requires implementing reconnection, room management, and message serialization manually. Socket.IO handles all of this.
- **Aggressive polling with React Query**: Already in use for data fetching. Acceptable fallback for non-critical notifications but insufficient for the 5-second outbid delivery target.

**Implementation pattern**:
- Mount `socketio.ASGIApp` alongside FastAPI app in main.py
- Authenticate Socket.IO connections using the existing JWT token (passed as query param on connect)
- Join user to event-specific rooms on connect: `room=event:{event_id}:user:{user_id}`
- Emit notification events from backend services via `sio.emit()` after creating notification records
- Redis adapter (`socketio.AsyncRedisManager`) for multi-process pub/sub

## 2. Push Notifications: Web Push API with VAPID

**Decision**: Use pywebpush (Python) for server-side push delivery with VAPID (Voluntary Application Server Identification) keys.

**Rationale**: Web Push is the W3C standard for push notifications in PWAs. VAPID keys authenticate the application server without requiring a third-party push service account. Supported on Chrome (Android/Desktop), Safari (iOS 16.4+ for installed PWAs), Firefox, and Edge.

**Alternatives considered**:
- **Firebase Cloud Messaging (FCM)**: Adds a Google dependency. VAPID is vendor-neutral and sufficient for PWA push.
- **OneSignal/Pusher**: Third-party SaaS adds cost and dependency. VAPID is free and self-hosted.

**Implementation pattern**:
- Generate VAPID key pair (public/private) and store in Azure Key Vault
- Frontend: Use `navigator.serviceWorker.ready` → `registration.pushManager.subscribe()` with VAPID public key
- Store subscription object (endpoint, keys.p256dh, keys.auth) in `push_subscriptions` table
- Backend: Use pywebpush to send push payloads to stored subscription endpoints
- Service worker: Listen for `push` event, display `self.registration.showNotification()` with title, body, icon, data (deep link URL)
- Service worker: Listen for `notificationclick` event, navigate to deep link URL via `clients.openWindow()`
- Handle expired/invalid subscriptions: catch 410 Gone responses, mark subscription inactive

**iOS PWA considerations**:
- Requires iOS 16.4+ with PWA installed to Home Screen (standalone mode)
- Push permission must be requested via user gesture (button tap, not page load)
- The existing vite-plugin-pwa config already uses `display: "standalone"` which is required

## 3. SMS Delivery: Twilio

**Decision**: Use Twilio Programmable Messaging for SMS notification delivery.

**Rationale**: Constitution specifies Twilio for SMS (outbid alerts, event reminders). Twilio provides reliable delivery, delivery status callbacks, phone number verification, and compliance tools (opt-out management).

**Alternatives considered**:
- **Azure Communication Services SMS**: Could unify with email, but ACS SMS is less mature and has limited global coverage compared to Twilio.
- **Amazon SNS**: Adds an AWS dependency to an Azure-first infrastructure.

**Implementation pattern**:
- Install `twilio` Python SDK
- Store Twilio Account SID, Auth Token, and sending number in Azure Key Vault
- Create `SmsService` class with `send_sms(to_number, message)` method
- Enforce 160-character limit for messages (truncate with ellipsis + link if needed)
- Use Celery task for async delivery (non-blocking to bid flow)
- Handle delivery failures: log, mark notification channel status as failed, retry once
- Phone number verification: reuse existing user phone field, add verification flow if not already verified

## 4. Background Task Processing: Celery with Redis

**Decision**: Add Celery with Redis as message broker for asynchronous notification delivery and scheduled tasks.

**Rationale**: Constitution specifies Celery with Redis broker for background jobs (email, reports, data exports). Notification delivery (email, SMS, push) must not block the synchronous bid placement flow. Scheduled notifications (auction closing warnings, checkout reminders) require a task scheduler.

**Alternatives considered**:
- **FastAPI BackgroundTasks**: Already used for simple tasks. Insufficient for scheduled execution, retry logic, and distributed processing.
- **Dramatiq**: Similar to Celery but less ecosystem support. Celery is the constitution's choice.
- **APScheduler**: Good for scheduling but lacks distributed task queue features.

**Implementation pattern**:
- Add `celery[redis]` to pyproject.toml
- Create `backend/app/celery_app.py` with Celery configuration using Redis broker
- Define tasks in `backend/app/tasks/notification_tasks.py`:
  - `send_push_notification.delay(notification_id)` — deliver push to all active subscriptions
  - `send_email_notification.delay(notification_id)` — render email template and send via Azure Communication Services
  - `send_sms_notification.delay(notification_id)` — send SMS via Twilio
  - `schedule_auction_closing_warnings.delay(event_id)` — schedule closing-soon notifications at configured intervals
  - `send_checkout_reminders.delay(event_id)` — send reminders to donors with outstanding balances
- Use Celery Beat for periodic tasks (check for upcoming auction closings, retry failed deliveries)
- Docker Compose: add celery worker and celery beat services

## 5. Notification Deduplication for Proxy Bids

**Decision**: Apply a 5-second settling window for outbid notifications during proxy bid wars.

**Rationale**: Proxy bidding can trigger rapid bid escalations (up to 20 iterations per the existing service). Sending a notification for each intermediate outbid would flood the donor. A settling period ensures only the final outbid status is notified.

**Alternatives considered**:
- **Immediate notification for every outbid**: Simple but creates notification fatigue during proxy bid wars.
- **Batch into single notification**: Complex batching logic. The settling window achieves the same effect more simply.

**Implementation pattern**:
- When an outbid event occurs, schedule a Celery task with `countdown=5` (5-second delay)
- Before delivering, check if the donor is still outbid (their bid status is still OUTBID). If they've since been restored as winning (via proxy counter-bid), skip the notification
- This naturally deduplicates: only the final state after the proxy bid war is notified

## 6. In-App Animations: Canvas Confetti & CSS

**Decision**: Use `canvas-confetti` library for winning celebrations and CSS keyframe animations for outbid flash effects.

**Rationale**: `canvas-confetti` is a lightweight (~5KB gzip), dependency-free library that renders confetti on an HTML canvas overlay. No heavy animation framework needed. CSS animations handle the simpler flash/pulse effects.

**Alternatives considered**:
- **Lottie (lottie-react)**: Rich animation support but overkill for confetti. Adds ~50KB+ bundle weight.
- **react-spring / framer-motion**: Full animation libraries. Too heavy for two simple animation types.
- **CSS-only confetti**: Possible but less visually impressive and harder to configure.

**Implementation pattern**:
- Install `canvas-confetti` in donor-pwa
- Trigger `confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })` when winning notification appears
- For outbid flash: CSS `@keyframes outbid-flash` with amber background pulse on toast element
- Wrap all animations in `prefers-reduced-motion` media query check: skip if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`

## 7. Notification Center UI Pattern

**Decision**: Slide-out panel (drawer) anchored to the right side of the screen, triggered by bell icon in the event header.

**Rationale**: A slide-out panel keeps the donor on the current page (no navigation away from auction). It overlays content rather than replacing it, allowing quick review and dismissal. This is the standard pattern used by most mobile apps (Instagram, Twitter, etc.).

**Alternatives considered**:
- **Full page route (/notifications)**: Disrupts the event experience by navigating away from the auction tab.
- **Dropdown popover**: Too small for a list of notifications with timestamps and CTAs.
- **Bottom sheet**: Good for mobile but awkward on desktop. The panel works on both.

**Implementation pattern**:
- Use Radix UI `Sheet` component (already in donor-pwa dependencies) for the slide-out panel
- Trigger from `NotificationBell` component placed in EventHomePage header alongside EventSwitcher and ProfileDropdown
- Panel content: scrollable list of `NotificationItem` components
- "Mark all as read" action in panel header
- Tap notification → close panel → navigate to deep link

## 8. Service Worker Push Handler

**Decision**: Extend the vite-plugin-pwa generated service worker with a custom push event handler via `injectManifest` strategy or a custom service worker source file.

**Rationale**: The current vite-plugin-pwa config uses `generateSW` which auto-generates the service worker. To handle push events, we need custom service worker code. Switching to `injectManifest` allows us to write a custom `sw.ts` that imports Workbox precaching while also handling push events.

**Alternatives considered**:
- **Keep generateSW + separate push-handler.js**: Possible but fragile — two service workers can conflict.
- **Abandon vite-plugin-pwa**: Loses Workbox caching benefits. Not recommended.

**Implementation pattern**:
- Switch vite.config.ts VitePWA from `generateSW` to `injectManifest` strategy
- Create `frontend/donor-pwa/src/sw.ts` with:
  - `import { precacheAndRoute } from 'workbox-precaching'` — preserves existing caching
  - `self.addEventListener('push', ...)` — parse push payload, show notification
  - `self.addEventListener('notificationclick', ...)` — handle tap → open/focus app at deep link URL
- Workbox InjectManifest plugin auto-injects the precache manifest into the custom SW file

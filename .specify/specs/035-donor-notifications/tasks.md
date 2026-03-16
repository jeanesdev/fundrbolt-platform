# Tasks: Donor Notifications

**Input**: Design documents from `/specs/035-donor-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notifications-api.yaml, quickstart.md

**Tests**: Not explicitly requested. Test tasks are omitted. Tests may be added during implementation as needed.

**Organization**: Tasks grouped by user story for independent implementation and testing. 14 user stories across P1-P3 priorities.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies, create project skeleton, configure new infrastructure (Celery, Socket.IO).

- [ ] T001 Install backend dependencies: `cd backend && poetry add python-socketio[asyncio] pywebpush "celery[redis]" twilio`
- [ ] T002 Install donor PWA frontend dependencies: `cd frontend/donor-pwa && pnpm add socket.io-client canvas-confetti && pnpm add -D @types/canvas-confetti`
- [ ] T003 Create Celery app configuration in `backend/app/celery_app.py` -- configure broker URL (Redis DB 2), result backend (Redis DB 3), task autodiscovery from `app.tasks`, serializer settings, and task routes
- [ ] T004 Add Celery worker and Celery Beat services to `docker-compose.yml` -- worker with `--concurrency=4`, beat with `--loglevel=info`, both depend on Redis service
- [ ] T005 [P] Add VAPID and Twilio environment variables to `backend/.env.example` -- VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, CELERY_BROKER_URL, CELERY_RESULT_BACKEND
- [ ] T006 [P] Create notification settings in `backend/app/core/config.py` (or existing settings file) -- add VapidSettings, TwilioSettings, CelerySettings pydantic config classes with env var bindings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database models, enums, migration, core service, Socket.IO server mount, and Pydantic schemas. ALL user stories depend on these.

**CRITICAL**: No user story work can begin until this phase is complete.

### Database Layer

- [ ] T007 Create notification enums and Notification model in `backend/app/models/notification.py` -- define `NotificationTypeEnum` (12 values: outbid, auction_opened, auction_closing_soon, auction_closed, item_won, admin_bid_placed, paddle_raise, checkout_reminder, bid_confirmation, proxy_bid_triggered, welcome, custom), `NotificationPriorityEnum` (4 values), `DeliveryChannelEnum` (4 values), `DeliveryStatusEnum` (5 values), `CampaignStatusEnum` (4 values) as SQLAlchemy/PostgreSQL enums. Create `Notification` SQLAlchemy model with all columns from data-model.md. Add composite indexes: `ix_notifications_user_event` on (user_id, event_id, created_at DESC), partial index `ix_notifications_user_unread` WHERE is_read=FALSE, partial index `ix_notifications_expires` WHERE expires_at IS NOT NULL.
- [ ] T008 [P] Create NotificationDeliveryStatus model in `backend/app/models/notification_delivery_status.py` -- columns: id, notification_id (FK), channel (DeliveryChannelEnum), status (DeliveryStatusEnum default PENDING), sent_at, failure_reason, external_id, created_at. Unique constraint on (notification_id, channel). Partial index on status WHERE status='PENDING'.
- [ ] T009 [P] Create NotificationPreference model in `backend/app/models/notification_preference.py` -- columns: id, user_id (FK), notification_type, channel, enabled (default TRUE), updated_at, created_at. Unique constraint on (user_id, notification_type, channel).
- [ ] T010 [P] Create PushSubscription model in `backend/app/models/push_subscription.py` -- columns: id, user_id (FK), endpoint (UNIQUE), p256dh_key, auth_key, platform (nullable), is_active (default TRUE), deactivated_at, deactivation_reason, user_agent, created_at. Partial index on user_id WHERE is_active=TRUE.
- [ ] T011 [P] Create NotificationCampaign model in `backend/app/models/notification_campaign.py` -- columns: id, event_id (FK), sender_id (FK), message (TEXT), recipient_criteria (JSONB), channels (JSONB), recipient_count, delivered_count, failed_count, status (CampaignStatusEnum default DRAFT), sent_at, created_at.
- [ ] T012 Register all new models in `backend/app/models/__init__.py` and create Alembic migration via `poetry run alembic revision --autogenerate -m "add notification tables"` -- verify migration creates 5 tables, 5 enums, all indexes and FKs. Test with `poetry run alembic upgrade head`.

### Pydantic Schemas

- [ ] T013 [P] Create notification Pydantic schemas in `backend/app/schemas/notification.py` -- NotificationResponse, NotificationListResponse (notifications array, next_cursor, unread_count), UnreadCountResponse, MarkAllReadRequest (event_id), MarkAllReadResponse (updated_count).
- [ ] T014 [P] Create notification preference Pydantic schemas in `backend/app/schemas/notification_preference.py` -- NotificationPreferenceResponse, NotificationPreferenceListResponse, NotificationPreferenceUpdate, BulkPreferenceUpdateRequest, BulkPreferenceUpdateResponse.
- [ ] T015 [P] Create notification campaign Pydantic schemas in `backend/app/schemas/notification_campaign.py` -- RecipientCriteria (type enum, table_number, user_ids), SendCustomNotificationRequest (message max 500, recipient_criteria, channels), NotificationCampaignResponse (with sender), CampaignListResponse.
- [ ] T016 [P] Create push subscription Pydantic schemas in `backend/app/schemas/push_subscription.py` -- PushSubscribeRequest (endpoint, keys.p256dh, keys.auth, platform), PushUnsubscribeRequest (endpoint), VapidPublicKeyResponse (public_key).

### Core Service and WebSocket

- [ ] T017 Create core NotificationService in `backend/app/services/notification_service.py` -- create_notification() creates record + delivery status rows per enabled channel (checks preferences) + emits via Socket.IO + dispatches Celery tasks for push/email/SMS. list_notifications() with cursor pagination. get_unread_count(). mark_read(). mark_all_read(). Set expires_at = event end + 30 days.
- [ ] T018 Mount Socket.IO server on FastAPI ASGI app -- create `backend/app/websocket/notification_ws.py` with AsyncServer, JWT auth on connect (token query param), room management (notification:join_event, notification:leave_event), emit helper emit_notification(). Use AsyncRedisManager for pub/sub. Mount in `backend/app/main.py` as ASGI sub-app.

**Checkpoint**: Foundation ready -- all models, migration applied, core service, Socket.IO accepting connections.

---

## Phase 3: User Story 1 -- In-App Notification Center (Priority: P1) MVP

**Goal**: Donors see a bell icon with unread badge on all event pages. Tapping opens a slide-out notification center listing notifications for the current event. Mark read, mark all read, tap to navigate.

**Independent Test**: Create test notifications via API/DB seed. Verify bell on all tabs, badge count, panel open/close, tap navigates to deep link.

### Backend

- [ ] T019 [US1] Create donor notification API endpoints in `backend/app/api/v1/notifications.py` -- GET /api/v1/notifications (list with event_id, limit, cursor, unread_only), GET /api/v1/notifications/unread-count (event_id), POST /api/v1/notifications/{notification_id}/read, POST /api/v1/notifications/read-all (event_id in body). All require JWT auth. Wire into router.

### Frontend -- API and State

- [ ] T020 [P] [US1] Create notification API client in `frontend/donor-pwa/src/services/notification-service.ts` -- listNotifications(eventId, options), getUnreadCount(eventId), markRead(notificationId), markAllRead(eventId). Use existing axios instance (X-Spoof-User-Id handled automatically).
- [ ] T021 [P] [US1] Create notification Zustand store in `frontend/donor-pwa/src/stores/notification-store.ts` -- state: unreadCount, isOpen, notifications[]. Actions: setUnreadCount, incrementUnreadCount, openPanel, closePanel, addNotification, markAsRead, markAllAsRead. Define Notification TypeScript type matching API schema.
- [ ] T022 [US1] Create React Query hooks in `frontend/donor-pwa/src/hooks/use-notifications.ts` -- useNotifications(eventId) with cursor pagination, useUnreadCount(eventId) with 30s refetch fallback, useMarkRead() mutation, useMarkAllRead() mutation. Invalidate caches on mutations.

### Frontend -- UI Components

- [ ] T023 [P] [US1] Create NotificationItem component in `frontend/donor-pwa/src/components/notifications/NotificationItem.tsx` -- icon per type, title, body (2-line truncated), relative timestamp, unread dot. On tap: mark read, close panel, navigate to data.deep_link.
- [ ] T024 [P] [US1] Create EmptyNotifications component in `frontend/donor-pwa/src/components/notifications/EmptyNotifications.tsx` -- bell icon illustration, "No notifications yet -- you're all caught up!" message.
- [ ] T025 [US1] Create NotificationCenter component in `frontend/donor-pwa/src/components/notifications/NotificationCenter.tsx` -- Radix Sheet anchored right. Header: "Notifications" title + "Mark all as read" button. Scrollable NotificationItem list. EmptyNotifications when empty. Infinite scroll pagination.
- [ ] T026 [US1] Create NotificationBell component in `frontend/donor-pwa/src/components/notifications/NotificationBell.tsx` -- Lucide Bell icon with badge (count up to 9, "9+" above). Hidden badge when 0. On tap: toggle panel via Zustand store. Uses useUnreadCount(eventId).
- [ ] T027 [US1] Integrate NotificationBell into EventHomePage header in `frontend/donor-pwa/src/features/events/EventHomePage.tsx` -- place in header alongside EventSwitcher and ProfileDropdown. Renders on all 3 tabs. Render NotificationCenter (Sheet) at page level. ALL hooks before early returns.

### Frontend -- Socket.IO Client (Basic)

- [ ] T028 [US1] Create Socket.IO connection hook in `frontend/donor-pwa/src/hooks/use-notification-socket.ts` -- connect with JWT token as query param. On connect: emit notification:join_event(event_id). Listen notification:new: add to store, increment unread, invalidate queries. Listen notification:count: update unread. Handle disconnect/reconnect. Respect spoof user ID. Cleanup on unmount.
- [ ] T029 [US1] Integrate Socket.IO hook into EventHomePage in `frontend/donor-pwa/src/features/events/EventHomePage.tsx` -- call useNotificationSocket(eventId). Hook must be before early returns.

**Checkpoint**: Notification center fully functional. Bell with badge on all tabs. Slide-out panel. Real-time updates via Socket.IO. Mark read works. Deep link navigation works. This is the MVP.

---

## Phase 4: User Story 2 -- Outbid Notification (Priority: P1)

**Goal**: Outbid donors receive immediate notification with toast, item details, bid amount, and deep link. 5-second settling window for proxy bid wars.

**Independent Test**: Two donors bid on same item. Higher bid triggers outbid notification for lower bidder within 5 seconds.

- [ ] T030 [US2] Hook outbid notification trigger into `backend/app/services/auction_bid_service.py` -- in _outbid_previous() (around line 157), create notification: type=OUTBID, priority=HIGH, title="You've been outbid!", body with item_name and amount, data with item_id, deep_link, animation_type="flash". For proxy bid wars, use Celery task with countdown=5 -- re-check outbid status before delivering.
- [ ] T031 [P] [US2] Create NotificationToast component in `frontend/donor-pwa/src/components/notifications/NotificationToast.tsx` -- use Sonner for toasts. Style per notification type: outbid=amber/warning, winning=success, default=neutral. Title, truncated body, tap navigates to deep_link. Auto-dismiss after 5 seconds. Skip toast if notification center is open.
- [ ] T032 [US2] Integrate toast into Socket.IO handler in `frontend/donor-pwa/src/hooks/use-notification-socket.ts` -- on notification:new, show NotificationToast. Skip if notification center isOpen (Zustand).

**Checkpoint**: Outbid notifications in real-time with toast. Proxy bid deduplication. Deep link to auction item.

---

## Phase 5: User Story 3 -- Auction Lifecycle Notifications (Priority: P1)

**Goal**: Notifications at auction milestones: open, closing soon (15/5/1 min warnings), closed (win/loss per donor).

**Independent Test**: Set auction open/close times. Verify notifications at each milestone with correct content.

- [ ] T033 [US3] Create notification scheduler in `backend/app/services/notification_scheduler.py` -- schedule_auction_warnings(event_id): read close time, schedule Celery tasks at 15/5/1 min intervals. reschedule_auction_warnings(event_id): revoke and reschedule. send_auction_opened_notification(event_id): notify all registered donors. send_auction_closing_soon_notification(event_id, minutes): notify donors with active bids or watchlist, include bid count.
- [ ] T034 [US3] Create Celery tasks for auction lifecycle in `backend/app/tasks/notification_tasks.py` -- send_auction_opened_task(event_id), send_auction_closing_soon_task(event_id, minutes), send_auction_closed_task(event_id). Closed task: determine winners/losers, winners get "Congratulations! You won N items" with animation_type="confetti", non-winners get "Thank you for participating".
- [ ] T035 [US3] Hook auction lifecycle triggers into event/auction services -- auction OPEN: call send_auction_opened. Auction scheduled: call schedule_auction_warnings. Close time changed: call reschedule_auction_warnings. Auction CLOSED: dispatch send_auction_closed_task.

**Checkpoint**: Auction lifecycle notifications end-to-end. Open, closing soon, close with personalized results.

---

## Phase 6: User Story 4 -- Push Notifications (Priority: P1)

**Goal**: Native push via Web Push API + VAPID. Service worker handles push display and click-to-navigate. Contextual opt-in prompt.

**Independent Test**: Install PWA, accept push prompt, send notification, verify native push appears. Tap opens deep link.

### Backend

- [ ] T036 [US4] Create PushNotificationService in `backend/app/services/push_notification_service.py` -- subscribe(), unsubscribe(), send_push(notification_id): load notification, fetch active subscriptions, send via pywebpush with VAPID, handle 410 Gone (deactivate sub), handle errors (log + mark failed). Payload: JSON with title, body, icon, badge, data.deep_link, data.notification_id.
- [ ] T037 [P] [US4] Create push subscription API endpoints in `backend/app/api/v1/push_subscriptions.py` -- POST /api/v1/notifications/push/subscribe, POST /api/v1/notifications/push/unsubscribe, GET /api/v1/notifications/push/vapid-key (public, no auth). Wire into router.
- [ ] T038 [P] [US4] Create Celery task for push delivery in `backend/app/tasks/notification_tasks.py` -- send_push_notification_task(notification_id). Update NotificationService.create_notification() to dispatch this task when push channel is enabled.

### Frontend -- Service Worker

- [ ] T039 [US4] Switch vite-plugin-pwa to injectManifest in `frontend/donor-pwa/vite.config.ts` -- change strategy to injectManifest, set swSrc: 'src/sw.ts', swDest: 'sw.js'. Keep Workbox precache manifest injection.
- [ ] T040 [US4] Create custom service worker in `frontend/donor-pwa/src/sw.ts` -- import precacheAndRoute from workbox-precaching, call precacheAndRoute(self.__WB_MANIFEST). Add push event listener: parse JSON, showNotification(title, { body, icon, badge, data }). Add notificationclick listener: close notification, openWindow(data.deep_link) or focus existing client.

### Frontend -- Push Opt-In

- [ ] T041 [US4] Create push management hook in `frontend/donor-pwa/src/hooks/use-push-notifications.ts` -- usePushNotifications() returns { isSupported, isSubscribed, subscribe, unsubscribe }. Check PushManager support. Subscribe: request permission, pushManager.subscribe with VAPID key from /vapid-key endpoint, POST to backend. Unsubscribe: call subscription.unsubscribe(), POST to backend.
- [ ] T042 [US4] Create PushOptInPrompt component in `frontend/donor-pwa/src/components/notifications/PushOptInPrompt.tsx` -- inline card/banner (not modal). "Stay in the loop! Enable notifications for outbid alerts." Enable + Not Now buttons. Dismiss stores in localStorage. Only show if supported, not subscribed, not dismissed.
- [ ] T043 [US4] Integrate PushOptInPrompt into EventHomePage in `frontend/donor-pwa/src/features/events/EventHomePage.tsx` -- show after first bid or check-in. Track trigger in state. Suppress if not supported, already subscribed, or dismissed.
- [ ] T044 [US4] Suppress duplicate push in foreground -- in use-notification-socket.ts, when app is in foreground and notification:new arrives, do not send push (service worker handles background only).

**Checkpoint**: Push working on iOS 16.4+ and Android. Contextual opt-in. Service worker shows native notifications. Tap opens deep link.

---

## Phase 7: User Story 14 -- Real-Time Delivery Polish (Priority: P2)

**Goal**: Robust reconnection, missed notification sync, multi-device badge sync. Sub-5-second delivery SLA.

**Independent Test**: Disconnect network, trigger notifications, reconnect -- missed notifications appear. Mark read on one device, verify sync on other.

- [ ] T045 [US14] Enhance Socket.IO reconnection in `frontend/donor-pwa/src/hooks/use-notification-socket.ts` -- on reconnect: re-join event room, invalidate React Query cache, update unread count. Config: reconnection=true, reconnectionDelay=1000, reconnectionAttempts=Infinity. Add connection state to Zustand (connected/disconnected/reconnecting).
- [ ] T046 [US14] Server-side missed notification sync in `backend/app/websocket/notification_ws.py` -- on notification:join_event, accept optional last_seen_at timestamp. If provided, emit notifications created after that time (max 50) as notification:new events.
- [ ] T047 [US14] Emit notification:count after read operations in `backend/app/api/v1/notifications.py` -- after mark_read and mark_all_read, emit notification:count to user's room with updated unread count for cross-device sync.

**Checkpoint**: Resilient real-time delivery. Auto-reconnect syncs missed notifications. Badge syncs across devices.

---

## Phase 8: User Story 5 -- Admin-Placed Bid / Paddle Raise (Priority: P2)

**Goal**: Donors notified when admin places bid or records donation on their behalf, with admin attribution.

**Independent Test**: Admin places bid on behalf of Donor A. Donor A receives notification with item, amount, and admin name.

- [ ] T048 [US5] Hook admin bid notification into bid service -- after admin-on-behalf bid, create notification: type=ADMIN_BID_PLACED, body="A bid of {amount} was placed on your behalf for {item} by {admin}.", data with item_id, bid_amount, admin_name, deep_link.
- [ ] T049 [US5] Hook paddle raise notification into donation service -- after recording paddle raise, create notification: type=PADDLE_RAISE, body="A {amount} donation was recorded on your behalf by {admin}.", data with amount, admin_name, donation_label.

**Checkpoint**: Admin bid and paddle raise notifications delivered with admin attribution.

---

## Phase 9: User Story 6 -- Checkout Reminder (Priority: P2)

**Goal**: Donors with outstanding balances receive checkout reminders with follow-ups. Stop after payment.

**Independent Test**: Donor with $750 balance. Trigger checkout phase. Verify reminder. Wait interval. Verify follow-up. Complete checkout. Verify no more reminders.

- [ ] T050 [US6] Create checkout reminder Celery task in `backend/app/tasks/notification_tasks.py` -- send_checkout_reminders_task(event_id): query donors with balances, create CHECKOUT_REMINDER notifications with priority=URGENT, body with item count and total, data with deep_link to checkout.
- [ ] T051 [US6] Implement follow-up reminder logic in `backend/app/services/notification_scheduler.py` -- schedule_checkout_reminders(event_id, initial_delay, followup_interval): schedule initial Celery task, periodic follow-up checking if paid (skip) or not (resend, max 3).
- [ ] T052 [US6] Hook reminders into event lifecycle -- admin triggers checkout phase: dispatch schedule_checkout_reminders(). Donor completes payment: cancel pending reminder tasks.

**Checkpoint**: Checkout reminders with follow-ups. Auto-suppress after payment.

---

## Phase 10: User Story 7 -- Admin Custom Notifications (Priority: P2)

**Goal**: Admins compose and send custom notifications to specific donors or groups. All admin roles can send.

**Independent Test**: Admin composes message, selects 3 donors, sends. Verify all 3 receive notification.

### Backend

- [ ] T053 [US7] Create admin notification API in `backend/app/api/v1/admin_notifications.py` -- POST /api/v1/admin/events/{event_id}/notifications (validate criteria, resolve recipients, create campaign, dispatch delivery task), GET /api/v1/admin/events/{event_id}/notifications (list campaigns paginated). Require any admin role. Wire into router.
- [ ] T054 [US7] Create campaign delivery Celery task in `backend/app/tasks/notification_tasks.py` -- deliver_campaign_task(campaign_id): load campaign, resolve recipients from criteria (all_attendees/all_bidders/table/individual), create Notification per recipient with type=CUSTOM and campaign_id, dispatch channel tasks, update campaign status and counts.

### Frontend (Admin PWA)

- [ ] T055 [P] [US7] Create RecipientSelector in `frontend/fundrbolt-admin/src/features/events/notifications/RecipientSelector.tsx` -- radio for type (All Attendees/All Bidders/Specific Table/Individual). Table dropdown or donor multi-select. Recipient count preview.
- [ ] T056 [P] [US7] Create ComposeNotification in `frontend/fundrbolt-admin/src/features/events/notifications/ComposeNotification.tsx` -- textarea (max 500 chars with counter), RecipientSelector, channel checkboxes (In-app always on, Push/Email/SMS toggleable), preview, Send button.
- [ ] T057 [P] [US7] Create NotificationHistory in `frontend/fundrbolt-admin/src/features/events/notifications/NotificationHistory.tsx` -- paginated table: message, criteria, channel badges, delivery stats, sender, timestamp.
- [ ] T058 [US7] Create admin notifications route in `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/notifications.tsx` -- ComposeNotification + NotificationHistory layout. Add "Notifications" to event nav.

**Checkpoint**: Admins compose, target, and send custom notifications. Campaign history tracked.

---

## Phase 11: User Story 8 -- Notification Preferences (Priority: P2)

**Goal**: Donors manage per-type, per-channel preferences from settings. In-app always on. SMS requires verified phone.

**Independent Test**: Disable email for outbid. Get outbid. Verify in-app notification but no email.

### Backend

- [ ] T059 [US8] Create preferences API in `backend/app/api/v1/notification_preferences.py` -- GET /api/v1/notifications/preferences (return current, seed defaults on first access), PUT /api/v1/notifications/preferences (bulk update, validate in-app not disabled, SMS requires phone). Wire into router.
- [ ] T060 [US8] Integrate preferences into delivery in `backend/app/services/notification_service.py` -- in create_notification(), check preferences per channel before creating delivery status rows. Disabled channel = status SKIPPED. Default seeding: in-app=on, push=off until subscribed, email=on, SMS=off.

### Frontend (Donor PWA)

- [ ] T061 [US8] Create preferences settings page in `frontend/donor-pwa/src/routes/_authenticated/settings/notifications.tsx` -- grid with notification types as rows, channels as columns. Toggle switches. In-app always checked/disabled. SMS warns if no phone. Push shows status. Load GET, save PUT on toggle. Add link to settings nav.

**Checkpoint**: Donors customize notifications per channel. Preferences enforced server-side.

---

## Phase 12: User Story 9 -- Animations (Priority: P3)

**Goal**: Confetti for winning, amber flash for outbid, success pulse for bid confirmation. Respect prefers-reduced-motion.

**Independent Test**: Win item -> confetti. Get outbid -> flash. Enable reduced-motion -> no animations.

- [ ] T062 [US9] Create ConfettiAnimation in `frontend/donor-pwa/src/components/notifications/ConfettiAnimation.tsx` -- trigger canvas-confetti { particleCount: 100, spread: 70, origin: { y: 0.6 } }. Auto-cleanup 2s. Check prefers-reduced-motion, render nothing if true.
- [ ] T063 [US9] Add CSS keyframes for outbid flash and bid confirmation pulse -- outbid-flash: amber background pulse 1s. bid-confirmed-pulse: green border pulse 0.5s.
- [ ] T064 [US9] Integrate animations into NotificationToast in `frontend/donor-pwa/src/components/notifications/NotificationToast.tsx` -- check data.animation_type: "confetti" -> ConfettiAnimation overlay; "flash" -> outbid-flash class; "pulse" -> bid-confirmed-pulse class. Vibrate on critical (outbid, winning): navigator.vibrate(200) if not reduced-motion.

**Checkpoint**: Confetti on win, flash on outbid, pulse on bid confirm. Reduced-motion suppresses all.

---

## Phase 13: User Story 10 -- Spoof User (Priority: P3)

**Goal**: Super admin sees spoofed donor's notifications. No push to admin device. Socket.IO room follows spoof.

**Independent Test**: Spoof Donor A, trigger outbid for A. Notification appears in admin's center (as A). No push to admin.

- [ ] T065 [US10] Spoof-aware notification API in `backend/app/api/v1/notifications.py` -- read X-Spoof-User-Id header. If present and requester is super_admin, use spoofed user_id for all queries.
- [ ] T066 [US10] Spoof-aware Socket.IO rooms in `backend/app/websocket/notification_ws.py` -- on join_event with spoof context, join spoofed user's room. On spoof change, leave old room, join new.
- [ ] T067 [US10] Suppress push for spoof in `backend/app/services/push_notification_service.py` -- if notification triggered in spoof context, skip push delivery. In-app via Socket.IO still works.
- [ ] T068 [US10] Handle spoof changes in `frontend/donor-pwa/src/hooks/use-notification-socket.ts` -- subscribe to spoof store changes. On change: leave room, re-join with new user ID, invalidate notification queries.

**Checkpoint**: Spoof user notifications complete. Admin sees spoofed user's notifications. No push to admin.

---

## Phase 14: User Story 11 -- Check-In Welcome (Priority: P3)

**Goal**: Welcome notification on check-in with event details, table assignment, and push opt-in CTA.

**Independent Test**: Check in donor. Verify welcome notification with event name, table, and schedule.

- [ ] T069 [US11] Hook welcome notification into `backend/app/services/checkin_service.py` -- after check_in_registration() or check_in_guest(), create notification: type=WELCOME, priority=LOW, title="Welcome to {event}!", body with table number and schedule highlights, data with table_number, push_enabled flag.
- [ ] T070 [US11] Trigger PushOptInPrompt from welcome notification -- in NotificationItem or toast handler, if type=WELCOME and data.push_enabled=false, show push opt-in prompt.

**Checkpoint**: Welcome notifications on check-in with personalized details.

---

## Phase 15: User Story 12 -- Email and SMS Delivery (Priority: P3)

**Goal**: Email (branded HTML) and SMS (under 160 chars) for high-value notification types.

**Independent Test**: Opt into email + SMS. Get outbid. Verify branded email and SMS under 160 chars.

- [ ] T071 [US12] Create SmsService in `backend/app/services/sms_service.py` -- send_sms(to_number, message): Twilio client, 160-char limit, handle errors, include unsubscribe for TCPA.
- [ ] T072 [P] [US12] Create email notification templates -- extend email_service.py with templates for: outbid (item, amount, "Bid Again" CTA), winning (item list, "Checkout" CTA), checkout reminder (balance, "Complete Checkout" CTA), custom message (event branding). Use Fundrbolt branding.
- [ ] T073 [P] [US12] Create Celery tasks for email/SMS in `backend/app/tasks/notification_tasks.py` -- send_email_notification_task(notification_id): render template, send via email_service. send_sms_notification_task(notification_id): compose body under 160 chars, send via SmsService. Both update delivery_status.
- [ ] T074 [US12] Wire email/SMS into notification creation in `backend/app/services/notification_service.py` -- when email/SMS channels enabled per preferences, dispatch Celery tasks. Only for: outbid, item_won, checkout_reminder, custom, admin_bid_placed, paddle_raise. Skip: auction_opened, closing_soon, bid_confirmation, welcome by default.

**Checkpoint**: Email and SMS delivery for high-value notifications. Branded emails. SMS under 160 chars.

---

## Phase 16: User Story 13 -- Bid Confirmation (Priority: P3)

**Goal**: Confirmation notification after placing a bid (direct or proxy). Reassurance and bid history.

**Independent Test**: Place bid. Verify confirmation notification in center with item and amount.

- [ ] T075 [US13] Hook bid confirmation into `backend/app/services/auction_bid_service.py` -- after successful direct bid, create notification: type=BID_CONFIRMATION, priority=LOW, title="You're the high bidder!", body with item and amount, data with animation_type="pulse".
- [ ] T076 [US13] Hook proxy bid triggered notification -- after proxy bid auto-executes, create notification: type=PROXY_BID_TRIGGERED, priority=LOW, title="Proxy bid triggered", body with item and new amount.

**Checkpoint**: Bid confirmations and proxy triggers create notifications. Low priority, in-app only by default.

---

## Phase 17: Polish and Cross-Cutting Concerns

**Purpose**: Cleanup, expired notification purge, error hardening, documentation.

- [ ] T077 Create cleanup Celery Beat task in `backend/app/tasks/notification_tasks.py` -- purge_expired_notifications: daily task, delete where expires_at < now() and associated delivery_status. Log purge count.
- [ ] T078 Add error handling and retry logic to all Celery tasks -- wrap delivery in try/except, log with notification_id + channel, update delivery_status to FAILED with reason. max_retries=1, retry_backoff=True on push/email/SMS tasks.
- [ ] T079 [P] Add Notifications nav item to admin PWA event navigation -- "Notifications" link with Bell icon for all admin roles.
- [ ] T080 [P] Update OpenAPI documentation -- add notification endpoints with tags, examples, and response schemas.
- [ ] T081 [P] Update docker-compose.yml with Celery health checks -- celery inspect ping for worker, process check for beat.
- [ ] T082 Run quickstart.md validation -- follow all steps in quickstart.md, verify end-to-end setup, fix discrepancies.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 -- BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 -- MVP milestone
- **US2 (Phase 4)**: Depends on US1 (needs notification center + toast)
- **US3 (Phase 5)**: Depends on US1 (needs notification center for display)
- **US4 (Phase 6)**: Depends on Phase 2 (push is independent channel)
- **US14 (Phase 7)**: Depends on US1 (enhances Socket.IO from US1)
- **US5 (Phase 8)**: Depends on Phase 2 only
- **US6 (Phase 9)**: Depends on Phase 2 only
- **US7 (Phase 10)**: Depends on Phase 2 only (admin PWA, independent)
- **US8 (Phase 11)**: Depends on Phase 2 only
- **US9 (Phase 12)**: Depends on US2 (toast component must exist)
- **US10 (Phase 13)**: Depends on US1 + US14 (spoof-aware Socket.IO)
- **US11 (Phase 14)**: Depends on Phase 2 only
- **US12 (Phase 15)**: Depends on Phase 2 only
- **US13 (Phase 16)**: Depends on Phase 2 only
- **Polish (Phase 17)**: Depends on all desired stories complete

### Parallel Opportunities

**After Phase 2 completes**, these can run in parallel:
- US1 + US4 + US5 + US6 + US7 + US8 + US11 + US12 + US13

**After US1 completes**:
- US2 + US3 + US14

**After US2 completes**:
- US9

**After US1 + US14 complete**:
- US10

---

## Parallel Example: Phase 2 (Foundational)

```
# Model files in parallel (different files):
T007: notification.py      T008: notification_delivery_status.py
T009: notification_preference.py  T010: push_subscription.py
T011: notification_campaign.py

# Schema files in parallel:
T013: schemas/notification.py     T014: schemas/notification_preference.py
T015: schemas/notification_campaign.py  T016: schemas/push_subscription.py
```

## Parallel Example: After Phase 2 -- Multiple Stories

```
# Developer A: US1 (Notification Center MVP)  T019-T029
# Developer B: US7 (Admin Custom Notifications) T053-T058
# Developer C: US4 (Push Notifications)        T036-T044
# Developer D: US12 (Email and SMS)             T071-T074
```

---

## Implementation Strategy

### MVP First (Phase 1 -> Phase 2 -> US1)

1. Complete Phase 1: Install dependencies, configure Celery
2. Complete Phase 2: All models, migration, core service, Socket.IO
3. Complete Phase 3 (US1): Notification center, bell, real-time Socket.IO
4. **STOP AND VALIDATE**: Create test notifications, verify bell/badge/panel/deep-links
5. Working notification infrastructure with no triggers -- triggers added in US2+

### Core Notification Loop (Add US2 -> US3)

6. Complete Phase 4 (US2): Outbid notifications (most revenue-impactful)
7. Complete Phase 5 (US3): Auction lifecycle (keep donors engaged)
8. **STOP AND VALIDATE**: Full auction flow with notifications end-to-end

### Push Channel (Add US4 -> US14)

9. Complete Phase 6 (US4): Native push notifications
10. Complete Phase 7 (US14): Real-time resilience
11. **STOP AND VALIDATE**: Push on iOS + Android, resilient delivery

### Admin and Preferences (US5-US8)

12. Complete Phases 8-11 in any order
13. **STOP AND VALIDATE**: Admin sends custom notifications, donors configure preferences

### Enhancement Layer (US9-US13)

14. Complete Phases 12-16: Animations, spoof, welcome, email/SMS, bid confirmation
15. Complete Phase 17: Polish and cleanup
16. **FINAL VALIDATION**: Full quickstart.md walkthrough

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to user story for traceability
- Each user story independently completable and testable after Phase 2
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
- Total: 82 tasks across 17 phases (14 user stories + setup + foundational + polish)

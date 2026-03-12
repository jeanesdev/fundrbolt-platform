# Implementation Plan: Donor Notifications

**Branch**: `035-donor-notifications` | **Date**: 2026-03-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-donor-notifications/spec.md`

## Summary

Add a comprehensive donor notification system to the Fundrbolt platform. Donors receive real-time in-app notifications via a persistent notification center (bell icon with badge), native push notifications on iOS/Android via the Web Push API, and optional email/SMS delivery. Notifications are triggered by auction events (outbid, auction open/close, winning), admin actions (paddle raise, custom messages), and event lifecycle (check-in welcome, checkout reminders). Real-time delivery uses Socket.IO (per constitution) with Redis pub/sub. Animations (confetti, flash) enhance the in-app experience. Admins can compose and send custom notifications from the admin PWA. Spoof user support is included for debugging.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.9 (Frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, python-socketio, pywebpush, celery[redis], twilio
- Frontend (Donor PWA): React 19, Vite 7, TanStack Router, Zustand 5, React Query 5, Sonner 2, socket.io-client, canvas-confetti
- Frontend (Admin PWA): React 19, Vite 7, TanStack Router, Zustand 5, React Query 5
- Shared: @fundrbolt/shared (PWA hooks, service worker utilities)
**Storage**: Azure Database for PostgreSQL (notification data, preferences, push subscriptions, campaigns), Azure Cache for Redis (pub/sub for real-time, notification count cache, Celery broker)
**Testing**: Backend: pytest (unit + integration). Frontend: Vitest (unit), Playwright (E2E)
**Target Platform**: Web PWA (iOS Safari 16.4+, Android Chrome, Desktop browsers)
**Project Type**: Web application (monorepo with backend + two frontends)
**Performance Goals**: Outbid notification delivery <5 seconds (in-app), <60 seconds (email/SMS). Notification center load <2 seconds. 500 concurrent donors per event.
**Constraints**: Offline-capable (queue and deliver on reconnect). Respect prefers-reduced-motion. SMS under 160 chars. TCPA/CAN-SPAM compliance.
**Scale/Scope**: 500 concurrent donors per event, 50 simultaneous events, ~10 notification types, multi-channel delivery (in-app, push, email, SMS)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Donor-Driven Engagement | ✅ Pass | Notifications are entirely donor-focused: outbid re-engagement, celebratory winning animations, contextual push opt-in |
| 2. Real-Time Reliability | ✅ Pass | Socket.IO for <500ms propagation. Auto-reconnect with state sync. Redis pub/sub for scaling |
| 3. Production-Grade Quality | ✅ Pass | Full test coverage planned. Audit logging for all notifications. Graceful degradation on channel failure |
| 4. Solo Developer Efficiency | ✅ Pass | Using managed services (Azure, Twilio), existing patterns (SQLAlchemy models, FastAPI services), and AI-assisted generation |
| 5. Data Security and Privacy | ✅ Pass | Notification preferences are per-donor consent. SMS requires verified phone. Push subscription credentials encrypted. Full content on lock screen (per clarification) |
| 6. Minimalist Development (YAGNI) | ✅ Pass | Building only what spec requires. Additional recommendations deferred to future stories. No anticipatory features |
| Stack: Socket.IO | ✅ Aligned | Constitution specifies Socket.IO for real-time |
| Stack: Twilio SMS | ✅ Aligned | Constitution specifies Twilio for SMS notifications |
| Stack: Azure Comm Services | ✅ Aligned | Constitution specifies Azure Communication Services for email |
| Stack: Celery + Redis | ✅ Aligned | Constitution specifies Celery with Redis broker for background jobs |
| Immutable: API backward compat | ✅ Pass | New endpoints only, no breaking changes to existing APIs |
| Immutable: Alembic migrations | ✅ Pass | All schema changes via Alembic migration files |
| Immutable: Audit logging | ✅ Pass | All notifications logged with sender, recipients, channels, delivery status |

## Project Structure

### Documentation (this feature)

```
specs/035-donor-notifications/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
│   └── notifications-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   ├── notification.py           # Notification, NotificationType enum
│   │   ├── notification_preference.py # NotificationPreference model
│   │   ├── push_subscription.py      # PushSubscription model
│   │   └── notification_campaign.py  # NotificationCampaign model
│   ├── services/
│   │   ├── notification_service.py   # Core notification creation & delivery orchestration
│   │   ├── push_notification_service.py  # Web Push API integration (pywebpush)
│   │   ├── sms_service.py            # Twilio SMS integration
│   │   └── notification_scheduler.py # Scheduled notification logic (auction close warnings)
│   ├── api/v1/
│   │   ├── notifications.py          # Donor notification endpoints (list, read, mark-read)
│   │   ├── notification_preferences.py # Donor preference endpoints
│   │   ├── push_subscriptions.py     # Push subscription management endpoints
│   │   └── admin_notifications.py    # Admin custom notification endpoints
│   ├── schemas/
│   │   ├── notification.py           # Pydantic schemas for notification API
│   │   └── notification_preference.py # Pydantic schemas for preferences
│   ├── tasks/
│   │   └── notification_tasks.py     # Celery tasks (email, SMS, push delivery, scheduled)
│   └── websocket/
│       └── notification_ws.py        # Socket.IO event handlers for notification rooms
├── alembic/versions/
│   └── xxxx_add_notification_tables.py  # Migration for new tables
└── tests/
    ├── unit/
    │   ├── test_notification_service.py
    │   ├── test_push_notification_service.py
    │   └── test_sms_service.py
    └── integration/
        ├── test_notification_api.py
        └── test_notification_delivery.py

frontend/donor-pwa/
├── src/
│   ├── components/
│   │   └── notifications/
│   │       ├── NotificationBell.tsx       # Bell icon with badge (header)
│   │       ├── NotificationCenter.tsx     # Slide-out notification panel
│   │       ├── NotificationItem.tsx       # Single notification row
│   │       ├── NotificationToast.tsx      # In-app toast with animations
│   │       ├── ConfettiAnimation.tsx      # Confetti burst for winning
│   │       ├── PushOptInPrompt.tsx        # Contextual push permission prompt
│   │       └── EmptyNotifications.tsx     # Empty state
│   ├── stores/
│   │   └── notification-store.ts         # Zustand store for notification state
│   ├── services/
│   │   └── notification-service.ts       # API client for notification endpoints
│   ├── hooks/
│   │   ├── use-notifications.ts          # React Query hooks for notifications
│   │   ├── use-notification-socket.ts    # Socket.IO connection hook
│   │   └── use-push-notifications.ts     # Push subscription management hook
│   └── routes/_authenticated/
│       └── settings/
│           └── notifications.tsx         # Notification preferences page
└── tests/
    └── notifications/
        ├── NotificationBell.test.tsx
        └── notification-store.test.ts

frontend/fundrbolt-admin/
├── src/
│   ├── features/
│   │   └── events/
│   │       └── notifications/
│   │           ├── ComposeNotification.tsx   # Compose custom notification form
│   │           ├── RecipientSelector.tsx      # Select donors/groups/tables
│   │           └── NotificationHistory.tsx   # Sent notification log
│   └── routes/_authenticated/
│       └── events/$eventId/
│           └── notifications.tsx             # Admin notification page route
└── tests/
    └── notifications/
        └── ComposeNotification.test.tsx
```

**Structure Decision**: Web application pattern (Option 2). New notification code follows existing directory conventions: models in `backend/app/models/`, services in `backend/app/services/`, API routes in `backend/app/api/v1/`, frontend components in feature-specific directories. New `websocket/` directory added for Socket.IO handlers.

## Complexity Tracking

*No constitution violations — no entries required.*

## Post-Design Constitution Re-Check

*Phase 1 complete. Re-evaluating constitution compliance against data model, API contracts, and quickstart.*

| Principle | Status | Verification |
|-----------|--------|-------------|
| Socket.IO for real-time | ✅ | Socket.IO events defined (notification:new, notification:count). Rooms per user+event. |
| Twilio for SMS | ✅ | SMS delivery channel in contracts. Twilio env vars in quickstart. sms_service.py in project structure. |
| Azure Comm Services for email | ✅ | Extends existing email_service.py. No new email provider introduced. |
| Celery + Redis for async | ✅ | Celery worker/beat processes in quickstart. notification_tasks.py in project structure. |
| Alembic for migrations | ✅ | 5 new tables + 5 enums via Alembic migration. |
| API backward compatibility | ✅ | All new endpoints. No modifications to existing API routes. |
| Audit logging | ✅ | notification_delivery_status tracks every delivery attempt. campaign model tracks send counts. |
| YAGNI | ✅ | No speculative features. Data model matches spec 1:1. No unused fields. |
| Donor-centric | ✅ | All notification types serve donor engagement. Preferences give full control. |

**Result**: No constitution violations detected post-design. All mandatory technology choices used correctly.

## Completion Report

**Branch**: `035-donor-notifications`
**Spec path**: `.specify/specs/035-donor-notifications/`

### Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Feature Spec | `spec.md` | 14 user stories, 25 FRs, 10 success criteria, 5 clarification decisions |
| Requirements Checklist | `checklists/requirements.md` | All items passing |
| Research | `research.md` | 8 technology decisions with rationale |
| Data Model | `data-model.md` | 5 tables, 5 enums, state transitions, validation rules |
| API Contracts | `contracts/notifications-api.yaml` | OpenAPI 3.1 spec with 10 REST endpoints + Socket.IO events |
| Quickstart | `quickstart.md` | Dev setup, new infra (Celery), env vars, testing guide |
| Implementation Plan | `plan.md` | Technical context, constitution check, project structure |

### New Dependencies (to be added during implementation)

**Backend (Poetry)**:
- `python-socketio[asyncio]` — Socket.IO async server
- `pywebpush` — Web Push API with VAPID
- `celery[redis]` — Background task queue
- `twilio` — SMS delivery

**Frontend Donor PWA (pnpm)**:
- `socket.io-client` — Socket.IO browser client
- `canvas-confetti` — Winning celebration animation

### Ready for Next Phase

Run `speckit.tasks` to generate the task breakdown for implementation.

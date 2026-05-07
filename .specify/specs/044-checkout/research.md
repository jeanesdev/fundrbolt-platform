# Research: 044-checkout — Donor Event Checkout

**Date**: 2026-05-05 | **Branch**: `044-checkout`

---

## 1. PDF Generation in Python — WeasyPrint vs ReportLab

### Decision: WeasyPrint

**Rationale**: WeasyPrint renders HTML+CSS templates to PDF, which is ideal here because:
- Receipt layout is event-branded (logo, colours, itemised table) — HTML/CSS is far easier to maintain than programmatic PDF layout
- The existing codebase uses Jinja2 templates for email bodies; reusing the same template engine is consistent
- WeasyPrint integrates cleanly with async FastAPI: run via `asyncio.get_event_loop().run_in_executor(None, weasyprint_sync_fn)` or via Celery task
- Output quality is print-ready (CSS paged media, `@page` rules)

**Alternatives considered**:
- **ReportLab**: Powerful but requires programmatic layout (lines, coordinates, tables built in Python code). Good for forms and barcodes, not ideal for branded HTML receipts. No Jinja2 reuse.
- **fpdf2**: Lightweight but limited CSS support; can't embed event logo from URL without manual HTTP fetch
- **xhtml2pdf**: Similar to WeasyPrint but less actively maintained; fewer CSS 3 features

**Integration approach**:
```python
import weasyprint
from jinja2 import Environment, FileSystemLoader

async def generate_receipt_pdf(session: CheckoutSession) -> bytes:
    loop = asyncio.get_event_loop()
    html = render_template("receipt.html", session=session)
    return await loop.run_in_executor(None, lambda: weasyprint.HTML(string=html).write_pdf())
```

**Dependencies**: `weasyprint>=61.0` (add to `pyproject.toml`). WeasyPrint requires system packages `libpango`, `libcairo`, `libgdk-pixbuf` — already available in the Docker base image (Debian/Ubuntu).

---

## 2. SwipeToConfirm Component — Custom vs Library

### Decision: Custom implementation reusing `BidConfirmSlide` pattern

**Rationale**: The codebase already has a working swipe-to-confirm pattern in `frontend/donor-pwa/src/components/auction/BidConfirmSlide.tsx` (Radix `Slider` with `opacity-0` overlay). This uses Radix UI's `Slider` primitive which handles all touch/mouse events, accessibility (ARIA), and keyboard fallback. Building `SwipeToConfirm` as a standalone component that wraps this same pattern is the minimal-viable approach.

**Double-swipe implementation**:
- Step 1 (`SwipeToConfirm stage="first"`): Swipe completes → reveal Step 2 with new prompt text ("Confirm payment")
- Step 2 (`SwipeToConfirm stage="second"`): Swipe completes → fires `onConfirm()` callback
- State managed locally in parent `EventCheckoutPage` with `confirmStage: 'idle' | 'first' | 'second' | 'submitted'`

**Alternatives considered**:
- `react-swipe-button` npm package: 2.4 kB but unmaintained (last release 2020), no TypeScript types, no Radix/Tailwind integration
- `react-swipeable`: Touch event library; still requires building the visual component; adds dependency without value since Radix Slider already handles gestures
- Extending `BidConfirmSlide` directly: Rejected — BidConfirmSlide is tightly coupled to bid context (bidAmount, isMaxBid, AlertDialog wrapper); better to extract the slider core into a reusable `SwipeToConfirm` primitive

**Component API**:
```tsx
<SwipeToConfirm
  label="Slide to confirm"  // or "Slide to confirm payment"
  onComplete={() => void}
  disabled={boolean}
  completed={boolean}
/>
```

---

## 3. Cash/Check/DAF UX Pattern

### Decision: Inline method switcher with conditional fee removal and booth instructions card

**Rationale**: The existing checkout page already has a `PaymentMethodSelector` (card-only). The simplest enhancement is:
1. Extend the selector to 4 options: Card | Cash | Check | DAF (rendered as radio group with icons)
2. When Cash/Check/DAF is active: hide processing fee line item + checkbox; show `BoothInstructionsCard` with NPO payee name
3. When Card is active: show fee checkbox + `CardSelector` (existing component)

This avoids a separate page/flow and keeps all checkout on one scrollable screen — matching the donor-friendly principle.

**NPO payee name**: Sourced from the existing `CheckoutConfiguration.cash_instructions` field which stores a free-text instructions block including payee name. Admin sets this when configuring checkout for the event.

**DAF handling**: Same UI as Cash/Check (remove fee, show booth instructions). DAF-specific instructions note: "Funds must be directed from your Donor Advised Fund account to [NPO name]."

---

## 4. Celery Scheduled Task for Auto-Open Checkout

### Decision: Mirror the `send_ros_notification_task` pattern in `backend/app/tasks/run_of_show_tasks.py`

**Pattern reference**: `run_of_show_tasks.py` uses:
- `@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)`
- `_run_async()` helper to bridge sync Celery → async SQLAlchemy
- `celery_app.apply_async(eta=scheduled_datetime)` for future scheduling
- `task_id` stored on the model (`celery_task_id`) so it can be revoked if admin changes schedule

**New task** (`backend/app/tasks/checkout_tasks.py`):
```python
@celery_app.task(bind=True, name="app.tasks.checkout_tasks.auto_open_checkout_task", max_retries=2)
def auto_open_checkout_task(self, checkout_configuration_id: str) -> None:
    _run_async(_open_checkout_async(checkout_configuration_id))
```

**Schedule/cancel flow**:
1. Admin sets `scheduled_open_at` → `CheckoutConfigurationService.schedule_open()` calls `auto_open_checkout_task.apply_async(eta=dt, args=[config_id])`, stores `celery_task_id` on `checkout_configurations` row
2. Admin changes/cancels schedule → service calls `celery_app.control.revoke(task_id)`, clears `celery_task_id`, sets new `apply_async` if rescheduling

---

## 5. Real-Time Update Polling Pattern

### Decision: 10-second `refetchInterval` via TanStack Query — matching existing RunOfShow pattern

**Pattern reference**: `RunOfShowTimelineCard.tsx` uses `useQuery({ refetchInterval: 30_000 })` for background refresh. For checkout item updates (SC-005: within 10 s), we use a 10 s interval.

**Admin-modified detection**: The `checkout_sessions` table has an `items_updated_at` timestamp column. The donor page compares the locally-held `items_updated_at` value against the freshly-fetched session. When they diverge:
1. Disable swipe-to-confirm
2. Show `CheckoutUpdateBanner` ("Your items were updated by the organizer...")
3. Donor scrolls past or taps "Got it" → banner dismissed, swipe re-enabled

**Implementation**:
```typescript
const { data: session } = useQuery({
  queryKey: ['checkout-session', eventId],
  queryFn: () => getCheckoutSession(eventId),
  refetchInterval: 10_000,
})

useEffect(() => {
  if (session?.items_updated_at && session.items_updated_at !== acknowledgedAt) {
    setShowUpdateBanner(true)
    setSwipeDisabled(true)
  }
}, [session?.items_updated_at])
```

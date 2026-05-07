"""Admin payments router — full implementation (T045, T049, T052-T056).

Endpoints:
  GET    /admin/payments/checkout/status          — event checkout open/closed (T045)
  PATCH  /admin/payments/checkout/status          — open/close donor checkout (T045)
  GET    /admin/payments/donors                   — donor balance list (T049)
  POST   /admin/payments/charge                   — admin force-charge (T049)
  GET    /admin/payments/transactions             — transaction list for event (T054)
  POST   /admin/payments/{transaction_id}/void    — void captured transaction (T053)
  POST   /admin/payments/{transaction_id}/refund  — partial or full refund (T053)

  Feature 044 — Admin Event Checkout (router_checkout, prefix /admin/events):
  POST   /admin/events/{event_id}/checkout/open                               — open checkout
  POST   /admin/events/{event_id}/checkout/close                              — close checkout
  POST   /admin/events/{event_id}/checkout/schedule                           — schedule auto-open
  DELETE /admin/events/{event_id}/checkout/schedule                           — cancel schedule
  GET    /admin/events/{event_id}/checkout/configuration                      — get config
  PATCH  /admin/events/{event_id}/checkout/configuration                      — update config
  GET    /admin/events/{event_id}/checkout/donors                             — list donor status
  GET    /admin/events/{event_id}/checkout/donors/{user_id}/session           — donor session
  POST   /admin/events/{event_id}/checkout/donors/{user_id}/items             — add item
  PATCH  /admin/events/{event_id}/checkout/donors/{user_id}/items/{item_id}  — reprice item
  DELETE /admin/events/{event_id}/checkout/donors/{user_id}/items/{item_id}  — remove item
  POST   /admin/events/{event_id}/checkout/notifications/send-link            — send link
  POST   /admin/events/{event_id}/checkout/notifications/send-reminder        — send reminder
  GET    /admin/events/{event_id}/checkout/donors/{user_id}/receipt           — redirect to PDF
  POST   /admin/events/{event_id}/checkout/donors/{user_id}/receipt/resend   — resend receipt

  Feature 044 — Super-Admin Fee Config (router_fee_config, prefix /admin):
  GET    /admin/processing-fee-config             — current rate
  POST   /admin/processing-fee-config             — set new rate
  GET    /admin/processing-fee-config/history     — paginated history
"""

from __future__ import annotations

import io
import re
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.payment_deps import get_payment_gateway
from app.middleware.auth import get_current_active_user, require_role
from app.models.checkout_session import CheckoutSession
from app.models.event import Event
from app.models.payment_transaction import PaymentTransaction
from app.models.user import User
from app.schemas.checkout import (
    AdminAddCheckoutItemRequest,
    AdminCheckoutSessionResponse,
    AdminRepriceItemRequest,
    CheckoutConfigurationResponse,
    DonorCheckoutCountsResponse,
    DonorCheckoutStatusEntry,
    DonorCheckoutStatusListResponse,
    ProcessingFeeConfigResponse,
    ScheduleCheckoutOpenRequest,
    SendCheckoutNotificationRequest,
    UpdateCheckoutConfigurationRequest,
)
from app.schemas.payment import (
    AdminChargeRequest,
    AdminChargeResponse,
    PaymentProfileCreate,
    PaymentProfileRead,
    PaymentSessionRequest,
    PaymentSessionResponse,
    RefundRequest,
    RefundResponse,
    VoidRequest,
)
from app.services.checkout_configuration_service import CheckoutConfigurationService
from app.services.checkout_notification_service import CheckoutNotificationService
from app.services.checkout_receipt_service import CheckoutReceiptService
from app.services.checkout_service import CheckoutService
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_profile_service import PaymentProfileService, profile_to_read
from app.services.payment_transaction_service import PaymentTransactionService
from app.services.processing_fee_config_service import ProcessingFeeConfigService

router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])
router_checkout = APIRouter(prefix="/admin/events", tags=["admin-checkout"])
router_fee_config = APIRouter(prefix="/admin", tags=["admin-fee-config"])

# ── Typed dependency aliases ──────────────────────────────────────────────────

CurrentUser = Annotated[User, Depends(get_current_active_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
Gateway = Annotated[PaymentGatewayPort, Depends(get_payment_gateway)]


# ── Response schemas ──────────────────────────────────────────────────────────


class CheckoutStatusResponse(BaseModel):
    event_id: uuid.UUID
    checkout_open: bool


class CheckoutStatusUpdate(BaseModel):
    checkout_open: bool


class DonorBalanceSummary(BaseModel):
    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    total_balance: Decimal
    has_payment_profile: bool
    payment_profile_id: uuid.UUID | None = None


class DonorListResponse(BaseModel):
    event_id: uuid.UUID
    donors: list[DonorBalanceSummary]
    total_outstanding: Decimal


class TransactionListItem(BaseModel):
    transaction_id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    user_name: str
    status: str
    transaction_type: str
    amount: Decimal
    gateway_transaction_id: str | None
    created_at: str


class TransactionListResponse(BaseModel):
    event_id: uuid.UUID
    transactions: list[TransactionListItem]
    total: int


class VoidResponse(BaseModel):
    transaction_id: uuid.UUID
    parent_transaction_id: uuid.UUID
    status: str


# ── Checkout status (T045) ────────────────────────────────────────────────────


@router.get("/checkout/status", response_model=CheckoutStatusResponse)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def get_checkout_status(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutStatusResponse:
    """Return whether self-checkout is currently open for an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return CheckoutStatusResponse(
        event_id=event.id,
        checkout_open=event.checkout_open,
    )


@router.patch("/checkout/status", response_model=CheckoutStatusResponse)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def update_checkout_status(
    body: CheckoutStatusUpdate,
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutStatusResponse:
    """Open or close the donor self-checkout window for an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    event.checkout_open = body.checkout_open
    await db.commit()
    await db.refresh(event)
    return CheckoutStatusResponse(
        event_id=event.id,
        checkout_open=event.checkout_open,
    )


# ── Donor balance list (T049) ─────────────────────────────────────────────────


@router.get("/donors", response_model=DonorListResponse)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def list_donor_balances(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> DonorListResponse:
    """Return the outstanding balance for every donor at an event.

    Aggregates across auction wins, paddle-raise donations, quick-entry bids,
    and unpaid ticket purchases, then deducts already-captured transactions.
    Orders by balance descending.
    """
    ev_result = await db.execute(select(Event).where(Event.id == event_id))
    event = ev_result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    npo_id = event.npo_id

    sql = text(
        """
        WITH
          auction_totals AS (
            SELECT user_id, CAST(SUM(bid_amount) AS NUMERIC(12,2)) AS total
            FROM auction_bids
            WHERE event_id = :event_id
              AND bid_status = 'winning'
              AND transaction_status = 'pending'
            GROUP BY user_id
          ),
          donation_totals AS (
            SELECT donor_user_id AS user_id,
                   CAST(SUM(amount) AS NUMERIC(12,2)) AS total
            FROM quick_entry_paddle_raise_donations
            WHERE event_id = :event_id
              AND donor_user_id IS NOT NULL
            GROUP BY donor_user_id
          ),
          qe_bid_totals AS (
            SELECT donor_user_id AS user_id,
                   CAST(SUM(amount) AS NUMERIC(12,2)) AS total
            FROM quick_entry_live_bids
            WHERE event_id = :event_id
              AND status != 'deleted'
              AND donor_user_id IS NOT NULL
            GROUP BY donor_user_id
          ),
          ticket_totals AS (
            SELECT user_id,
                   CAST(SUM(total_price) AS NUMERIC(12,2)) AS total
            FROM ticket_purchases
            WHERE event_id = :event_id
              AND payment_status = 'pending'
            GROUP BY user_id
          ),
          paid_totals AS (
            SELECT user_id,
                   CAST(SUM(amount) AS NUMERIC(12,2)) AS total
            FROM payment_transactions
            WHERE event_id = :event_id
              AND status = 'captured'
            GROUP BY user_id
          ),
          all_donors AS (
            SELECT user_id FROM auction_totals
            UNION SELECT user_id FROM donation_totals
            UNION SELECT user_id FROM qe_bid_totals
            UNION SELECT user_id FROM ticket_totals
          ),
          balances AS (
            SELECT
              d.user_id,
              GREATEST(
                COALESCE(a.total, 0) +
                COALESCE(don.total, 0) +
                COALESCE(q.total, 0) +
                COALESCE(t.total, 0) -
                COALESCE(p.total, 0),
                0
              ) AS gross_balance
            FROM all_donors d
            LEFT JOIN auction_totals  a   ON a.user_id   = d.user_id
            LEFT JOIN donation_totals don ON don.user_id = d.user_id
            LEFT JOIN qe_bid_totals   q   ON q.user_id   = d.user_id
            LEFT JOIN ticket_totals   t   ON t.user_id   = d.user_id
            LEFT JOIN paid_totals     p   ON p.user_id   = d.user_id
          )
        SELECT
          b.user_id,
          u.first_name,
          u.last_name,
          u.email,
          b.gross_balance           AS total_balance,
          (pp.id IS NOT NULL)       AS has_payment_profile,
          pp.id                     AS payment_profile_id
        FROM balances b
        JOIN users u ON u.id = b.user_id
        LEFT JOIN payment_profiles pp
               ON pp.user_id    = b.user_id
              AND pp.npo_id     = :npo_id
              AND pp.is_default = TRUE
              AND pp.deleted_at IS NULL
        WHERE b.gross_balance > 0
        ORDER BY b.gross_balance DESC
        """
    )

    rows = (await db.execute(sql, {"event_id": event_id, "npo_id": npo_id})).all()

    donors = [
        DonorBalanceSummary(
            user_id=row.user_id,
            first_name=row.first_name,
            last_name=row.last_name,
            email=row.email,
            total_balance=Decimal(str(row.total_balance)),
            has_payment_profile=bool(row.has_payment_profile),
            payment_profile_id=row.payment_profile_id,
        )
        for row in rows
    ]
    total_outstanding = sum((d.total_balance for d in donors), Decimal("0"))
    return DonorListResponse(
        event_id=event_id,
        donors=donors,
        total_outstanding=total_outstanding,
    )


# ── Admin force-charge (T049) ─────────────────────────────────────────────────


@router.post("/charge", response_model=AdminChargeResponse)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_charge(
    body: AdminChargeRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> AdminChargeResponse:
    """Admin-initiated manual charge using a donor's saved card.

    Line items and total are trusted from the request body (admin-authenticated).
    A mandatory ``reason`` is required for audit purposes.
    """
    svc = CheckoutService(db)
    response = await svc.admin_charge(
        user_id=body.user_id,
        npo_id=body.npo_id,
        event_id=body.event_id,
        payment_profile_id=body.payment_profile_id,
        line_items=body.line_items,
        total_amount=body.total_amount,
        idempotency_key=body.idempotency_key,
        gateway=gateway,
        initiated_by=current_user.id,
        reason=body.reason,
    )
    return AdminChargeResponse(
        transaction_id=response.transaction_id,
        status=response.status,
        amount_charged=response.amount_charged,
        gateway_transaction_id=response.gateway_transaction_id,
        decline_reason=response.decline_reason,
    )


# ── Transaction list (T054) ───────────────────────────────────────────────────


@router.get("/transactions", response_model=TransactionListResponse)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def list_transactions(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    offset: int = 0,
    limit: int = 100,
) -> TransactionListResponse:
    """Return all payment transactions for an event (admin view), newest first."""
    stmt = (
        select(PaymentTransaction)
        .where(PaymentTransaction.event_id == event_id)
        .order_by(PaymentTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    txns = result.scalars().all()

    count_sql = text("SELECT COUNT(*) FROM payment_transactions WHERE event_id = :eid")
    total = (await db.execute(count_sql, {"eid": event_id})).scalar() or 0

    user_cache: dict[uuid.UUID, User] = {}
    items: list[TransactionListItem] = []
    for txn in txns:
        if txn.user_id not in user_cache:
            u_result = await db.execute(select(User).where(User.id == txn.user_id))
            u = u_result.scalar_one_or_none()
            if u:
                user_cache[txn.user_id] = u
        user = user_cache.get(txn.user_id)
        items.append(
            TransactionListItem(
                transaction_id=txn.id,
                user_id=txn.user_id,
                user_email=user.email if user else "",
                user_name=user.full_name if user else "Unknown",
                status=txn.status.value,
                transaction_type=txn.transaction_type.value,
                amount=txn.amount,
                gateway_transaction_id=txn.gateway_transaction_id,
                created_at=txn.created_at.isoformat(),
            )
        )
    return TransactionListResponse(
        event_id=event_id,
        transactions=items,
        total=int(total),
    )


# ── Void (T053) ───────────────────────────────────────────────────────────────


@router.post(
    "/{transaction_id}/void",
    response_model=VoidResponse,
    status_code=status.HTTP_200_OK,
)
@require_role("super_admin", "npo_admin")
async def void_transaction_endpoint(
    transaction_id: uuid.UUID,
    body: VoidRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> VoidResponse:
    """Void a captured transaction (before settlement).

    Raises 422 if the transaction is not in a voidable state.
    """
    svc = PaymentTransactionService(db)
    void_txn = await svc.void_transaction(
        transaction_id=transaction_id,
        gateway=gateway,
        initiated_by=current_user.id,
        reason=body.reason,
    )
    return VoidResponse(
        transaction_id=void_txn.id,
        parent_transaction_id=void_txn.parent_transaction_id,  # type: ignore[arg-type]
        status=void_txn.status.value,
    )


# ── Refund (T053) ─────────────────────────────────────────────────────────────


@router.post(
    "/{transaction_id}/refund",
    response_model=RefundResponse,
    status_code=status.HTTP_200_OK,
)
@require_role("super_admin", "npo_admin")
async def refund_transaction_endpoint(
    transaction_id: uuid.UUID,
    body: RefundRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> RefundResponse:
    """Issue a partial or full refund for a captured transaction.

    Raises 422 if the transaction cannot be refunded or the amount exceeds orginal.
    """
    svc = PaymentTransactionService(db)
    refund_txn = await svc.refund_transaction(
        transaction_id=transaction_id,
        amount=body.amount,
        gateway=gateway,
        initiated_by=current_user.id,
        reason=body.reason,
    )
    return RefundResponse(
        refund_transaction_id=refund_txn.id,
        gateway_transaction_id=refund_txn.gateway_transaction_id,
        status=refund_txn.status.value,
        amount_refunded=refund_txn.amount,
    )


# ── Admin-on-behalf HPF session + profile (check-in card entry) ──────────────


@router.post(
    "/users/{user_id}/session",
    response_model=PaymentSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_create_payment_session_for_user(
    user_id: uuid.UUID,
    body: PaymentSessionRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> PaymentSessionResponse:
    """Create an HPF session on behalf of a donor (admin-initiated).

    Used during event check-in when a donor does not yet have a saved card.
    The session is created under ``user_id`` (not the admin's own account).
    """
    # Verify the target user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    if user_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    svc = PaymentTransactionService(db)
    response = await svc.create_hosted_session(
        user_id=user_id,
        request=body,
        gateway=gateway,
    )
    await db.commit()
    return response


@router.post(
    "/users/{user_id}/profiles",
    response_model=PaymentProfileRead,
    status_code=status.HTTP_201_CREATED,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_create_payment_profile_for_user(
    user_id: uuid.UUID,
    body: PaymentProfileCreate,
    current_user: CurrentUser,
    db: DB,
) -> PaymentProfileRead:
    """Save a tokenised card on behalf of a donor (admin-initiated).

    Called after the HPF iframe's postMessage is received while an admin has
    the check-in 'Add Card' dialog open.  Associates the card with ``user_id``
    in the NPO vault, not the admin's account.
    """
    # Verify the target user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    if user_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    svc = PaymentProfileService(db)
    profile = await svc.create_profile(
        user_id=user_id,
        npo_id=body.npo_id,
        data=body,
    )
    await db.commit()
    await db.refresh(profile)
    return profile_to_read(profile)


# ── Feature 044: Admin Event Checkout Control ─────────────────────────────────


@router_checkout.post(
    "/{event_id}/checkout/open",
    response_model=CheckoutConfigurationResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_open_checkout(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Open checkout for an event. Snapshots the current processing fee rate if not yet set."""
    svc = CheckoutConfigurationService(db)
    config = await svc.open_checkout(event_id)
    await db.commit()
    await db.refresh(config)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.post(
    "/{event_id}/checkout/close",
    response_model=CheckoutConfigurationResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_close_checkout(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Close checkout for an event."""
    svc = CheckoutConfigurationService(db)
    config = await svc.close_checkout(event_id)
    await db.commit()
    await db.refresh(config)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.post(
    "/{event_id}/checkout/schedule",
    response_model=CheckoutConfigurationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_schedule_checkout_open(
    event_id: uuid.UUID,
    body: ScheduleCheckoutOpenRequest,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Schedule checkout to auto-open at a specific UTC datetime."""
    svc = CheckoutConfigurationService(db)
    config = await svc.schedule_open(event_id, open_at=body.open_at)
    await db.commit()
    await db.refresh(config)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.delete(
    "/{event_id}/checkout/schedule",
    response_model=CheckoutConfigurationResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_cancel_checkout_schedule(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Cancel a pending scheduled auto-open."""
    svc = CheckoutConfigurationService(db)
    config = await svc.cancel_schedule(event_id)
    await db.commit()
    await db.refresh(config)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.get(
    "/{event_id}/checkout/configuration",
    response_model=CheckoutConfigurationResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_get_checkout_configuration(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Get the checkout configuration for an event."""
    svc = CheckoutConfigurationService(db)
    config = await svc.get_or_create(event_id)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.patch(
    "/{event_id}/checkout/configuration",
    response_model=CheckoutConfigurationResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_update_checkout_configuration(
    event_id: uuid.UUID,
    body: UpdateCheckoutConfigurationRequest,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutConfigurationResponse:
    """Update editable checkout configuration fields (cash_instructions, donor_visible)."""
    svc = CheckoutConfigurationService(db)
    config = await svc.update_configuration(
        event_id=event_id,
        cash_instructions=body.cash_instructions,
        donor_visible=body.donor_visible,
    )
    await db.commit()
    await db.refresh(config)
    return CheckoutConfigurationResponse.model_validate(config)


@router_checkout.get(
    "/{event_id}/checkout/donors",
    response_model=DonorCheckoutStatusListResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_list_donor_checkout_status(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    page: int = 1,
    per_page: int = 50,
) -> DonorCheckoutStatusListResponse:
    """List all donors and their checkout session status for an event."""
    offset = (page - 1) * per_page

    count_sql = text("SELECT COUNT(*) FROM checkout_sessions WHERE event_id = :eid")
    total = (await db.execute(count_sql, {"eid": event_id})).scalar() or 0

    counts_sql = text(
        "SELECT status, COUNT(*) FROM checkout_sessions WHERE event_id = :eid GROUP BY status"
    )
    counts_rows = (await db.execute(counts_sql, {"eid": event_id})).all()
    counts_map: dict[str, int] = {row[0]: row[1] for row in counts_rows}

    result = await db.execute(
        select(CheckoutSession)
        .where(CheckoutSession.event_id == event_id)
        .options(selectinload(CheckoutSession.items))
        .order_by(CheckoutSession.created_at.asc())
        .offset(offset)
        .limit(per_page)
    )
    sessions = list(result.scalars().all())

    entries: list[DonorCheckoutStatusEntry] = []
    for sess in sessions:
        user_result = await db.execute(select(User).where(User.id == sess.user_id))
        user = user_result.scalar_one_or_none()
        item_count = sum(1 for i in (sess.items or []) if i.deleted_at is None)
        entries.append(
            DonorCheckoutStatusEntry(
                user_id=sess.user_id,
                first_name=user.first_name if user else None,
                last_name=user.last_name if user else None,
                email=user.email if user else "",
                status=sess.status.value,
                total_cents=sess.total_cents,
                item_count=item_count,
                completed_at=sess.completed_at,
            )
        )

    return DonorCheckoutStatusListResponse(
        donors=entries,
        total=int(total),
        page=page,
        per_page=per_page,
        counts=DonorCheckoutCountsResponse(
            not_started=counts_map.get("not_started", 0),
            in_progress=counts_map.get("in_progress", 0),
            complete=counts_map.get("complete", 0),
        ),
    )


@router_checkout.get(
    "/{event_id}/checkout/donors/{user_id}/session",
    response_model=AdminCheckoutSessionResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_get_donor_session(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> AdminCheckoutSessionResponse:
    """Get a donor's checkout session, including admin audit logs."""
    result = await db.execute(
        select(CheckoutSession)
        .where(
            CheckoutSession.event_id == event_id,
            CheckoutSession.user_id == user_id,
        )
        .options(
            selectinload(CheckoutSession.items),
            selectinload(CheckoutSession.audit_logs),
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout session not found for this donor.",
        )
    return AdminCheckoutSessionResponse.model_validate(session)


@router_checkout.post(
    "/{event_id}/checkout/donors/{user_id}/items",
    response_model=AdminCheckoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_add_item_to_session(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    body: AdminAddCheckoutItemRequest,
    current_user: CurrentUser,
    db: DB,
) -> AdminCheckoutSessionResponse:
    """Add a line item to a donor's checkout session."""
    session = await _get_or_create_admin_session(db, event_id, user_id)
    svc = CheckoutService(db)
    await svc.admin_add_item(
        session_id=session.id,
        admin_user_id=current_user.id,
        data=body,
    )
    await db.commit()
    result = await db.execute(
        select(CheckoutSession)
        .where(CheckoutSession.id == session.id)
        .options(
            selectinload(CheckoutSession.items),
            selectinload(CheckoutSession.audit_logs),
        )
    )
    updated = result.scalar_one()
    return AdminCheckoutSessionResponse.model_validate(updated)


@router_checkout.patch(
    "/{event_id}/checkout/donors/{user_id}/items/{item_id}",
    response_model=AdminCheckoutSessionResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_reprice_session_item(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    body: AdminRepriceItemRequest,
    current_user: CurrentUser,
    db: DB,
) -> AdminCheckoutSessionResponse:
    """Adjust the price of a checkout item for a donor."""
    session = await _get_admin_session_or_404(db, event_id, user_id)
    svc = CheckoutService(db)
    await svc.admin_reprice_item(
        session_id=session.id,
        item_id=item_id,
        admin_user_id=current_user.id,
        new_amount_cents=body.adjusted_amount_cents,
    )
    await db.commit()
    result = await db.execute(
        select(CheckoutSession)
        .where(CheckoutSession.id == session.id)
        .options(
            selectinload(CheckoutSession.items),
            selectinload(CheckoutSession.audit_logs),
        )
    )
    updated = result.scalar_one()
    return AdminCheckoutSessionResponse.model_validate(updated)


@router_checkout.delete(
    "/{event_id}/checkout/donors/{user_id}/items/{item_id}",
    response_model=AdminCheckoutSessionResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_remove_session_item(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> AdminCheckoutSessionResponse:
    """Soft-delete a checkout item from a donor's session."""
    session = await _get_admin_session_or_404(db, event_id, user_id)
    svc = CheckoutService(db)
    await svc.admin_remove_item(
        session_id=session.id,
        item_id=item_id,
        admin_user_id=current_user.id,
    )
    await db.commit()
    result = await db.execute(
        select(CheckoutSession)
        .where(CheckoutSession.id == session.id)
        .options(
            selectinload(CheckoutSession.items),
            selectinload(CheckoutSession.audit_logs),
        )
    )
    updated = result.scalar_one()
    return AdminCheckoutSessionResponse.model_validate(updated)


@router_checkout.post(
    "/{event_id}/checkout/notifications/send-link",
    response_model=dict[str, int],
    status_code=status.HTTP_202_ACCEPTED,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_send_checkout_link(
    event_id: uuid.UUID,
    body: SendCheckoutNotificationRequest,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, int]:
    """Send checkout link notifications to all or selected donors."""
    count = await CheckoutNotificationService.send_checkout_link(
        db=db,
        event_id=event_id,
        user_ids=body.user_ids,
    )
    return {"dispatched": count}


@router_checkout.post(
    "/{event_id}/checkout/notifications/send-reminder",
    response_model=dict[str, int],
    status_code=status.HTTP_202_ACCEPTED,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_send_checkout_reminder(
    event_id: uuid.UUID,
    body: SendCheckoutNotificationRequest,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, int]:
    """Send checkout reminder notifications to donors who have not yet completed checkout."""
    count = await CheckoutNotificationService.send_checkout_reminder(
        db=db,
        event_id=event_id,
        user_ids=body.user_ids,
    )
    return {"dispatched": count}


@router_checkout.get(
    "/{event_id}/checkout/donors/{user_id}/receipt",
    response_class=StreamingResponse,
)
@require_role("super_admin", "npo_admin", "event_coordinator", "npo_staff")
async def admin_get_donor_receipt(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> StreamingResponse:
    """Generate and stream the PDF receipt for a donor's checkout session.

    Always generates the PDF on demand so admins can download receipts
    even when Azure Blob Storage is not configured.
    """
    result = await db.execute(
        select(CheckoutSession)
        .options(selectinload(CheckoutSession.items))
        .where(
            CheckoutSession.event_id == event_id,
            CheckoutSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout session not found for this donor.",
        )

    receipt_svc = CheckoutReceiptService(db)
    ctx = await receipt_svc.build_context(session)
    html = receipt_svc.render_html(ctx)
    try:
        pdf_bytes = await receipt_svc.generate_pdf(html)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate PDF receipt.",
        ) from exc

    def _slugify(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

    event_slug = _slugify(str(ctx.get("event_name", "event")))[:40]
    donor_slug = _slugify(str(ctx.get("donor_name", "donor")))[:30]
    completed_at = session.completed_at
    date_str = completed_at.strftime("%Y%m%d") if completed_at else "unknown"
    filename = f"receipt-{event_slug}-{donor_slug}-{date_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router_checkout.post(
    "/{event_id}/checkout/donors/{user_id}/receipt/resend",
    response_model=dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def admin_resend_donor_receipt(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, str]:
    """Resend the receipt email to a donor who has completed checkout."""
    result = await db.execute(
        select(CheckoutSession)
        .options(selectinload(CheckoutSession.items))
        .where(
            CheckoutSession.event_id == event_id,
            CheckoutSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout session not found for this donor.",
        )
    receipt_svc = CheckoutReceiptService(db)
    await receipt_svc.send_receipt_email(session)
    return {"message": "Receipt email dispatched."}


# ── Feature 044: Super-Admin Processing Fee Config ────────────────────────────


class SetProcessingFeeRequest(BaseModel):
    rate: Decimal = Field(..., gt=0, le=1, description="Rate as a decimal, e.g. 0.029 for 2.9%")


class ProcessingFeeHistoryResponse(BaseModel):
    items: list[ProcessingFeeConfigResponse]
    total: int
    page: int
    per_page: int
    pages: int


@router_fee_config.get(
    "/processing-fee-config",
    response_model=ProcessingFeeConfigResponse,
)
@require_role("super_admin")
async def get_processing_fee_config(
    current_user: CurrentUser,
    db: DB,
) -> ProcessingFeeConfigResponse:
    """Return the current processing fee rate (super admin only)."""
    from app.models.processing_fee_config import ProcessingFeeConfig

    result = await db.execute(
        select(ProcessingFeeConfig).order_by(ProcessingFeeConfig.created_at.desc()).limit(1)
    )
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processing fee configuration found. Use POST to create one.",
        )
    return ProcessingFeeConfigResponse.model_validate(config)


@router_fee_config.post(
    "/processing-fee-config",
    response_model=ProcessingFeeConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
@require_role("super_admin")
async def set_processing_fee_config(
    body: SetProcessingFeeRequest,
    current_user: CurrentUser,
    db: DB,
) -> ProcessingFeeConfigResponse:
    """Set a new processing fee rate (super admin only). Creates an append-only history entry."""
    svc = ProcessingFeeConfigService(db)
    config = await svc.set_rate(rate=body.rate, admin_user_id=current_user.id)
    await db.commit()
    await db.refresh(config)
    return ProcessingFeeConfigResponse.model_validate(config)


@router_fee_config.get(
    "/processing-fee-config/history",
    response_model=ProcessingFeeHistoryResponse,
)
@require_role("super_admin")
async def get_processing_fee_config_history(
    current_user: CurrentUser,
    db: DB,
    page: int = 1,
    per_page: int = 20,
) -> ProcessingFeeHistoryResponse:
    """Return paginated history of processing fee rate changes (super admin only)."""
    svc = ProcessingFeeConfigService(db)
    items, total = await svc.get_history(page=page, per_page=per_page)
    pages = max(1, (total + per_page - 1) // per_page)
    return ProcessingFeeHistoryResponse(
        items=[ProcessingFeeConfigResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


# ── Private helpers ───────────────────────────────────────────────────────────


async def _get_admin_session_or_404(
    db: AsyncSession,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CheckoutSession:
    """Fetch a checkout session or raise 404."""
    result = await db.execute(
        select(CheckoutSession).where(
            CheckoutSession.event_id == event_id,
            CheckoutSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout session not found for this donor.",
        )
    return session


async def _get_or_create_admin_session(
    db: AsyncSession,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CheckoutSession:
    """Fetch or create a checkout session for a donor (admin-initiated)."""
    result = await db.execute(
        select(CheckoutSession).where(
            CheckoutSession.event_id == event_id,
            CheckoutSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        svc = CheckoutService(db)
        session = await svc.get_or_create_session(
            user_id=user_id,
            event_id=event_id,
        )
        await db.flush()
    return session

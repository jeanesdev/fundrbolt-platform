"""Ticket assignment, registration, inventory, and invitation endpoints.

T007 — Donor ticket purchasing feature.
"""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.ticket_management import TicketPackage, TicketPurchase
from app.models.user import User
from app.schemas.ticket_purchasing import (
    AssignmentUpdateRequest,
    AssignTicketRequest,
    AssignTicketResponse,
    InvitationSendRequest,
    InvitationSendResponse,
    PurchaseDetail,
    PurchaseHistoryItem,
    PurchaseHistoryResponse,
    SelfRegisterRequest,
    SelfRegisterResponse,
    TicketInventoryResponse,
)
from app.services.ticket_assignment_service import TicketAssignmentService
from app.services.ticket_invitation_service import TicketInvitationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ticket-purchasing"])


# ── Assignment CRUD ───────────────────────────────────────────────────────


@router.post(
    "/tickets/{ticket_id}/assign",
    response_model=AssignTicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_ticket(
    ticket_id: uuid.UUID,
    body: AssignTicketRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AssignTicketResponse:
    """Assign a ticket to a guest by name and email."""
    response = await TicketAssignmentService.assign_ticket(
        db=db,
        assigned_ticket_id=ticket_id,
        guest_name=body.guest_name,
        guest_email=body.guest_email,
        user_id=current_user.id,
    )
    await db.commit()
    return response


@router.patch(
    "/tickets/assignments/{assignment_id}",
    response_model=AssignTicketResponse,
)
async def update_assignment(
    assignment_id: uuid.UUID,
    body: AssignmentUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AssignTicketResponse:
    """Update guest name or email on an existing assignment."""
    response = await TicketAssignmentService.update_assignment(
        db=db,
        assignment_id=assignment_id,
        guest_name=body.guest_name,
        guest_email=str(body.guest_email) if body.guest_email is not None else None,
        user_id=current_user.id,
    )
    await db.commit()
    return response


@router.delete(
    "/tickets/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_assignment(
    assignment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """Cancel a ticket assignment (before the guest has registered)."""
    await TicketAssignmentService.cancel_assignment(
        db=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
    )
    await db.commit()


# ── Self-Registration ─────────────────────────────────────────────────────


@router.post(
    "/tickets/assignments/{assignment_id}/self-register",
    response_model=SelfRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def self_register(
    assignment_id: uuid.UUID,
    body: SelfRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SelfRegisterResponse:
    """Complete self-registration for an event using a ticket assignment."""
    response = await TicketAssignmentService.self_register(
        db=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
        request=body,
    )
    await db.commit()
    return response


@router.post(
    "/tickets/assignments/{assignment_id}/cancel-registration",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_registration(
    assignment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """Cancel an existing event registration tied to a ticket assignment."""
    await TicketAssignmentService.cancel_registration(
        db=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
        actor_type="purchaser",
    )
    await db.commit()


# ── Inventory & Purchase History ──────────────────────────────────────────


@router.get(
    "/events/{event_id}/tickets/purchases",
    response_model=list[PurchaseDetail],
)
async def get_event_purchases(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[PurchaseDetail]:
    """Get all ticket purchases for the current user within an event."""
    return await TicketAssignmentService.get_purchases(
        db=db,
        event_id=event_id,
        user_id=current_user.id,
    )


@router.get(
    "/tickets/my-inventory",
    response_model=TicketInventoryResponse,
)
async def get_my_inventory(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> TicketInventoryResponse:
    """Get the full ticket inventory for the authenticated donor."""
    return await TicketAssignmentService.get_inventory(
        db=db,
        user_id=current_user.id,
    )


@router.get(
    "/tickets/purchase-history",
    response_model=PurchaseHistoryResponse,
)
async def get_purchase_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> PurchaseHistoryResponse:
    """Get paginated purchase history for the authenticated donor."""
    # Count total purchases
    count_result = await db.execute(
        select(func.count(TicketPurchase.id)).where(TicketPurchase.user_id == current_user.id)
    )
    total_count = count_result.scalar_one()

    # Fetch paginated purchases with related data
    result = await db.execute(
        select(TicketPurchase)
        .where(TicketPurchase.user_id == current_user.id)
        .options(
            selectinload(TicketPurchase.ticket_package),
            selectinload(TicketPurchase.event),
            selectinload(TicketPurchase.promo_application),
        )
        .order_by(TicketPurchase.purchased_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    purchases = result.scalars().all()

    items: list[PurchaseHistoryItem] = []
    for p in purchases:
        event: Event = p.event
        pkg: TicketPackage = p.ticket_package
        promo_app = p.promo_application
        items.append(
            PurchaseHistoryItem(
                id=p.id,
                event_name=event.name,
                event_slug=event.slug,
                event_date=event.event_datetime,
                package_name=pkg.name,
                quantity=p.quantity,
                total_price=p.total_price,
                discount_amount=promo_app.discount_amount if promo_app else Decimal("0"),
                promo_code=promo_app.promo_code.code
                if promo_app and promo_app.promo_code
                else None,
                payment_status=p.payment_status.value
                if hasattr(p.payment_status, "value")
                else str(p.payment_status),
                purchased_at=p.purchased_at,
                receipt_url=None,
            )
        )

    return PurchaseHistoryResponse(
        purchases=items,
        total_count=total_count,
        page=page,
        per_page=per_page,
    )


# ── Invitations ───────────────────────────────────────────────────────────


@router.post(
    "/tickets/assignments/{assignment_id}/invite",
    response_model=InvitationSendResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_invitation(
    assignment_id: uuid.UUID,
    body: InvitationSendRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> InvitationSendResponse:
    """Send an invitation email for a ticket assignment."""
    response = await TicketInvitationService.send_invitation(
        db=db,
        assignment_id=assignment_id,
        personal_message=body.personal_message,
        user_id=current_user.id,
    )
    await db.commit()
    return response


@router.post(
    "/tickets/assignments/{assignment_id}/resend-invite",
    response_model=InvitationSendResponse,
)
async def resend_invitation(
    assignment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> InvitationSendResponse:
    """Resend the invitation email for a ticket assignment."""
    response = await TicketInvitationService.resend_invitation(
        db=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
    )
    await db.commit()
    return response

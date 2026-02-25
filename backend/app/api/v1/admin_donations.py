"""Donation and donation-label API endpoints."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.donation import Donation
from app.models.event import Event
from app.models.user import User
from app.schemas.donation import (
    DonationCreateRequest,
    DonationListFilters,
    DonationListResponse,
    DonationResponse,
    DonationUpdateRequest,
)
from app.schemas.donation_label import (
    DonationLabelCreateRequest,
    DonationLabelListResponse,
    DonationLabelResponse,
    DonationLabelUpdateRequest,
)
from app.services.donation_label_service import DonationLabelService
from app.services.donation_service import DonationService
from app.services.permission_service import PermissionService

router = APIRouter(prefix="/events/{event_id}", tags=["donations"])


def _serialize_donation(donation: Donation) -> DonationResponse:
    return DonationResponse(
        id=donation.id,
        event_id=donation.event_id,
        donor_user_id=donation.donor_user_id,
        amount=donation.amount,
        is_paddle_raise=donation.is_paddle_raise,
        status=donation.status.value,
        label_ids=[assignment.label_id for assignment in donation.label_assignments],
        created_at=donation.created_at,
        updated_at=donation.updated_at,
    )


async def _get_event_or_404(db: AsyncSession, event_id: UUID) -> Event:
    stmt = select(Event).where(Event.id == event_id)
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def _require_read_access(db: AsyncSession, current_user: User, event: Event) -> None:
    permission_service = PermissionService()
    can_view_event = await permission_service.can_view_event(current_user, event.npo_id, db=db)
    can_view_donations = permission_service.can_view_donations(current_user)
    if not can_view_event or not can_view_donations:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def _require_write_access(db: AsyncSession, current_user: User, event: Event) -> None:
    await _require_read_access(db, current_user, event)
    permission_service = PermissionService()
    if not permission_service.can_manage_donations(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/donations", response_model=DonationListResponse, status_code=status.HTTP_200_OK)
async def list_donations(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    donor_user_id: UUID | None = None,
    is_paddle_raise: bool | None = None,
    include_voided: bool = False,
    label_ids: list[UUID] = Query(default=[]),
    label_match_mode: Literal["all", "any"] = Query(default="all", pattern="^(all|any)$"),
) -> DonationListResponse:
    """List event donations with optional donor, paddle-raise, and label filters."""
    event = await _get_event_or_404(db, event_id)
    await _require_read_access(db, current_user, event)

    filters = DonationListFilters(
        donor_user_id=donor_user_id,
        is_paddle_raise=is_paddle_raise,
        include_voided=include_voided,
        label_ids=label_ids,
        label_match_mode=label_match_mode,
    )
    donations = await DonationService.list_donations(db, event_id, filters)
    return DonationListResponse(items=[_serialize_donation(donation) for donation in donations])


@router.post("/donations", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
async def create_donation(
    event_id: UUID,
    payload: DonationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    """Create a donation in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    donation = await DonationService.create_donation(
        db=db,
        event_id=event_id,
        donor_user_id=payload.donor_user_id,
        amount=payload.amount,
        is_paddle_raise=payload.is_paddle_raise,
        label_ids=payload.label_ids,
    )
    return _serialize_donation(donation)


@router.get(
    "/donations/{donation_id}", response_model=DonationResponse, status_code=status.HTTP_200_OK
)
async def get_donation(
    event_id: UUID,
    donation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    """Get one donation by ID in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_read_access(db, current_user, event)
    donation = await DonationService.get_donation(db, event_id, donation_id)
    return _serialize_donation(donation)


@router.patch(
    "/donations/{donation_id}", response_model=DonationResponse, status_code=status.HTTP_200_OK
)
async def update_donation(
    event_id: UUID,
    donation_id: UUID,
    payload: DonationUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    """Update mutable donation fields in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    donation = await DonationService.update_donation(
        db=db,
        event_id=event_id,
        donation_id=donation_id,
        amount=payload.amount,
        is_paddle_raise=payload.is_paddle_raise,
        label_ids=payload.label_ids,
    )
    return _serialize_donation(donation)


@router.delete(
    "/donations/{donation_id}",
    response_model=DonationResponse,
    status_code=status.HTTP_200_OK,
)
async def void_donation(
    event_id: UUID,
    donation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    """Void (soft-delete) a donation in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    donation = await DonationService.void_donation(db, event_id, donation_id)
    return _serialize_donation(donation)


@router.get(
    "/donation-labels",
    response_model=DonationLabelListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_donation_labels(
    event_id: UUID,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationLabelListResponse:
    """List event-scoped donation labels."""
    event = await _get_event_or_404(db, event_id)
    await _require_read_access(db, current_user, event)
    labels = await DonationLabelService.list_labels(db, event_id, include_inactive=include_inactive)
    return DonationLabelListResponse(
        items=[DonationLabelResponse.model_validate(label) for label in labels]
    )


@router.post(
    "/donation-labels",
    response_model=DonationLabelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_donation_label(
    event_id: UUID,
    payload: DonationLabelCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationLabelResponse:
    """Create a reusable donation label in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    label = await DonationLabelService.create_label(db, event_id, payload.name)
    return DonationLabelResponse.model_validate(label)


@router.get(
    "/donation-labels/{label_id}",
    response_model=DonationLabelResponse,
    status_code=status.HTTP_200_OK,
)
async def get_donation_label(
    event_id: UUID,
    label_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationLabelResponse:
    """Get one donation label by ID in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_read_access(db, current_user, event)
    label = await DonationLabelService.get_label(db, event_id, label_id)
    return DonationLabelResponse.model_validate(label)


@router.patch(
    "/donation-labels/{label_id}",
    response_model=DonationLabelResponse,
    status_code=status.HTTP_200_OK,
)
async def update_donation_label(
    event_id: UUID,
    label_id: UUID,
    payload: DonationLabelUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationLabelResponse:
    """Update a donation label in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    label = await DonationLabelService.update_label(
        db=db,
        event_id=event_id,
        label_id=label_id,
        name=payload.name,
        is_active=payload.is_active,
    )
    return DonationLabelResponse.model_validate(label)


@router.delete(
    "/donation-labels/{label_id}",
    response_model=DonationLabelResponse,
    status_code=status.HTTP_200_OK,
)
async def retire_donation_label(
    event_id: UUID,
    label_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DonationLabelResponse:
    """Retire a donation label in event scope."""
    event = await _get_event_or_404(db, event_id)
    await _require_write_access(db, current_user, event)
    label = await DonationLabelService.retire_label(db, event_id, label_id)
    return DonationLabelResponse.model_validate(label)

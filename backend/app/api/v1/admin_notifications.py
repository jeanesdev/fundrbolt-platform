"""Admin notification API endpoints (T053).

Allows admins to send custom notifications and view campaign history.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_user
from app.models.notification import CampaignStatusEnum
from app.models.notification_campaign import NotificationCampaign
from app.models.user import User

logger = get_logger(__name__)

router = APIRouter(
    prefix="/admin/events/{event_id}/notifications",
    tags=["admin-notifications"],
)

ADMIN_ROLES = {"super_admin", "npo_admin", "event_coordinator", "staff"}


def _require_admin(user: User) -> None:
    role_name = getattr(user, "role_name", None)
    if role_name not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )


# ---------- Schemas ----------


class RecipientCriteria(BaseModel):
    type: str = Field(
        ...,
        description="Recipient type: all_attendees, all_bidders, specific_table, individual",
    )
    table_number: int | None = Field(None, description="Table number for specific_table type")
    user_ids: list[str] | None = Field(None, description="User UUIDs for individual type")


class SendNotificationRequest(BaseModel):
    message: str = Field(..., max_length=500, description="Notification message body")
    recipient_criteria: RecipientCriteria
    channels: list[str] = Field(
        default=["inapp"],
        description="Delivery channels: inapp, push, email, sms",
    )


class CampaignResponse(BaseModel):
    id: str
    message: str
    recipient_criteria: dict
    channels: list
    recipient_count: int
    delivered_count: int
    failed_count: int
    status: str
    sent_at: str | None
    created_at: str
    sender_id: str


class CampaignListResponse(BaseModel):
    campaigns: list[CampaignResponse]
    total: int
    page: int
    per_page: int


# ---------- Endpoints ----------


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def send_notification(
    event_id: uuid.UUID,
    body: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Send a custom notification to selected recipients."""
    _require_admin(current_user)

    # Create campaign record
    campaign = NotificationCampaign(
        event_id=event_id,
        sender_id=current_user.id,
        message=body.message,
        recipient_criteria=body.recipient_criteria.model_dump(),
        channels=body.channels,
        status=CampaignStatusEnum.DRAFT,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    # Dispatch async delivery task
    try:
        from app.tasks.notification_tasks import deliver_campaign_task

        deliver_campaign_task.delay(str(campaign.id))
    except Exception:
        logger.warning(
            "Failed to dispatch campaign delivery task",
            extra={"campaign_id": str(campaign.id)},
        )

    return {
        "campaign_id": str(campaign.id),
        "status": "accepted",
        "message": "Notification campaign queued for delivery",
    }


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    event_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignListResponse:
    """List notification campaigns for an event."""
    _require_admin(current_user)

    # Count
    count_stmt = select(func.count()).where(NotificationCampaign.event_id == event_id)
    total = (await db.execute(count_stmt)).scalar_one()

    # Query
    stmt = (
        select(NotificationCampaign)
        .where(NotificationCampaign.event_id == event_id)
        .order_by(NotificationCampaign.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    campaigns = list(result.scalars().all())

    return CampaignListResponse(
        campaigns=[
            CampaignResponse(
                id=str(c.id),
                message=c.message,
                recipient_criteria=c.recipient_criteria,
                channels=c.channels,
                recipient_count=c.recipient_count,
                delivered_count=c.delivered_count,
                failed_count=c.failed_count,
                status=c.status.value if hasattr(c.status, "value") else str(c.status),
                sent_at=c.sent_at.isoformat() if c.sent_at else None,
                created_at=c.created_at.isoformat() if c.created_at else "",
                sender_id=str(c.sender_id),
            )
            for c in campaigns
        ],
        total=total,
        page=page,
        per_page=per_page,
    )

"""Admin PDF report generation endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin_auctioneer import _resolve_auctioneer_id, _verify_event_access
from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_role
from app.models.user import User
from app.schemas.reports import BidCardRequest
from app.services.auctioneer_report_service import AuctioneerReportService
from app.services.bid_card_service import BidCardService
from app.services.event_report_service import EventReportService

router = APIRouter(prefix="/admin/events", tags=["admin-reports"])


@router.get(
    "/{event_id}/reports/event-summary",
    summary="Download NPO event summary report (PDF)",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"application/pdf": {}}, "description": "PDF report"},
        403: {"description": "Insufficient role"},
        404: {"description": "Event not found"},
        503: {"description": "PDF generation failed"},
    },
)
@require_role("super_admin", "npo_admin")
async def download_event_summary_report(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Generate and stream a full-colour event summary PDF report."""
    await _verify_event_access(event_id, current_user, db)

    svc = EventReportService(db)
    try:
        pdf_bytes = await svc.generate_pdf(event_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report generation failed. Please try again.",
        ) from exc

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"event-report-{today}.pdf"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{event_id}/reports/bid-cards",
    summary="Download bid card labels PDF",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"application/pdf": {}}, "description": "Bid card PDF"},
        400: {"description": "Invalid request"},
        403: {"description": "Insufficient role"},
        404: {"description": "Event not found"},
        422: {"description": "No published auction items found"},
        503: {"description": "PDF generation failed"},
    },
)
@require_role("super_admin", "npo_admin", "npo_staff")
async def download_bid_cards(
    event_id: UUID,
    request: BidCardRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Generate and stream a Brady-label-compatible bid card PDF."""
    await _verify_event_access(event_id, current_user, db)

    item_uuids: list[UUID] | None = None
    if request.item_ids:
        try:
            item_uuids = [UUID(iid) for iid in request.item_ids]
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid item_ids: one or more UUIDs are malformed.",
            ) from exc

    svc = BidCardService(db)
    try:
        pdf_bytes = await svc.generate_pdf(event_id, request, item_uuids)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No published auction items found for the selected criteria.",
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report generation failed. Please try again.",
        ) from exc

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    size_label = request.label_size.value.replace("x", "-by-")
    filename = f"bid-cards-{size_label}-{today}.pdf"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{event_id}/auctioneer/report",
    summary="Download auctioneer financial report (PDF)",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"application/pdf": {}}, "description": "Auctioneer PDF report"},
        403: {"description": "Insufficient role"},
        404: {"description": "Event not found"},
        503: {"description": "PDF generation failed"},
    },
)
@require_role("super_admin", "auctioneer")
async def download_auctioneer_report(
    event_id: UUID,
    auctioneer_user_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Generate and stream the auctioneer financial report PDF."""
    await _verify_event_access(event_id, current_user, db)

    resolved_id = _resolve_auctioneer_id(current_user, auctioneer_user_id)

    # When a super admin provides a specific auctioneer_user_id, resolve that
    # user's name for the "Prepared for …" header rather than using the super
    # admin's own name.
    if auctioneer_user_id is not None and resolved_id != current_user.id:
        result = await db.execute(select(User).where(User.id == resolved_id))
        auctioneer_user = result.scalar_one_or_none()
        display_name = auctioneer_user.full_name if auctioneer_user else str(resolved_id)
    else:
        display_name = current_user.full_name

    svc = AuctioneerReportService(db)
    try:
        pdf_bytes = await svc.generate_pdf(event_id, resolved_id, display_name)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report generation failed. Please try again.",
        ) from exc

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"auctioneer-report-{today}.pdf"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

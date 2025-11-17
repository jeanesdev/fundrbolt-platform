"""Event Sponsors API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.user import User
from app.schemas.sponsor import (
    LogoUploadRequest,
    LogoUploadResponse,
    ReorderRequest,
    SponsorCreate,
    SponsorCreateResponse,
    SponsorResponse,
    SponsorUpdate,
)
from app.services.event_service import EventService
from app.services.sponsor_logo_service import SponsorLogoService
from app.services.sponsor_service import SponsorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/sponsors", tags=["events", "sponsors"])


@router.get("", response_model=list[SponsorResponse], status_code=status.HTTP_200_OK)
async def list_sponsors(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[SponsorResponse]:
    """
    List all sponsors for an event.

    Returns sponsors ordered by display_order (ascending) and logo_size (descending).
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    sponsors = await SponsorService.get_sponsors_for_event(db, event_id)

    # Generate SAS URLs for logo and thumbnail
    sponsor_responses = []

    for sponsor in sponsors:
        # Generate SAS URLs if blob names exist
        logo_url = sponsor.logo_url
        thumbnail_url = sponsor.thumbnail_url

        if sponsor.logo_blob_name and sponsor.logo_url:
            try:
                logo_url = SponsorLogoService.generate_blob_sas_url(
                    sponsor.logo_blob_name, expiry_hours=24
                )
            except Exception as e:
                logger.warning(f"Failed to generate logo SAS URL for sponsor {sponsor.id}: {e}")

        if sponsor.thumbnail_blob_name and sponsor.thumbnail_url:
            try:
                thumbnail_url = SponsorLogoService.generate_blob_sas_url(
                    sponsor.thumbnail_blob_name, expiry_hours=24
                )
            except Exception as e:
                logger.warning(
                    f"Failed to generate thumbnail SAS URL for sponsor {sponsor.id}: {e}"
                )

        sponsor_responses.append(
            SponsorResponse(
                id=sponsor.id,
                event_id=sponsor.event_id,
                name=sponsor.name,
                logo_url=logo_url,
                logo_blob_name=sponsor.logo_blob_name,
                thumbnail_url=thumbnail_url,
                thumbnail_blob_name=sponsor.thumbnail_blob_name,
                website_url=sponsor.website_url,
                logo_size=sponsor.logo_size,
                sponsor_level=sponsor.sponsor_level,
                contact_name=sponsor.contact_name,
                contact_email=sponsor.contact_email,
                contact_phone=sponsor.contact_phone,
                address_line1=sponsor.address_line1,
                address_line2=sponsor.address_line2,
                city=sponsor.city,
                state=sponsor.state,
                postal_code=sponsor.postal_code,
                country=sponsor.country,
                donation_amount=sponsor.donation_amount,
                notes=sponsor.notes,
                display_order=sponsor.display_order,
                created_at=sponsor.created_at.isoformat(),
                updated_at=sponsor.updated_at.isoformat(),
                created_by=sponsor.created_by,
            )
        )

    return sponsor_responses


@router.post("", response_model=SponsorCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_sponsor(
    event_id: uuid.UUID,
    request: SponsorCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SponsorCreateResponse:
    """
    Create a new sponsor for an event.

    This is a two-step process:
    1. Create sponsor record with metadata (this endpoint)
    2. Upload logo to Azure Blob Storage using provided SAS URL
    3. Call confirm endpoint to finalize upload and generate thumbnail

    Returns:
    - sponsor: Created sponsor record
    - upload_url: Pre-signed Azure Blob URL (1-hour expiry)
    - expires_at: Upload URL expiration timestamp
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # TODO: Add permission check for event management
    # For now, any authenticated user can create sponsors (will be restricted later)

    # Create sponsor (with placeholder logo URLs)
    sponsor = await SponsorService.create_sponsor(
        db=db,
        event_id=event_id,
        data=request,
        current_user=current_user,
    )

    # Generate upload URL for logo
    upload_url, expires_at = await SponsorLogoService.generate_upload_url(
        db=db,
        sponsor_id=sponsor.id,
        npo_id=event.npo_id,
        file_name=request.logo_file_name,
        file_type=request.logo_file_type,
        file_size=request.logo_file_size,
    )

    # Store the blob name in sponsor record for later confirmation
    # The blob name is embedded in the upload_url
    blob_name = SponsorLogoService.generate_blob_name(
        npo_id=event.npo_id,
        sponsor_id=sponsor.id,
        file_name=request.logo_file_name,
    )

    sponsor.logo_blob_name = blob_name
    await db.commit()
    await db.refresh(sponsor)

    return SponsorCreateResponse(
        sponsor=SponsorResponse(
            id=sponsor.id,
            event_id=sponsor.event_id,
            name=sponsor.name,
            logo_url=sponsor.logo_url,
            logo_blob_name=sponsor.logo_blob_name,
            thumbnail_url=sponsor.thumbnail_url,
            thumbnail_blob_name=sponsor.thumbnail_blob_name,
            website_url=sponsor.website_url,
            logo_size=sponsor.logo_size,
            sponsor_level=sponsor.sponsor_level,
            contact_name=sponsor.contact_name,
            contact_email=sponsor.contact_email,
            contact_phone=sponsor.contact_phone,
            address_line1=sponsor.address_line1,
            address_line2=sponsor.address_line2,
            city=sponsor.city,
            state=sponsor.state,
            postal_code=sponsor.postal_code,
            country=sponsor.country,
            donation_amount=sponsor.donation_amount,
            notes=sponsor.notes,
            display_order=sponsor.display_order,
            created_at=sponsor.created_at.isoformat(),
            updated_at=sponsor.updated_at.isoformat(),
            created_by=sponsor.created_by,
        ),
        upload_url=upload_url,
        expires_at=expires_at,
    )


@router.post(
    "/{sponsor_id}/logo/upload-url",
    response_model=LogoUploadResponse,
    status_code=status.HTTP_200_OK,
)
async def request_logo_upload_url(
    event_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    request: LogoUploadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> LogoUploadResponse:
    """
    Generate pre-signed URL for uploading/replacing sponsor logo.

    Use this for replacing an existing sponsor's logo.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Verify sponsor exists and belongs to event
    sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
    if not sponsor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sponsor not found",
        )

    # Generate upload URL
    upload_url, expires_at = await SponsorLogoService.generate_upload_url(
        db=db,
        sponsor_id=sponsor_id,
        npo_id=event.npo_id,
        file_name=request.file_name,
        file_type=request.file_type,
        file_size=request.file_size,
    )

    # Update blob name for confirmation
    blob_name = SponsorLogoService.generate_blob_name(
        npo_id=event.npo_id,
        sponsor_id=sponsor_id,
        file_name=request.file_name,
    )
    sponsor.logo_blob_name = blob_name
    await db.commit()

    return LogoUploadResponse(
        upload_url=upload_url,
        blob_name=blob_name,
        expires_at=expires_at,
    )


@router.post(
    "/{sponsor_id}/logo/confirm",
    response_model=SponsorResponse,
    status_code=status.HTTP_200_OK,
)
async def confirm_logo_upload(
    event_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SponsorResponse:
    """
    Confirm logo upload completion and trigger thumbnail generation.

    Call this after successfully uploading logo file to Azure Blob Storage.
    """
    # Verify sponsor exists and belongs to event
    sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
    if not sponsor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sponsor not found",
        )

    # Confirm upload and generate thumbnail
    updated_sponsor = await SponsorLogoService.confirm_upload(
        db=db,
        sponsor_id=sponsor_id,
        logo_blob_name=sponsor.logo_blob_name,
    )

    return SponsorResponse(
        id=updated_sponsor.id,
        event_id=updated_sponsor.event_id,
        name=updated_sponsor.name,
        logo_url=updated_sponsor.logo_url,
        logo_blob_name=updated_sponsor.logo_blob_name,
        thumbnail_url=updated_sponsor.thumbnail_url,
        thumbnail_blob_name=updated_sponsor.thumbnail_blob_name,
        website_url=updated_sponsor.website_url,
        logo_size=updated_sponsor.logo_size,
        sponsor_level=updated_sponsor.sponsor_level,
        contact_name=updated_sponsor.contact_name,
        contact_email=updated_sponsor.contact_email,
        contact_phone=updated_sponsor.contact_phone,
        address_line1=updated_sponsor.address_line1,
        address_line2=updated_sponsor.address_line2,
        city=updated_sponsor.city,
        state=updated_sponsor.state,
        postal_code=updated_sponsor.postal_code,
        country=updated_sponsor.country,
        donation_amount=updated_sponsor.donation_amount,
        notes=updated_sponsor.notes,
        display_order=updated_sponsor.display_order,
        created_at=updated_sponsor.created_at.isoformat(),
        updated_at=updated_sponsor.updated_at.isoformat(),
        created_by=updated_sponsor.created_by,
    )


@router.get(
    "/{sponsor_id}",
    response_model=SponsorResponse,
    status_code=status.HTTP_200_OK,
)
async def get_sponsor(
    event_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SponsorResponse:
    """Get sponsor by ID."""
    sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
    if not sponsor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sponsor not found",
        )

    return SponsorResponse(
        id=sponsor.id,
        event_id=sponsor.event_id,
        name=sponsor.name,
        logo_url=sponsor.logo_url,
        logo_blob_name=sponsor.logo_blob_name,
        thumbnail_url=sponsor.thumbnail_url,
        thumbnail_blob_name=sponsor.thumbnail_blob_name,
        website_url=sponsor.website_url,
        logo_size=sponsor.logo_size,
        sponsor_level=sponsor.sponsor_level,
        contact_name=sponsor.contact_name,
        contact_email=sponsor.contact_email,
        contact_phone=sponsor.contact_phone,
        address_line1=sponsor.address_line1,
        address_line2=sponsor.address_line2,
        city=sponsor.city,
        state=sponsor.state,
        postal_code=sponsor.postal_code,
        country=sponsor.country,
        donation_amount=sponsor.donation_amount,
        notes=sponsor.notes,
        display_order=sponsor.display_order,
        created_at=sponsor.created_at.isoformat(),
        updated_at=sponsor.updated_at.isoformat(),
        created_by=sponsor.created_by,
    )


@router.patch(
    "/{sponsor_id}",
    response_model=SponsorResponse,
    status_code=status.HTTP_200_OK,
)
async def update_sponsor(
    event_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    request: SponsorUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SponsorResponse:
    """Update sponsor information."""
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Update sponsor
    updated_sponsor = await SponsorService.update_sponsor(
        db=db,
        sponsor_id=sponsor_id,
        event_id=event_id,
        data=request,
    )

    return SponsorResponse(
        id=updated_sponsor.id,
        event_id=updated_sponsor.event_id,
        name=updated_sponsor.name,
        logo_url=updated_sponsor.logo_url,
        logo_blob_name=updated_sponsor.logo_blob_name,
        thumbnail_url=updated_sponsor.thumbnail_url,
        thumbnail_blob_name=updated_sponsor.thumbnail_blob_name,
        website_url=updated_sponsor.website_url,
        logo_size=updated_sponsor.logo_size,
        sponsor_level=updated_sponsor.sponsor_level,
        contact_name=updated_sponsor.contact_name,
        contact_email=updated_sponsor.contact_email,
        contact_phone=updated_sponsor.contact_phone,
        address_line1=updated_sponsor.address_line1,
        address_line2=updated_sponsor.address_line2,
        city=updated_sponsor.city,
        state=updated_sponsor.state,
        postal_code=updated_sponsor.postal_code,
        country=updated_sponsor.country,
        donation_amount=updated_sponsor.donation_amount,
        notes=updated_sponsor.notes,
        display_order=updated_sponsor.display_order,
        created_at=updated_sponsor.created_at.isoformat(),
        updated_at=updated_sponsor.updated_at.isoformat(),
        created_by=updated_sponsor.created_by,
    )


@router.delete(
    "/{sponsor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_sponsor(
    event_id: uuid.UUID,
    sponsor_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """Delete sponsor and associated logo files."""
    # Get sponsor to retrieve blob names before deletion
    sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
    if not sponsor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sponsor not found",
        )

    # Store blob names for cleanup
    logo_blob_name = sponsor.logo_blob_name
    thumbnail_blob_name = sponsor.thumbnail_blob_name

    # Delete sponsor from database
    await SponsorService.delete_sponsor(db, sponsor_id, event_id)

    # Delete logo blobs from Azure Storage
    await SponsorLogoService.delete_logo_blobs(logo_blob_name, thumbnail_blob_name)


@router.patch(
    "/reorder",
    response_model=list[SponsorResponse],
    status_code=status.HTTP_200_OK,
)
async def reorder_sponsors(
    event_id: uuid.UUID,
    request: ReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[SponsorResponse]:
    """
    Reorder sponsors by display_order.

    Provide an array of sponsor IDs in the desired order.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Reorder sponsors
    reordered_sponsors = await SponsorService.reorder_sponsors(
        db=db,
        event_id=event_id,
        sponsor_ids_ordered=request.sponsor_ids,
    )

    return [
        SponsorResponse(
            id=sponsor.id,
            event_id=sponsor.event_id,
            name=sponsor.name,
            logo_url=sponsor.logo_url,
            logo_blob_name=sponsor.logo_blob_name,
            thumbnail_url=sponsor.thumbnail_url,
            thumbnail_blob_name=sponsor.thumbnail_blob_name,
            website_url=sponsor.website_url,
            logo_size=sponsor.logo_size,
            sponsor_level=sponsor.sponsor_level,
            contact_name=sponsor.contact_name,
            contact_email=sponsor.contact_email,
            contact_phone=sponsor.contact_phone,
            address_line1=sponsor.address_line1,
            address_line2=sponsor.address_line2,
            city=sponsor.city,
            state=sponsor.state,
            postal_code=sponsor.postal_code,
            country=sponsor.country,
            donation_amount=sponsor.donation_amount,
            notes=sponsor.notes,
            display_order=sponsor.display_order,
            created_at=sponsor.created_at.isoformat(),
            updated_at=sponsor.updated_at.isoformat(),
            created_by=sponsor.created_by,
        )
        for sponsor in reordered_sponsors
    ]

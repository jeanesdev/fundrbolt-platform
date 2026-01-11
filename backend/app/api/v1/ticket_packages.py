"""Admin API endpoints for ticket package management."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.event import Event
from app.models.ticket_management import TicketPackage
from app.models.user import User
from app.schemas.ticket_management import (
    TicketPackageCreate,
    TicketPackageRead,
    TicketPackageUpdate,
)
from app.services.ticket_audit_service import TicketAuditService
from app.services.ticket_image_service import ImageService

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/events/{event_id}/packages",
    response_model=TicketPackageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create ticket package",
)
async def create_ticket_package(
    event_id: uuid.UUID,
    package_data: TicketPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new ticket package."""
    # Verify event access
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Check duplicate name
    dup_result = await db.execute(
        select(func.count(TicketPackage.id)).where(
            and_(TicketPackage.event_id == event_id, TicketPackage.name == package_data.name)
        )
    )
    if dup_result.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Package '{package_data.name}' exists"
        )

    # Create package
    new_package = TicketPackage(
        event_id=event_id,
        name=package_data.name,
        description=package_data.description,
        price=package_data.price,
        seats_per_package=package_data.seats_per_package,
        quantity_limit=package_data.quantity_limit,
        is_enabled=package_data.is_enabled,
        is_sponsorship=package_data.is_sponsorship,
        created_by=current_user.id,
    )

    db.add(new_package)
    await db.flush()

    # Audit log
    audit_service = TicketAuditService(db)
    await audit_service.log_package_created(
        package_id=new_package.id,
        event_id=event_id,
        user_id=current_user.id,
        package_name=package_data.name,
        price=package_data.price,
        quantity=package_data.seats_per_package,
    )

    await db.commit()
    await db.refresh(new_package)

    logger.info(f"Created package {new_package.id}")
    return TicketPackageRead.from_orm_with_availability(new_package)


@router.get("/events/{event_id}/packages", response_model=list[TicketPackageRead])
async def list_ticket_packages(
    event_id: uuid.UUID,
    include_disabled: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List packages with availability status."""
    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    query = select(TicketPackage).where(TicketPackage.event_id == event_id)
    if not include_disabled:
        query = query.where(TicketPackage.is_enabled == True)  # noqa: E712

    query = query.order_by(TicketPackage.display_order, TicketPackage.created_at)
    result = await db.execute(query)
    packages = result.scalars().all()

    # Return packages with computed availability
    return [TicketPackageRead.from_orm_with_availability(pkg) for pkg in packages]


@router.get("/events/{event_id}/packages/{package_id}", response_model=TicketPackageRead)
async def get_ticket_package(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get package with availability status."""
    result = await db.execute(
        select(TicketPackage).where(
            and_(TicketPackage.id == package_id, TicketPackage.event_id == event_id)
        )
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return TicketPackageRead.from_orm_with_availability(package)


@router.patch("/events/{event_id}/packages/{package_id}", response_model=TicketPackageRead)
async def update_ticket_package(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    package_data: TicketPackageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update package."""
    result = await db.execute(
        select(TicketPackage)
        .where(and_(TicketPackage.id == package_id, TicketPackage.event_id == event_id))
        .with_for_update()
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Optimistic locking
    if package.version != package_data.version:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version mismatch")

    changes: dict[str, tuple[Any, Any]] = {}

    # Check duplicate name
    if package_data.name and package_data.name != package.name:
        dup_result = await db.execute(
            select(func.count(TicketPackage.id)).where(
                and_(
                    TicketPackage.event_id == event_id,
                    TicketPackage.name == package_data.name,
                    TicketPackage.id != package_id,
                )
            )
        )
        if dup_result.scalar_one() > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Name exists")

    # Validate quantity
    current_sold: int = package.sold_count
    if package_data.quantity_limit is not None and package_data.quantity_limit < current_sold:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity too low")

    # Apply updates
    for field, value in package_data.model_dump(exclude={"version"}, exclude_unset=True).items():
        old_value = getattr(package, field)
        if value != old_value:
            changes[field] = (old_value, value)
            setattr(package, field, value)

    package.version += 1

    # Audit log
    if changes:
        audit_service = TicketAuditService(db)
        await audit_service.log_package_updated(
            package_id=package_id, event_id=event_id, user_id=current_user.id, changes=changes
        )

    await db.commit()
    await db.refresh(package)

    logger.info(f"Updated package {package_id}")
    return TicketPackageRead.from_orm_with_availability(package)


@router.delete("/events/{event_id}/packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket_package(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete package."""
    result = await db.execute(
        select(TicketPackage).where(
            and_(TicketPackage.id == package_id, TicketPackage.event_id == event_id)
        )
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if package.sold_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tickets sold: {package.sold_count}"
        )

    await db.delete(package)

    audit_service = TicketAuditService(db)
    await audit_service.log_package_deleted(
        package_id=package_id, event_id=event_id, user_id=current_user.id, package_name=package.name
    )

    await db.commit()
    logger.info(f"Deleted package {package_id}")


@router.post(
    "/events/{event_id}/packages/{package_id}/image",
    response_model=TicketPackageRead,
    summary="Upload package image",
)
async def upload_package_image(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Upload image for ticket package.

    - Supported formats: JPG, PNG, WebP
    - Max size: 5 MB
    - Image is stored in Azure Blob Storage
    """
    # Verify access
    pkg_result = await db.execute(
        select(TicketPackage).where(
            and_(TicketPackage.id == package_id, TicketPackage.event_id == event_id)
        )
    )
    package: TicketPackage | None = pkg_result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        # Use ImageService to upload
        image_service = ImageService()
        image_url = await image_service.upload_image(
            file=file.file,
            filename=file.filename or "image",
            event_id=event_id,
            package_id=package_id,
        )

        # Update package with image URL
        package.image_url = image_url
        await db.commit()
        await db.refresh(package)

        logger.info(f"Uploaded image for package {package_id}: {image_url}")
        return TicketPackageRead.from_orm_with_availability(package)

    except ValueError as e:
        logger.error(f"Image validation failed for package {package_id}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Image upload failed for package {package_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload image"
        )


@router.delete(
    "/events/{event_id}/packages/{package_id}/image",
    response_model=TicketPackageRead,
    summary="Delete package image",
)
async def delete_package_image(
    event_id: uuid.UUID,
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Delete image for ticket package."""
    # Verify access
    pkg_result = await db.execute(
        select(TicketPackage).where(
            and_(TicketPackage.id == package_id, TicketPackage.event_id == event_id)
        )
    )
    package: TicketPackage | None = pkg_result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    result = await db.execute(
        select(Event).where(and_(Event.id == event_id, Event.npo_id == current_user.npo_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not package.image_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No image to delete")

    try:
        # Delete from blob storage
        image_service = ImageService()
        await image_service.delete_image(package.image_url)

        # Clear image URL
        package.image_url = None
        await db.commit()
        await db.refresh(package)

        logger.info(f"Deleted image for package {package_id}")
        return TicketPackageRead.from_orm_with_availability(package)

    except Exception as e:
        logger.error(f"Image deletion failed for package {package_id}: {e}")
        # Don't fail the request - image may be orphaned but package should still update
        package.image_url = None
        await db.commit()
        await db.refresh(package)
        return TicketPackageRead.from_orm_with_availability(package)

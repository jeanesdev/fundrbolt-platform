"""Admin testimonials API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.testimonial import (
    TestimonialCreate,
    TestimonialDetail,
    TestimonialUpdate,
)
from app.services.testimonial_service import TestimonialService

router = APIRouter(prefix="/admin/testimonials", tags=["admin-testimonials"])


def require_superadmin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Verify current user is superadmin."""
    if getattr(current_user, "role_name", None) != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return current_user


@router.get("", response_model=list[TestimonialDetail])
async def list_all_testimonials(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    _: Annotated[User, Depends(require_superadmin)],
    skip: int = 0,
    limit: int = 100,
) -> list[TestimonialDetail]:
    """
    List all testimonials (admin view, includes unpublished).

    Requires superadmin role.
    """
    service = TestimonialService(db)
    testimonials = await service.get_all_testimonials(skip=skip, limit=limit)

    return [TestimonialDetail.model_validate(t) for t in testimonials]


@router.get("/{testimonial_id}", response_model=TestimonialDetail)
async def get_testimonial(
    testimonial_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    _: Annotated[User, Depends(require_superadmin)],
) -> TestimonialDetail:
    """
    Get testimonial by ID (admin view).

    Requires superadmin role.
    """
    service = TestimonialService(db)
    testimonial = await service.get_testimonial_by_id(testimonial_id)

    if not testimonial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found",
        )

    return TestimonialDetail.model_validate(testimonial)


@router.post("", response_model=TestimonialDetail, status_code=status.HTTP_201_CREATED)
async def create_testimonial(
    data: TestimonialCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    _: Annotated[User, Depends(require_superadmin)],
) -> TestimonialDetail:
    """
    Create new testimonial.

    Requires superadmin role.
    """
    service = TestimonialService(db)
    testimonial = await service.create_testimonial(data, created_by=current_user.id)

    return TestimonialDetail.model_validate(testimonial)


@router.patch("/{testimonial_id}", response_model=TestimonialDetail)
async def update_testimonial(
    testimonial_id: UUID,
    data: TestimonialUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    _: Annotated[User, Depends(require_superadmin)],
) -> TestimonialDetail:
    """
    Update existing testimonial.

    Requires superadmin role.
    """
    service = TestimonialService(db)
    testimonial = await service.update_testimonial(testimonial_id, data)

    if not testimonial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found",
        )

    return TestimonialDetail.model_validate(testimonial)


@router.delete("/{testimonial_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(
    testimonial_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    _: Annotated[User, Depends(require_superadmin)],
) -> None:
    """
    Soft delete testimonial.

    Requires superadmin role.
    """
    service = TestimonialService(db)
    success = await service.delete_testimonial(testimonial_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found",
        )

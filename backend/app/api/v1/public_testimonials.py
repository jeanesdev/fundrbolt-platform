"""Public testimonials API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.testimonial import AuthorRole
from app.schemas.testimonial import TestimonialResponse
from app.services.testimonial_service import TestimonialService

router = APIRouter(prefix="/public/testimonials", tags=["public-testimonials"])


@router.get("", response_model=list[TestimonialResponse])
async def get_published_testimonials(
    db: Annotated[AsyncSession, Depends(get_db)],
    role: Annotated[AuthorRole | None, Query(description="Filter by author role")] = None,
    skip: Annotated[int, Query(ge=0, description="Number of records to skip")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Max records to return")] = 10,
) -> list[TestimonialResponse]:
    """
    Get published testimonials for public display.

    - **role**: Optional filter by author role (donor, auctioneer, npo_admin)
    - **skip**: Pagination offset (default: 0)
    - **limit**: Page size (default: 10, max: 100)
    - Returns testimonials ordered by display_order
    """
    service = TestimonialService(db)
    testimonials = await service.get_published_testimonials(
        role_filter=role, skip=skip, limit=limit
    )

    return [TestimonialResponse.model_validate(t) for t in testimonials]


@router.get("/count", response_model=dict[str, int])
async def count_published_testimonials(
    db: Annotated[AsyncSession, Depends(get_db)],
    role: Annotated[AuthorRole | None, Query(description="Filter by author role")] = None,
) -> dict[str, int]:
    """
    Count published testimonials.

    - **role**: Optional filter by author role
    - Returns total count of published testimonials
    """
    service = TestimonialService(db)
    count = await service.count_published_testimonials(role_filter=role)

    return {"count": count}

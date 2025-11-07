"""Service layer for testimonial operations."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.testimonial import AuthorRole, Testimonial
from app.schemas.testimonial import TestimonialCreate, TestimonialUpdate


class TestimonialService:
    """Service for managing testimonials."""

    def __init__(self, db: AsyncSession):
        """Initialize service with database session."""
        self.db = db

    async def get_published_testimonials(
        self,
        role_filter: AuthorRole | None = None,
        skip: int = 0,
        limit: int = 10,
    ) -> list[Testimonial]:
        """
        Get published testimonials for public display.

        Args:
            role_filter: Optional filter by author role
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return

        Returns:
            List of published testimonials ordered by display_order
        """
        query = select(Testimonial).where(
            Testimonial.is_published == True,  # noqa: E712
            Testimonial.deleted_at.is_(None),
        )

        if role_filter:
            query = query.where(Testimonial.author_role == role_filter)

        query = query.order_by(Testimonial.display_order).offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_published_testimonials(self, role_filter: AuthorRole | None = None) -> int:
        """
        Count published testimonials.

        Args:
            role_filter: Optional filter by author role

        Returns:
            Total count of published testimonials
        """
        from sqlalchemy import func

        query = select(func.count(Testimonial.id)).where(
            Testimonial.is_published == True,  # noqa: E712
            Testimonial.deleted_at.is_(None),
        )

        if role_filter:
            query = query.where(Testimonial.author_role == role_filter)

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_testimonial_by_id(self, testimonial_id: UUID) -> Testimonial | None:
        """
        Get testimonial by ID (admin view, includes unpublished).

        Args:
            testimonial_id: UUID of testimonial

        Returns:
            Testimonial if found, None otherwise
        """
        query = select(Testimonial).where(
            Testimonial.id == testimonial_id,
            Testimonial.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_testimonial(self, data: TestimonialCreate, created_by: UUID) -> Testimonial:
        """
        Create new testimonial.

        Args:
            data: Testimonial creation data
            created_by: UUID of user creating testimonial

        Returns:
            Created testimonial
        """
        testimonial = Testimonial(
            quote_text=data.quote_text,
            author_name=data.author_name,
            author_role=data.author_role,
            organization_name=data.organization_name,
            photo_url=str(data.photo_url) if data.photo_url else None,
            display_order=data.display_order,
            is_published=data.is_published,
            created_by=created_by,
        )

        self.db.add(testimonial)
        await self.db.commit()
        await self.db.refresh(testimonial)

        return testimonial

    async def update_testimonial(
        self, testimonial_id: UUID, data: TestimonialUpdate
    ) -> Testimonial | None:
        """
        Update existing testimonial.

        Args:
            testimonial_id: UUID of testimonial to update
            data: Update data

        Returns:
            Updated testimonial if found, None otherwise
        """
        testimonial = await self.get_testimonial_by_id(testimonial_id)
        if not testimonial:
            return None

        update_data: dict[str, Any] = data.model_dump(exclude_unset=True)

        # Convert photo_url HttpUrl to string
        if "photo_url" in update_data and update_data["photo_url"]:
            update_data["photo_url"] = str(update_data["photo_url"])

        for field, value in update_data.items():
            setattr(testimonial, field, value)

        await self.db.commit()
        await self.db.refresh(testimonial)

        return testimonial

    async def delete_testimonial(self, testimonial_id: UUID) -> bool:
        """
        Soft delete testimonial.

        Args:
            testimonial_id: UUID of testimonial to delete

        Returns:
            True if deleted, False if not found
        """
        from datetime import datetime

        testimonial = await self.get_testimonial_by_id(testimonial_id)
        if not testimonial:
            return False

        testimonial.deleted_at = datetime.utcnow()  # type: ignore[assignment]
        await self.db.commit()

        return True

    async def get_all_testimonials(self, skip: int = 0, limit: int = 100) -> list[Testimonial]:
        """
        Get all testimonials (admin view, includes unpublished).

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of testimonials ordered by display_order
        """
        query = (
            select(Testimonial)
            .where(Testimonial.deleted_at.is_(None))
            .order_by(Testimonial.display_order)
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

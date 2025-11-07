"""Testimonial model for landing page social proof."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class AuthorRole(str, enum.Enum):
    """Role of testimonial author."""

    DONOR = "donor"
    AUCTIONEER = "auctioneer"
    NPO_ADMIN = "npo_admin"


class Testimonial(Base):
    """
    Testimonial model for user success stories.

    Admin-curated testimonials displayed on public testimonials page.
    Supports soft delete and draft/published workflow.
    """

    __tablename__ = "testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_text = Column(String(500), nullable=False)
    author_name = Column(String(100), nullable=False)
    author_role = Column(String(50), nullable=False)  # Changed from Enum to String
    organization_name = Column(String(200), nullable=True)
    photo_url = Column(String(500), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Boolean, nullable=False, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<Testimonial {self.id} by {self.author_name}>"

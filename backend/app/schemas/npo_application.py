"""Pydantic schemas for NPO application workflow."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.npo_application import ApplicationStatus

# ================================
# Request Schemas
# ================================


class ApplicationCreateRequest(BaseModel):
    """Request schema for submitting an NPO application."""

    npo_id: uuid.UUID


class ApplicationReviewRequest(BaseModel):
    """Request schema for reviewing an NPO application (SuperAdmin only)."""

    status: ApplicationStatus = Field(description="New status: under_review, approved, or rejected")
    review_notes: dict[str, str] | None = Field(
        None,
        description="Review notes JSON: {reason, feedback, action_items}",
    )

    @field_validator("status")
    @classmethod
    def validate_review_status(cls, v: ApplicationStatus) -> ApplicationStatus:
        """Ensure status is valid for review action."""
        if v == ApplicationStatus.SUBMITTED:
            raise ValueError("Cannot set status back to 'submitted' during review")
        return v


class ApplicationListRequest(BaseModel):
    """Request schema for listing applications with filters."""

    status: ApplicationStatus | None = None
    npo_id: uuid.UUID | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ================================
# Response Schemas
# ================================


class ApplicationResponse(BaseModel):
    """Response schema for NPO application details."""

    id: uuid.UUID
    npo_id: uuid.UUID
    status: ApplicationStatus
    review_notes: dict[str, str] | None
    reviewed_by_user_id: uuid.UUID | None
    submitted_at: datetime
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    # Related NPO info
    npo_name: str | None = None
    npo_email: str | None = None

    model_config = {"from_attributes": True}


class ApplicationDetailResponse(ApplicationResponse):
    """Detailed response schema for application with full NPO details."""

    npo: dict[str, str] | None = Field(None, description="Full NPO details")


class ApplicationListResponse(BaseModel):
    """Response schema for paginated application list."""

    items: list[ApplicationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ApplicationReviewResponse(BaseModel):
    """Response schema after reviewing an application."""

    application: ApplicationResponse
    message: str = "Application reviewed successfully"

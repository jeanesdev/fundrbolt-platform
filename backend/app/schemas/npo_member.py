"""Pydantic schemas for NPO member management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.npo_member import MemberRole, MemberStatus

# ================================
# Request Schemas
# ================================


class MemberInviteRequest(BaseModel):
    """Request schema for inviting a member to an NPO."""

    email: EmailStr
    role: MemberRole = Field(description="Role: admin, co_admin, or staff")


class MemberAddRequest(BaseModel):
    """Request schema for directly adding an existing user to NPO."""

    user_id: uuid.UUID
    role: MemberRole


class MemberRoleUpdateRequest(BaseModel):
    """Request schema for updating a member's role."""

    role: MemberRole


class MemberStatusUpdateRequest(BaseModel):
    """Request schema for updating a member's status."""

    status: MemberStatus = Field(description="Status: active, suspended, or removed")
    notes: str | None = Field(None, max_length=500, description="Reason for status change")


class MemberListRequest(BaseModel):
    """Request schema for listing NPO members with filters."""

    npo_id: uuid.UUID | None = None
    status: MemberStatus | None = None
    role: MemberRole | None = None
    search: str | None = Field(None, max_length=255, description="Search by user name or email")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ================================
# Response Schemas
# ================================


class MemberResponse(BaseModel):
    """Response schema for NPO member details."""

    id: uuid.UUID
    npo_id: uuid.UUID
    user_id: uuid.UUID
    role: MemberRole
    status: MemberStatus
    joined_at: datetime | None
    invited_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    # User details (joined from users table)
    user_email: str | None = None
    user_first_name: str | None = None
    user_last_name: str | None = None
    user_full_name: str | None = None

    # Inviter details
    invited_by_name: str | None = None

    model_config = {"from_attributes": True}


class MemberDetailResponse(MemberResponse):
    """Detailed response schema for member with full user info."""

    user: dict[str, str] | None = Field(None, description="Full user details")
    npo: dict[str, str] | None = Field(None, description="NPO details")


class MemberListResponse(BaseModel):
    """Response schema for paginated member list."""

    items: list[MemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MemberInviteResponse(BaseModel):
    """Response schema after inviting a member."""

    invitation_id: uuid.UUID
    email: str
    role: MemberRole
    expires_at: datetime
    message: str = "Member invitation sent successfully"


class MemberAddResponse(BaseModel):
    """Response schema after adding a member."""

    member: MemberResponse
    message: str = "Member added successfully"

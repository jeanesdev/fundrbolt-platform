"""Pydantic schemas for NPO member operations."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, model_serializer

from app.models.npo_member import MemberRole, MemberStatus


# Base schemas
class MemberBase(BaseModel):
    """Base member schema."""

    role: MemberRole


class InvitationBase(BaseModel):
    """Base invitation schema."""

    email: EmailStr
    role: MemberRole
    first_name: str | None = None
    last_name: str | None = None


# Request schemas
class CreateInvitationRequest(InvitationBase):
    """Request schema for creating an invitation."""

    pass


class UpdateMemberRoleRequest(BaseModel):
    """Request schema for updating member role."""

    role: MemberRole


# Response schemas
class MemberResponse(MemberBase):
    """Response schema for NPO member."""

    id: uuid.UUID
    npo_id: uuid.UUID
    user_id: uuid.UUID
    status: MemberStatus
    joined_at: datetime | None
    created_at: datetime

    # Related user data (prefixed with user_ for clarity)
    user_email: str
    user_first_name: str
    user_last_name: str
    user_full_name: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_serializer
    def serialize_model(self) -> dict[str, Any]:
        """Add email alias for backward compatibility."""
        data = {
            "id": self.id,
            "npo_id": self.npo_id,
            "user_id": self.user_id,
            "role": self.role,
            "status": self.status,
            "joined_at": self.joined_at,
            "created_at": self.created_at,
            "user_email": self.user_email,
            "email": self.user_email,  # Alias for backward compatibility
            "user_first_name": self.user_first_name,
            "user_last_name": self.user_last_name,
            "user_full_name": self.user_full_name,
        }
        return data


class InvitationResponse(InvitationBase):
    """Response schema for invitation."""

    id: uuid.UUID
    npo_id: uuid.UUID
    invited_by_user_id: uuid.UUID
    status: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvitationWithTokenResponse(InvitationResponse):
    """Response schema for invitation with token (only returned on creation)."""

    token: str  # JWT token for acceptance


class PendingInvitationResponse(BaseModel):
    """Response schema for pending invitations (used in member list)."""

    id: uuid.UUID
    email: EmailStr
    role: MemberRole
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AcceptInvitationRequest(BaseModel):
    """Request schema for accepting an invitation."""

    invitation_id: uuid.UUID

"""Pydantic schemas for user management endpoints."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# ================================
# Request Schemas
# ================================


class UserCreateRequest(BaseModel):
    """Request schema for creating a new user (admin only)."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    organization_name: str | None = Field(None, max_length=255)
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    role: Literal["super_admin", "npo_admin", "event_coordinator", "staff", "donor"]
    npo_id: uuid.UUID | None = None

    @field_validator("email")
    @classmethod
    def email_must_be_lowercase(cls, v: str) -> str:
        """Ensure email is lowercase."""
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v

    @model_validator(mode="after")
    def validate_role_npo_id_combination(self) -> "UserCreateRequest":
        """Validate that role and npo_id combination is valid."""
        role = self.role
        npo_id = self.npo_id

        # NPO Admin and Event Coordinator MUST have npo_id
        if role in ["npo_admin", "event_coordinator"] and npo_id is None:
            raise ValueError(f"npo_id is required for {role} role")
        # Staff and Donor MUST NOT have npo_id
        if role in ["staff", "donor"] and npo_id is not None:
            raise ValueError(f"npo_id must not be provided for {role} role")

        return self


class RoleUpdateRequest(BaseModel):
    """Request schema for updating a user's role."""

    role: Literal["super_admin", "npo_admin", "event_coordinator", "staff", "donor"]
    npo_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_role_npo_id_combination(self) -> "RoleUpdateRequest":
        """Validate that role and npo_id combination is valid."""
        role = self.role
        npo_id = self.npo_id

        # NPO Admin and Event Coordinator MUST have npo_id
        if role in ["npo_admin", "event_coordinator"] and npo_id is None:
            raise ValueError(f"npo_id is required for {role} role")
        # Staff and Donor MUST NOT have npo_id
        if role in ["staff", "donor"] and npo_id is not None:
            raise ValueError(f"npo_id must not be provided for {role} role")

        return self


class UserUpdateRequest(BaseModel):
    """Request schema for updating user profile."""

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    organization_name: str | None = Field(None, max_length=255)
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    password: str | None = Field(None, min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        """Validate password strength if provided."""
        if v is None:
            return v
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


# ================================
# Response Schemas
# ================================


class UserPublicWithRole(BaseModel):
    """Public user information with role details."""

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    organization_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    role: str
    npo_id: uuid.UUID | None = None
    email_verified: bool
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """Paginated response for user list."""

    items: list[UserPublicWithRole]
    total: int
    page: int
    per_page: int
    total_pages: int


class UserActivateRequest(BaseModel):
    """Request schema for activating a user account."""

    is_active: bool

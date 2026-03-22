"""Pydantic schemas for password management.

T056: Schemas for password reset and change operations
"""

from pydantic import BaseModel, EmailStr, Field, field_validator


class PasswordResetRequest(BaseModel):
    """Schema for requesting password reset."""

    email: EmailStr = Field(
        ...,
        description="Email address of the account to reset",
        examples=["john.doe@example.com"],
    )


class PasswordResetConfirm(BaseModel):
    """Schema for confirming password reset with token."""

    token: str = Field(
        ...,
        min_length=1,
        description="Password reset token from email",
        examples=["xyz789abc123"],
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="New password (8-100 chars, must contain letter and number)",
        examples=["NewSecurePass456"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password contains at least one letter and one number."""
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class PasswordChangeRequest(BaseModel):
    """Schema for changing password (authenticated user)."""

    current_password: str | None = Field(
        None,
        description="Current password for verification",
        examples=["SecurePass123"],
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="New password (8-100 chars, must contain letter and number)",
        examples=["NewSecurePass456"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password contains at least one letter and one number."""
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v

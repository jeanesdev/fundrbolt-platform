"""Password management service.

T058: Service for password reset and change operations
"""

import hashlib
import logging
import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.email_service import get_email_service
from app.services.redis_service import RedisService
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)


class PasswordService:
    """Service for password management operations."""

    @staticmethod
    def generate_reset_token() -> str:
        """
        Generate a secure password reset token.

        Returns:
            URL-safe random token (32 bytes = 43 chars base64)
        """
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash_token(token: str) -> str:
        """
        Hash a token using SHA-256.

        Used to store token hashes in Redis instead of plain tokens.

        Args:
            token: Plain token string

        Returns:
            Hex-encoded SHA-256 hash
        """
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    async def request_reset(email: str, db: AsyncSession) -> bool:
        """
        Request password reset for user.

        Sends email with reset link if user exists.
        Always returns True (don't reveal if email exists).

        Args:
            email: User's email address
            db: Database session

        Returns:
            Always True (prevent email enumeration)
        """
        # Look up user by email
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()

        if not user:
            # Don't reveal that email doesn't exist
            logger.info(f"Password reset requested for non-existent email: {email}")
            return True

        # Generate reset token
        token = PasswordService.generate_reset_token()
        token_hash = PasswordService.hash_token(token)

        # Store token in Redis (1-hour expiry)
        await RedisService.store_password_reset_token(token_hash, user.id)

        # Send reset email
        email_service = get_email_service()
        await email_service.send_password_reset_email(
            to_email=user.email, reset_token=token, user_name=user.first_name
        )

        logger.info(f"Password reset requested for user: {user.id}")
        return True

    @staticmethod
    async def confirm_reset(token: str, new_password: str, db: AsyncSession) -> User:
        """
        Confirm password reset with token.

        Validates token, updates password, revokes all sessions.

        Args:
            token: Password reset token from email
            new_password: New password (already validated by Pydantic)
            db: Database session

        Returns:
            User object

        Raises:
            ValueError: If token is invalid or expired
        """
        # Hash token to look up in Redis
        token_hash = PasswordService.hash_token(token)

        # Get user ID from token (this also deletes the token - one-time use)
        user_id = await RedisService.get_password_reset_user(token_hash)
        if not user_id:
            raise ValueError("Invalid or expired reset token")

        # Get user from database
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Update password
        user.set_password(new_password)
        await db.commit()
        await db.refresh(user)

        # Revoke all active sessions (force re-login)
        await SessionService.revoke_all_user_sessions(db, user.id)

        logger.info(f"Password reset completed for user: {user.id}")
        return user

    @staticmethod
    async def change_password(
        user_id: UUID,
        current_password: str | None,
        new_password: str,
        current_jti: str,
        db: AsyncSession,
    ) -> User:
        """
        Change password for authenticated user.

        Validates current password, updates to new password.
        Revokes all sessions EXCEPT the current one.

        Args:
            user_id: User's UUID
            current_password: Current password for verification when the user
                already has a local password
            new_password: New password (already validated by Pydantic)
            current_jti: JTI of current session (to preserve)
            db: Database session

        Returns:
            User object

        Raises:
            ValueError: If current password is missing or incorrect
        """
        # Get user from database
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        if user.has_local_password:
            if not current_password:
                raise ValueError("Current password is required")
            if not user.verify_password(current_password):
                raise ValueError("Current password is incorrect")

        # Update password
        user.set_password(new_password)
        await db.commit()
        await db.refresh(user)

        # Revoke all sessions EXCEPT current one
        await SessionService.revoke_all_user_sessions(db, user.id, except_jti=current_jti)

        logger.info(f"Password changed for user: {user.id}")
        return user

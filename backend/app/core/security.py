"""Security utilities for JWT, password hashing, and token generation."""

import secrets
from datetime import datetime, timedelta
from typing import Any, cast

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    bcrypt has a 72-byte limit, passwords are automatically truncated.
    Uses 12 rounds for security.

    Args:
        password: Plain text password

    Returns:
        str: Hashed password

    Example:
        hashed = hash_password("SecurePassword123")
    """
    password_bytes = password.encode("utf-8")[:72]  # Truncate to 72 bytes
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash.

    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hash

    Returns:
        bool: True if password matches

    Example:
        is_valid = verify_password("SecurePassword123", hashed)
    """
    password_bytes = plain_password.encode("utf-8")[:72]  # Truncate to 72 bytes
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token.

    Args:
        data: Claims to encode in token (must include 'sub' for user ID)
        expires_delta: Optional custom expiration time

    Returns:
        str: Encoded JWT token

    Example:
        token = create_access_token(
            data={"sub": user_id, "role": "admin"},
            expires_delta=timedelta(minutes=15)
        )
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),  # JWT ID for blacklisting
            "type": "access",  # Token type for validation
        }
    )

    encoded_jwt: str = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_jwt


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT refresh token.

    Args:
        data: Claims to encode in token (must include 'sub' for user ID)
        expires_delta: Optional custom expiration time

    Returns:
        str: Encoded JWT refresh token

    Example:
        refresh = create_refresh_token(
            data={"sub": user_id},
            expires_delta=timedelta(days=7)
        )
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),
            "type": "refresh",
        }
    )

    encoded_jwt: str = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_jwt


def create_invitation_token(
    invitation_id: str,
    npo_id: str,
    email: str,
    npo_name: str,
    role: str,
    inviter_name: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> str:
    """Create a JWT token for NPO invitation.

    Args:
        invitation_id: UUID of the invitation
        npo_id: UUID of the NPO
        email: Email address of invitee
        npo_name: Name of the NPO organization
        role: Role being assigned (admin, co_admin, staff)
        inviter_name: Optional name of person sending invitation
        first_name: Optional first name to pre-fill registration
        last_name: Optional last name to pre-fill registration

    Returns:
        str: Encoded JWT invitation token (7-day expiry)

    Example:
        token = create_invitation_token(
            str(invitation.id), str(npo.id), "user@example.com",
            "Example NPO", "staff", "John Doe", "Jane", "Smith"
        )
    """
    to_encode: dict[str, str | datetime] = {
        "sub": invitation_id,
        "npo_id": npo_id,
        "email": email,
        "npo_name": npo_name,
        "role": role,
        "type": "invitation",
    }

    if inviter_name:
        to_encode["inviter_name"] = inviter_name

    if first_name:
        to_encode["first_name"] = first_name

    if last_name:
        to_encode["last_name"] = last_name

    expire = datetime.utcnow() + timedelta(days=7)

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),
        }
    )

    encoded_jwt: str = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_jwt


def decode_token(token: str, verify_expiration: bool = True) -> dict[str, Any]:
    """Decode and verify a JWT token.

    Args:
        token: JWT token string
        verify_expiration: Whether to verify token expiration (default: True)
                          Set to False for logout to allow expired tokens

    Returns:
        dict: Decoded token claims

    Raises:
        JWTError: If token is invalid or expired

    Example:
        try:
            claims = decode_token(token)
            user_id = claims["sub"]
        except JWTError:
            # Handle invalid token
    """
    options = {"verify_exp": verify_expiration} if not verify_expiration else {}

    return cast(
        dict[str, Any],
        jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options=options,
        ),
    )


def generate_verification_token() -> str:
    """Generate a cryptographically secure random token.

    Used for email verification and password reset.

    Returns:
        str: URL-safe random token (32 bytes = 43 characters base64)

    Example:
        token = generate_verification_token()
        # Store in Redis with TTL
    """
    return secrets.token_urlsafe(32)

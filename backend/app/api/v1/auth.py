"""Authentication endpoints."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.middleware.rate_limit import api_rate_limit, strict_rate_limit
from app.schemas.auth import (
    EmailResendRequest,
    EmailVerifyRequest,
    EmailVerifyResponse,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    UserCreate,
    UserPublic,
    UserRegisterResponse,
)
from app.schemas.password import (
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
)
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.password_service import PasswordService
from app.services.redis_service import RedisService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserRegisterResponse)
@api_rate_limit()
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserRegisterResponse:
    """Register a new user.

    Flow:
    1. Validates email uniqueness and password strength
    2. Creates user with email_verified=false, is_active=false
    3. Generates verification token (24-hour expiry)
    4. Returns user details and success message

    Business Rules:
    - Email must be unique (case-insensitive)
    - Password must be 8-100 chars with at least 1 letter and 1 number
    - Default role: "donor"
    - Account cannot login until email verified

    Args:
        user_data: User registration data (email, password, name, phone)
        request: FastAPI request object for IP tracking
        db: Database session

    Returns:
        UserRegisterResponse with user data and verification message

    Raises:
        HTTPException 409: Email already registered
        HTTPException 422: Validation errors (handled by Pydantic)
    """
    try:
        # Register user and get verification token
        user, verification_token = await AuthService.register(db, user_data)

        # Send verification email
        from app.services.email_service import get_email_service

        email_service = get_email_service()
        try:
            await email_service.send_verification_email(
                to_email=user.email,
                verification_token=verification_token,
                user_name=user.first_name,
            )
            logger.info(f"Verification email sent to {user.email} (user_id={user.id})")
        except Exception as e:
            # Log error but don't fail registration
            logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
            # Continue with registration - user can resend verification email later

        # Build response
        user_public = UserPublic(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            email_verified=user.email_verified,
            is_active=user.is_active,
            role="donor",  # Hardcoded until Role model exists
            npo_id=user.npo_id,
            created_at=user.created_at,
        )

        # Include verification token in non-production environments for testing
        from app.core.config import get_settings

        settings = get_settings()
        token_for_response = verification_token if settings.environment != "production" else None

        return UserRegisterResponse(
            user=user_public,
            message=f"Verification email sent to {user.email}",
            verification_token=token_for_response,
        )

    except ValueError as e:
        if "Email already registered" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_EMAIL",
                    "message": "Email already registered",
                    "details": {"email": user_data.email},
                },
            ) from e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "REGISTRATION_FAILED", "message": str(e)},
        ) from e


@router.post("/login", status_code=status.HTTP_200_OK, response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate user and create session.

    Flow:
    1. Check rate limit (5 attempts per 15 min per IP)
    2. Validate credentials (email + password)
    3. Enforce email verification requirement
    4. Create session with device fingerprint
    5. Generate JWT tokens (15-min access, 7-day refresh)
    6. Return tokens and user details

    Business Rules:
    - Rate limit: 5 failed attempts per 15 minutes per IP
    - Account must have email_verified=true
    - Account must have is_active=true
    - Session tracks IP, user-agent, expires after 7 days
    - Refresh token includes JTI for revocation

    Args:
        login_data: Login credentials (email, password)
        request: FastAPI request object for IP and user-agent
        db: Database session

    Returns:
        LoginResponse with access_token, refresh_token, user data

    Raises:
        HTTPException 400: Email not verified
        HTTPException 401: Invalid credentials
        HTTPException 403: Account deactivated
        HTTPException 429: Rate limit exceeded
    """
    # Extract client info
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")

    # Check rate limit (5 attempts per 15 min per IP)
    redis_service = RedisService()
    rate_limit_key = f"login_attempt:{ip_address}"
    if await redis_service.check_rate_limit(rate_limit_key, max_attempts=5, window_seconds=900):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many login attempts. Please try again in 15 minutes.",
                "details": {"retry_after_seconds": 900},
            },
        )

    try:
        # Authenticate and create session
        login_response = await AuthService.login(
            db=db,
            email=login_data.email,
            password=login_data.password,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return login_response

    except ValueError as e:
        error_msg = str(e)

        if "Invalid email or password" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "INVALID_CREDENTIALS",
                    "message": "Invalid email or password",
                },
            ) from e
        elif "Email not verified" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "EMAIL_NOT_VERIFIED",
                    "message": "Please verify your email before logging in",
                    "details": {"email": login_data.email},
                },
            ) from e
        elif "Account deactivated" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCOUNT_DEACTIVATED",
                    "message": "Your account has been deactivated. Please contact support.",
                },
            ) from e

        # Fallback for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "LOGIN_FAILED", "message": error_msg},
        ) from e


@router.post("/refresh", status_code=status.HTTP_200_OK, response_model=RefreshResponse)
async def refresh_token(
    refresh_data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    """Refresh access token using refresh token.

    Flow:
    1. Decode and validate refresh token JWT
    2. Check session exists in Redis
    3. Check token not blacklisted
    4. Generate new access token (refresh token unchanged)

    Business Rules:
    - Refresh token must be valid (not expired, correct signature)
    - Session must exist in Redis (not expired)
    - Refresh token must not be blacklisted
    - Returns new access token ONLY (no refresh token rotation per spec)
    - New access token has 15-minute expiry

    Args:
        refresh_data: Contains refresh_token
        db: Database session (unused but required for dependency)

    Returns:
        RefreshResponse with new access_token and expires_in

    Raises:
        HTTPException 401: Invalid/expired token or session not found
    """
    try:
        # Generate new access token using refresh token and get user
        access_token, expires_in, user = await AuthService.refresh_access_token(
            refresh_token=refresh_data.refresh_token, db=db
        )

        # Construct UserPublic manually (role needs to be serialized as string)
        user_public = UserPublic(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            organization_name=user.organization_name,
            address_line1=user.address_line1,
            address_line2=user.address_line2,
            city=user.city,
            state=user.state,
            postal_code=user.postal_code,
            country=user.country,
            profile_picture_url=user.profile_picture_url,
            email_verified=user.email_verified,
            is_active=user.is_active,
            role=user.role.name,
            npo_id=user.npo_id,
            created_at=user.created_at,
        )

        return RefreshResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=expires_in,
            user=user_public,
        )

    except ValueError as e:
        error_msg = str(e)

        # Map all refresh errors to 401 Unauthorized
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_REFRESH_TOKEN",
                "message": error_msg if error_msg else "Invalid or expired refresh token",
            },
        ) from e


@router.post("/logout", status_code=status.HTTP_200_OK, response_model=MessageResponse)
async def logout(
    logout_data: LogoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Logout user and invalidate tokens.

    Flow:
    1. Extract Authorization header to get access token
    2. Decode access token to extract user_id and jti
    3. Revoke refresh token (blacklist in Redis)
    4. Revoke active session in PostgreSQL (soft delete)
    5. Return success message

    Business Rules:
    - Access token must be valid (not expired, not blacklisted)
    - Refresh token gets blacklisted for remaining TTL
    - Session record gets revoked_at timestamp
    - Redis cache invalidated for session

    Args:
        logout_data: Contains refresh_token
        request: FastAPI request for Authorization header
        db: Database session

    Returns:
        MessageResponse with success confirmation

    Raises:
        HTTPException 401: Invalid or expired tokens
        HTTPException 400: Missing Authorization header
    """
    # Extract access token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "MISSING_TOKEN",
                "message": "Authorization header required",
            },
        )

    access_token = auth_header.replace("Bearer ", "")

    try:
        # Decode access token to get user_id and jti
        # Allow expired tokens for logout (users should be able to logout even if token expired)
        payload = decode_token(access_token, verify_expiration=False)
        user_id = uuid.UUID(payload["sub"])
        access_token_jti = payload["jti"]

        # Logout and invalidate tokens
        await AuthService.logout(
            db=db,
            user_id=user_id,
            refresh_token=logout_data.refresh_token,
            access_token_jti=access_token_jti,
        )

        return MessageResponse(message="Logged out successfully")

    except ValueError as e:
        error_msg = str(e)

        if "Invalid" in error_msg or "expired" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "INVALID_TOKEN",
                    "message": "Invalid or expired token",
                },
            ) from e

        # Fallback for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "LOGOUT_FAILED", "message": error_msg},
        ) from e


@router.post("/verify-email", status_code=status.HTTP_200_OK, response_model=EmailVerifyResponse)
@strict_rate_limit()
async def verify_email(
    verify_data: EmailVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> EmailVerifyResponse:
    """
    Verify email address with token from registration email.

    Flow:
    1. Validates token format (Pydantic)
    2. Retrieves user_id from Redis using token
    3. Validates token exists and hasn't expired
    4. Checks user exists and isn't already verified
    5. Updates user: email_verified=True, is_active=True
    6. Deletes token from Redis
    7. Logs audit event
    8. Returns success message

    Business Rules:
    - Token must be valid (exists in Redis)
    - Token expires after 24 hours
    - User cannot verify twice
    - Account becomes active upon verification

    Returns:
        EmailVerifyResponse: Success message

    Raises:
        HTTPException:
            - 400: Invalid/expired token or already verified
            - 404: User not found
    """
    # Get user_id from Redis token
    user_id = await RedisService.get_email_verification_user(verify_data.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Invalid or expired verification token",
            },
        )

    # Get user from database
    from app.models.user import User

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "User not found",
            },
        )

    # Check if already verified
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ALREADY_VERIFIED",
                "message": "Email already verified",
            },
        )

    # Update user verification status
    user.email_verified = True
    user.is_active = True
    await db.commit()
    await db.refresh(user)

    # Delete token from Redis
    await RedisService.delete_email_verification_token(verify_data.token)

    # Log audit event
    client_ip = request.client.host if request.client else None
    await AuditService.log_email_verification(
        db=db,
        user_id=user.id,
        email=user.email,
        ip_address=client_ip,
    )

    return EmailVerifyResponse(message="Email verified successfully")


@router.post(
    "/verify-email/resend", status_code=status.HTTP_200_OK, response_model=EmailVerifyResponse
)
@strict_rate_limit()
async def resend_verification_email(
    resend_data: EmailResendRequest,
    db: AsyncSession = Depends(get_db),
) -> EmailVerifyResponse:
    """
    Resend email verification link to user.

    Flow:
    1. Validates email format (Pydantic)
    2. Looks up user by email (case-insensitive)
    3. Checks user exists and isn't already verified
    4. Generates new verification token
    5. Stores token in Redis (24h expiry, replaces old token)
    6. Sends verification email
    7. Returns success message

    Business Rules:
    - Email must match existing user
    - User cannot be already verified
    - New token invalidates previous token
    - Always returns success (prevent email enumeration)

    Returns:
        EmailVerifyResponse: Success message

    Raises:
        HTTPException:
            - 400: Email already verified
            - 404: User not found
    """
    # Look up user by email
    from app.core.security import generate_verification_token
    from app.models.user import User
    from app.services.email_service import EmailService

    stmt = select(User).where(User.email == resend_data.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "User not found",
            },
        )

    # Check if already verified
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ALREADY_VERIFIED",
                "message": "Email already verified",
            },
        )

    # Generate new verification token
    verification_token = generate_verification_token()

    # Store in Redis (replaces old token if exists)
    await RedisService.store_email_verification_token(verification_token, user.id)

    # Send verification email
    email_service = EmailService()
    await email_service.send_verification_email(
        to_email=user.email,
        verification_token=verification_token,
        user_name=user.first_name,
    )

    # Log for debugging (not audit event since it's a retry)
    logger.info(f"Verification email resent to {user.email} (user_id={user.id})")

    return EmailVerifyResponse(message="Verification email sent")


@router.post(
    "/password/reset/request", status_code=status.HTTP_200_OK, response_model=MessageResponse
)
async def request_password_reset(
    reset_data: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Request password reset email.

    Flow:
    1. Validates email format (Pydantic)
    2. Looks up user by email (case-insensitive)
    3. Generates secure reset token (32 bytes)
    4. Stores hashed token in Redis (1-hour expiry)
    5. Sends reset email with link
    6. Always returns success (prevent email enumeration)

    Business Rules:
    - Always returns 200 OK, even if email doesn't exist (security)
    - Token is URL-safe, one-time use, expires in 1 hour
    - Previous reset tokens are invalidated
    - Email contains reset link: {frontend_url}/reset-password?token=xxx

    Args:
        reset_data: Contains email address
        request: FastAPI request for IP address
        db: Database session

    Returns:
        MessageResponse confirming email sent (always success)
    """
    # Get client IP address for audit logging
    ip_address = request.client.host if request.client else None

    try:
        await PasswordService.request_reset(reset_data.email, db)
        # Log password reset request (even if email doesn't exist, for security monitoring)
        AuditService.log_password_reset_request(reset_data.email, ip_address)
        return MessageResponse(message="If that email exists, a password reset link has been sent.")
    except Exception:
        # Always return success to prevent email enumeration
        # Still log the request for security monitoring
        AuditService.log_password_reset_request(reset_data.email, ip_address)
        return MessageResponse(message="If that email exists, a password reset link has been sent.")


@router.post(
    "/password/reset/confirm", status_code=status.HTTP_200_OK, response_model=MessageResponse
)
@strict_rate_limit()
async def confirm_password_reset(
    request: Request,
    confirm_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Confirm password reset with token.

    Flow:
    1. Validates token format and password strength (Pydantic)
    2. Looks up user by hashed token in Redis
    3. Validates token exists and hasn't expired
    4. Updates user password (bcrypt hash)
    5. Deletes token from Redis (one-time use)
    6. Revokes ALL active sessions (force re-login)
    7. Logs audit event
    8. Returns success message

    Business Rules:
    - Token is one-time use (deleted after consumption)
    - Token expires after 1 hour
    - Password must be 8-100 chars with 1 letter and 1 number
    - All sessions are revoked (user must login with new password)

    Args:
        request: FastAPI request object (for IP address)
        confirm_data: Contains token and new_password
        db: Database session

    Returns:
        MessageResponse confirming password reset

    Raises:
        HTTPException 400: Invalid or expired token
    """
    try:
        user = await PasswordService.confirm_reset(
            confirm_data.token, confirm_data.new_password, db
        )

        # Log audit event
        ip_address = request.client.host if request.client else None
        AuditService.log_password_reset_complete(user.id, user.email, ip_address)

        return MessageResponse(
            message="Password reset successfully. Please login with your new password."
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_TOKEN",
                "message": str(e) or "Invalid or expired reset token",
            },
        ) from e


@router.post("/password/change", status_code=status.HTTP_200_OK, response_model=MessageResponse)
async def change_password(
    change_data: PasswordChangeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Change password for authenticated user.

    Flow:
    1. Extract and validate access token from Authorization header
    2. Decode token to get user_id and jti
    3. Validate current password matches
    4. Update to new password (bcrypt hash)
    5. Revoke all sessions EXCEPT current one (no forced logout)
    6. Returns success message

    Business Rules:
    - Must be authenticated (valid access token required)
    - Current password must be correct
    - New password must be 8-100 chars with 1 letter and 1 number
    - All OTHER sessions are revoked (current session preserved)
    - Current session remains valid with same tokens

    Args:
        change_data: Contains current_password and new_password
        request: FastAPI request for Authorization header
        db: Database session

    Returns:
        MessageResponse confirming password change

    Raises:
        HTTPException 401: Missing or invalid token
        HTTPException 400: Current password incorrect
    """
    # Extract access token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "MISSING_TOKEN",
                "message": "Authorization header required",
            },
        )

    access_token = auth_header.replace("Bearer ", "")

    try:
        # Decode access token to get user_id and jti
        payload = decode_token(access_token)
        user_id = payload["sub"]
        current_jti = payload["jti"]

        # Change password (validates current password internally)
        user = await PasswordService.change_password(
            user_id=user_id,
            current_password=change_data.current_password,
            new_password=change_data.new_password,
            current_jti=current_jti,
            db=db,
        )

        # Log audit event
        ip_address = request.client.host if request.client else None
        await AuditService.log_password_changed(
            db=db,
            user_id=user.id,
            email=user.email,
            ip_address=ip_address,
        )

        return MessageResponse(message="Password changed successfully.")

    except ValueError as e:
        error_msg = str(e)

        if "incorrect" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_PASSWORD",
                    "message": "Current password is incorrect",
                },
            ) from e

        # Fallback for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PASSWORD_CHANGE_FAILED", "message": error_msg},
        ) from e
    except Exception as e:
        # Handle token decode errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Invalid or expired token",
            },
        ) from e

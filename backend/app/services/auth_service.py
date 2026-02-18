"""Authentication service for user registration, login, and logout."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_verification_token,
)
from app.models.npo import NPO
from app.models.npo_member import MemberStatus, NPOMember
from app.models.user import User
from app.schemas.auth import LoginResponse, UserCreate, UserPublic
from app.schemas.users import NPOMembershipInfo
from app.services.redis_service import RedisService
from app.services.session_service import SessionService


class AuthService:
    """Service for authentication operations.

    Handles:
    - User registration with email verification
    - Login with JWT token generation
    - Logout with session revocation
    - Token refresh
    """

    @staticmethod
    async def get_active_npo_memberships(
        db: AsyncSession, user_id: uuid.UUID
    ) -> list[NPOMembershipInfo]:
        member_stmt = (
            select(NPOMember, NPO.name)
            .join(NPO, NPOMember.npo_id == NPO.id)
            .where(NPOMember.user_id == user_id)
            .where(NPOMember.status == MemberStatus.ACTIVE)
        )
        member_result = await db.execute(member_stmt)
        return [
            NPOMembershipInfo(
                npo_id=member.npo_id,
                npo_name=npo_name,
                role=member.role.value,
                status=member.status.value,
            )
            for member, npo_name in member_result.all()
        ]

    @staticmethod
    async def register(
        db: AsyncSession,
        user_data: UserCreate,
    ) -> tuple[User, str]:
        """Register new user with "donor" role.

        Flow:
        1. Check email uniqueness
        2. Create user with email_verified=false, is_active=false
        3. Generate verification token and store in Redis
        4. Return user and token (caller sends email)

        Args:
            db: Database session
            user_data: User registration data

        Returns:
            Tuple of (User model, verification token)

        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists (case-insensitive)
        stmt = select(User).where(User.email == user_data.email.lower())
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise ValueError("Email already registered")

        # Get donor role ID
        from app.models.base import Base  # Import here to avoid circular import

        # For now, we'll need to fetch the role_id separately
        # This will be cleaner once we have a Role model
        donor_role_stmt = select(Base.metadata.tables["roles"].c.id).where(
            Base.metadata.tables["roles"].c.name == "donor"
        )
        role_result = await db.execute(donor_role_stmt)
        donor_role_id = role_result.scalar_one()

        # Create user
        user = User(
            email=user_data.email.lower(),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            organization_name=user_data.organization_name,
            address_line1=user_data.address_line1,
            address_line2=user_data.address_line2,
            city=user_data.city,
            state=user_data.state,
            postal_code=user_data.postal_code,
            country=user_data.country,
            email_verified=False,
            is_active=False,
            role_id=donor_role_id,
        )

        # Set password (hashes internally)
        user.set_password(user_data.password)

        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Generate verification token
        verification_token = generate_verification_token()
        await RedisService.store_email_verification_token(verification_token, user.id)

        return user, verification_token

    @staticmethod
    async def login(
        db: AsyncSession,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> LoginResponse:
        """Authenticate user and return JWT tokens.

        Flow:
        1. Validate email/password
        2. Check email verified and account active
        3. Generate access + refresh tokens
        4. Create session in PostgreSQL + Redis
        5. Update last_login_at

        Args:
            db: Database session
            email: User email
            password: Plain text password
            ip_address: Optional IP address for session tracking
            user_agent: Optional user agent for session tracking

        Returns:
            LoginResponse with tokens and user data

        Raises:
            ValueError: With specific error codes:
                - INVALID_CREDENTIALS: Wrong email/password
                - EMAIL_NOT_VERIFIED: Email not verified
                - ACCOUNT_DEACTIVATED: Account is inactive
        """
        # Fetch user by email
        stmt = select(User).where(User.email == email.lower())
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        # Check credentials
        if not user or not user.verify_password(password):
            raise ValueError("Invalid email or password")

        # Check email verification
        if not user.email_verified:
            raise ValueError("Email not verified")

        # Check account active
        if not user.is_active:
            raise ValueError("Account deactivated")

        # Create JWT tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": str(user.role_id),  # Will be role name once we have Role model
        }

        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        # Extract JTI from refresh token for session tracking
        refresh_payload = decode_token(refresh_token)
        refresh_jti = refresh_payload["jti"]

        # Create session
        await SessionService.create_session(
            db=db,
            user_id=user.id,
            refresh_token_jti=refresh_jti,
            device_info=user_agent,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Update last login timestamp
        user.last_login_at = datetime.utcnow()
        await db.commit()

        # Refresh to load role relationship
        await db.refresh(user, ["role"])

        # Build response
        npo_memberships = await AuthService.get_active_npo_memberships(db, user.id)
        primary_npo_id = npo_memberships[0].npo_id if len(npo_memberships) == 1 else None
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
            role=user.role.name,  # Get role name from relationship
            npo_id=primary_npo_id,
            npo_memberships=npo_memberships,
            created_at=user.created_at,
        )

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=900,  # 15 minutes
            user=user_public,
        )

    @staticmethod
    async def logout(
        db: AsyncSession,
        user_id: uuid.UUID,
        refresh_token: str,
        access_token_jti: str | None = None,
    ) -> bool:
        """Logout user and revoke session.

        Flow:
        1. Extract JTI from refresh token
        2. Revoke session in PostgreSQL + Redis
        3. Blacklist access token JTI in Redis (optional)

        Args:
            db: Database session
            user_id: User UUID
            refresh_token: Refresh token to revoke
            access_token_jti: Optional access token JTI to blacklist

        Returns:
            True if logout successful

        Raises:
            ValueError: If refresh token invalid
        """
        try:
            # Decode refresh token to get JTI
            payload = decode_token(refresh_token)
            refresh_jti = payload["jti"]
            token_user_id = uuid.UUID(payload["sub"])

            # Verify token belongs to user
            if token_user_id != user_id:
                raise ValueError("Token does not belong to user")

        except Exception as e:
            raise ValueError(f"Invalid refresh token: {e}") from e

        # Revoke session
        revoked = await SessionService.revoke_session(
            db=db,
            user_id=user_id,
            refresh_token_jti=refresh_jti,
        )

        # Blacklist access token if provided
        if access_token_jti:
            await RedisService.blacklist_token(access_token_jti)

        return revoked

    @staticmethod
    async def refresh_access_token(
        refresh_token: str,
        db: AsyncSession,
    ) -> tuple[str, int, User]:
        """Generate new access token from valid refresh token.

        Flow:
        1. Decode and validate refresh token
        2. Check session exists in Redis
        3. Check token not blacklisted
        4. Fetch user from database
        5. Generate new access token

        Args:
            refresh_token: Valid refresh token
            db: Database session

        Returns:
            Tuple of (new access token, expires_in seconds, user)

        Raises:
            ValueError: If refresh token invalid or session not found
        """
        try:
            # Decode refresh token
            payload = decode_token(refresh_token)
            user_id = uuid.UUID(payload["sub"])
            refresh_jti = payload["jti"]

            # Check if refresh token is blacklisted
            if await RedisService.is_token_blacklisted(refresh_jti):
                raise ValueError("Refresh token has been revoked")

            # Check if session exists in Redis
            session = await RedisService.get_session(user_id, refresh_jti)
            if not session:
                raise ValueError("Session not found or expired")

            # Fetch user from database with eager loading of role
            from sqlalchemy.orm import joinedload

            stmt = select(User).options(joinedload(User.role)).where(User.id == user_id)
            result = await db.execute(stmt)
            user = result.unique().scalar_one_or_none()
            if not user:
                raise ValueError("User not found")

            # Generate new access token
            token_data = {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role.name,
            }
            access_token = create_access_token(data=token_data)

            return access_token, 900, user  # 15 minutes

        except Exception as e:
            raise ValueError(f"Invalid refresh token: {e}") from e

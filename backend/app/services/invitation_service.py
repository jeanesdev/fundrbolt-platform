"""
Invitation service for managing NPO team invitations.

Handles invitation lifecycle:
- Creating invitations with tokens
- Validating and accepting invitations
- Revoking invitations
- Automatic expiry handling
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.event_media_urls import resolve_event_logo_url
from app.core.logging import get_logger
from app.core.security import create_invitation_token, decode_token, hash_password, verify_password
from app.models.base import Base
from app.models.event import Event
from app.models.invitation import Invitation, InvitationStatus
from app.models.npo import NPO
from app.models.npo_branding import NPOBranding
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.email_service import EmailSendError, get_email_service
from app.services.password_service import PasswordService
from app.services.redis_service import RedisService

logger = get_logger(__name__)

# Maps NPO member role (used in invitations) to user system role
_SYSTEM_ROLE_BY_MEMBER_ROLE: dict[str, str] = {
    "admin": "npo_admin",
    "co_admin": "npo_admin",
    "staff": "event_coordinator",
    "auctioneer": "auctioneer",
}


class InvitationService:
    """Service for managing NPO invitations."""

    @staticmethod
    async def create_invitation(
        db: AsyncSession,
        npo_id: uuid.UUID,
        email: str,
        role: str,
        invited_by_user_id: uuid.UUID,
        first_name: str | None = None,
        last_name: str | None = None,
        message: str | None = None,
        event_id: uuid.UUID | None = None,
    ) -> Invitation:
        """
        Create a new invitation.

        For users with no existing account the account is created immediately,
        added to the NPO, and an account-setup email is sent so they can set
        their password.  The invitation is marked ACCEPTED right away.

        For users who already have an account the traditional invitation email
        is sent and they accept it via the link.

        Args:
            db: Database session
            npo_id: NPO UUID
            email: Email address to invite
            role: Role to assign (admin, co_admin, staff, auctioneer)
            invited_by_user_id: User creating the invitation
            first_name: Optional first name to pre-fill registration
            last_name: Optional last name to pre-fill registration
            message: Optional custom message
            event_id: Optional event UUID for event-scoped invitations

        Returns:
            Created Invitation

        Raises:
            HTTPException: If user is already a member or validation fails
        """
        # Validate email is not already a member
        user_stmt = select(User).where(User.email == email.lower())
        result = await db.execute(user_stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # Check if already a member
            member_stmt = select(NPOMember).where(
                NPOMember.npo_id == npo_id,
                NPOMember.user_id == existing_user.id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
            result = await db.execute(member_stmt)
            existing_member = result.scalar_one_or_none()

            if existing_member:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"User with email {email} is already a member of this organization",
                )

        # Check for pending invitation (only relevant for existing-user flow)
        pending_stmt = select(Invitation).where(
            Invitation.npo_id == npo_id,
            Invitation.email == email.lower(),
            Invitation.status == InvitationStatus.PENDING,
        )
        result = await db.execute(pending_stmt)
        pending_invitation = result.scalar_one_or_none()

        if pending_invitation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An invitation is already pending for {email}",
            )

        # Get NPO and inviter details
        npo_stmt = select(NPO).where(NPO.id == npo_id)
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one()

        inviter_stmt = select(User).where(User.id == invited_by_user_id)
        inviter_result = await db.execute(inviter_stmt)
        inviter = inviter_result.scalar_one()

        inviter_name = f"{inviter.first_name} {inviter.last_name}" if inviter.first_name else None

        # Resolve logos for the email header: event logo > NPO logo > FundrBolt default
        event_logo_url: str | None = None
        event_name: str | None = None
        if event_id:
            event_result = await db.execute(
                select(Event).options(selectinload(Event.media)).where(Event.id == event_id)
            )
            event_obj = event_result.scalar_one_or_none()
            if event_obj:
                event_logo_url = resolve_event_logo_url(event_obj)
                event_name = event_obj.name

        npo_logo_url: str | None = None
        branding_result = await db.execute(
            select(NPOBranding.logo_url).where(NPOBranding.npo_id == npo_id)
        )
        npo_logo_url = branding_result.scalar_one_or_none()

        # Create invitation record
        invitation = Invitation(
            npo_id=npo_id,
            email=email.lower(),
            role=role,
            first_name=first_name,
            last_name=last_name,
            invited_by_user_id=invited_by_user_id,
            status=InvitationStatus.PENDING,
            expires_at=datetime.now(UTC) + timedelta(days=7),
            token_hash="temp",  # Temporary, will be updated below
            event_id=event_id,
        )
        db.add(invitation)
        await db.flush()

        # Generate JWT token and hash it (needed for the invitation record regardless of path)
        token = create_invitation_token(
            invitation_id=str(invitation.id),
            npo_id=str(npo_id),
            email=email.lower(),
            npo_name=npo.name,
            role=role,
            inviter_name=inviter_name,
            first_name=first_name,
            last_name=last_name,
            event_id=str(event_id) if event_id else None,
        )
        invitation.token_hash = hash_password(token)

        # Store token on invitation object for API response (not persisted)
        invitation.token = token  # type: ignore[attr-defined]

        email_service = get_email_service()

        if not existing_user:
            # ----------------------------------------------------------------
            # New user: create account + NPO membership immediately, then
            # send an account-setup email so they can set their password.
            # ----------------------------------------------------------------

            # Derive names from invitation data or email address
            email_local = email.split("@")[0]
            parts = email_local.replace(".", " ").replace("_", " ").split()
            derived_first = parts[0].capitalize() if parts else email_local
            derived_last = parts[1].capitalize() if len(parts) > 1 else ""

            user_first_name = first_name or derived_first
            user_last_name = last_name or derived_last

            # Map NPO member role → user system role
            system_role = _SYSTEM_ROLE_BY_MEMBER_ROLE.get(role, "event_coordinator")

            # Get system role ID
            roles_table = Base.metadata.tables["roles"]
            role_id_result = await db.execute(
                select(roles_table.c.id).where(roles_table.c.name == system_role)
            )
            role_id = role_id_result.scalar_one_or_none()
            if not role_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"System role '{system_role}' not found",
                )

            # Create the user account (inactive until they complete setup)
            new_user = User(
                email=email.lower(),
                first_name=user_first_name,
                last_name=user_last_name,
                password_hash=hash_password(f"Tmp{secrets.token_urlsafe(10)}1"),
                role_id=role_id,
                must_change_password=True,
                email_verified=False,
                is_active=False,
            )
            db.add(new_user)
            await db.flush()

            # Add NPO membership with the exact invited role
            db.add(
                NPOMember(
                    npo_id=npo_id,
                    user_id=new_user.id,
                    role=MemberRole(role),
                    status=MemberStatus.ACTIVE,
                )
            )

            # Accept the invitation immediately
            invitation.invited_user_id = new_user.id
            invitation.status = InvitationStatus.ACCEPTED
            invitation.accepted_at = datetime.now(UTC)

            await db.commit()
            await db.refresh(invitation)

            # Generate and store account-setup token (reuses password-reset infrastructure)
            setup_token = PasswordService.generate_reset_token()
            token_hash = PasswordService.hash_token(setup_token)
            await RedisService.store_password_reset_token(token_hash, new_user.id)

            await email_service.send_account_setup_email(
                to_email=email,
                setup_token=setup_token,
                user_name=user_first_name,
                role=system_role,
                event_logo_url=event_logo_url,
                npo_logo_url=npo_logo_url,
                event_name=event_name,
                npo_name=npo.name,
                inviter_name=inviter_name,
            )
        else:
            # ----------------------------------------------------------------
            # Existing user: send the traditional invitation email so they
            # can click through and accept (joining the NPO).
            # ----------------------------------------------------------------
            await db.commit()
            await db.refresh(invitation)

            await email_service.send_npo_member_invitation_email(
                to_email=email,
                invitation_token=token,
                npo_name=npo.name,
                role=role,
                invited_by_name=inviter_name,
                event_logo_url=event_logo_url,
                npo_logo_url=npo_logo_url,
                event_name=event_name,
            )

        return invitation

    @staticmethod
    async def get_pending_invitations(
        db: AsyncSession,
        npo_id: uuid.UUID,
    ) -> list[Invitation]:
        """
        Get all pending invitations for an NPO.

        Args:
            db: Database session
            npo_id: NPO UUID

        Returns:
            List of pending Invitation objects

        Note:
            Only returns invitations that are PENDING and not expired
        """
        stmt = (
            select(Invitation)
            .where(
                Invitation.npo_id == npo_id,
                Invitation.status == InvitationStatus.PENDING,
                Invitation.expires_at > datetime.now(UTC),
            )
            .order_by(Invitation.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def resend_invitation(
        db: AsyncSession,
        invitation_id: uuid.UUID,
        npo_id: uuid.UUID,
        resent_by_user_id: uuid.UUID,
    ) -> Invitation:
        """
        Resend an invitation with a new token and extended expiry.

        Args:
            db: Database session
            invitation_id: Invitation UUID to resend
            npo_id: NPO UUID (for authorization check)
            resent_by_user_id: User resending the invitation

        Returns:
            Updated Invitation object

        Raises:
            HTTPException: If invitation not found, not pending, or email fails
        """
        # Get invitation
        stmt = select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.npo_id == npo_id,
        )
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )

        # Check status - only pending invitations can be resent
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot resend invitation with status: {invitation.status}",
            )

        # Get NPO and resender details for token and email
        npo_stmt = select(NPO).where(NPO.id == npo_id)
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one()

        resender_stmt = select(User).where(User.id == resent_by_user_id)
        resender_result = await db.execute(resender_stmt)
        resender = resender_result.scalar_one()

        resender_name = (
            f"{resender.first_name} {resender.last_name}" if resender.first_name else None
        )

        # Generate new JWT token and hash it
        token = create_invitation_token(
            invitation_id=str(invitation.id),
            npo_id=str(npo_id),
            email=invitation.email,
            npo_name=npo.name,
            role=invitation.role,
            inviter_name=resender_name,
            first_name=invitation.first_name,
            last_name=invitation.last_name,
        )
        invitation.token_hash = hash_password(token)

        # Extend expiry by 7 days from now
        invitation.expires_at = datetime.now(UTC) + timedelta(days=7)

        await db.commit()
        await db.refresh(invitation)

        # Store token on invitation object for API response (not persisted)
        invitation.token = token  # type: ignore[attr-defined]

        # Resolve logos for the email header: event logo > NPO logo > FundrBolt default
        event_logo_url: str | None = None
        event_name: str | None = None
        if invitation.event_id:
            event_result = await db.execute(
                select(Event)
                .options(selectinload(Event.media))
                .where(Event.id == invitation.event_id)
            )
            event_obj = event_result.scalar_one_or_none()
            if event_obj:
                event_logo_url = resolve_event_logo_url(event_obj)
                event_name = event_obj.name

        npo_logo_url: str | None = None
        branding_result = await db.execute(
            select(NPOBranding.logo_url).where(NPOBranding.npo_id == npo_id)
        )
        npo_logo_url = branding_result.scalar_one_or_none()

        # Send invitation email
        email_service = get_email_service()
        await email_service.send_npo_member_invitation_email(
            to_email=invitation.email,
            invitation_token=token,
            npo_name=npo.name,
            role=invitation.role,
            invited_by_name=resender_name,
            event_logo_url=event_logo_url,
            npo_logo_url=npo_logo_url,
            event_name=event_name,
        )

        return invitation

    @staticmethod
    async def accept_invitation(
        db: AsyncSession,
        invitation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> NPOMember:
        """
        Accept an invitation and create member.

        Args:
            db: Database session
            invitation_id: Invitation UUID (used as token)
            user_id: User accepting the invitation

        Returns:
            Created NPOMember

        Raises:
            HTTPException: If invitation is invalid, expired, or already used
        """
        # Get invitation
        stmt = select(Invitation).where(Invitation.id == invitation_id)
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )

        # Check if expired
        if invitation.expires_at < datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Invitation has expired",
            )

        # Check status
        if invitation.status == InvitationStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invitation has already been accepted",
            )

        if invitation.status == InvitationStatus.REVOKED:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Invitation has been revoked",
            )

        # Check if user is already a member
        member_stmt = select(NPOMember).where(
            NPOMember.npo_id == invitation.npo_id,
            NPOMember.user_id == user_id,
            NPOMember.status == MemberStatus.ACTIVE,
        )
        member_result = await db.execute(member_stmt)
        existing_member = member_result.scalar_one_or_none()

        member: NPOMember
        if existing_member:
            # For auctioneer role, update existing member's role instead of rejecting
            if invitation.role == "auctioneer":
                existing_member.role = MemberRole.AUCTIONEER
                member = existing_member
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You are already a member of this organization",
                )
        else:
            # Create member
            member = NPOMember(
                npo_id=invitation.npo_id,
                user_id=user_id,
                role=MemberRole(invitation.role),
                status=MemberStatus.ACTIVE,
            )
            db.add(member)

        # Get user for audit logging
        user_stmt = select(User).where(User.id == user_id)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one()

        # Update invitation status
        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(member)

        # Log audit event
        await AuditService.log_npo_member_added(
            db=db,
            npo_id=invitation.npo_id,
            npo_name=invitation.npo.name,
            member_user_id=user_id,
            member_email=user.email,
            role=invitation.role,
            added_by_user_id=invitation.invited_by_user_id,
        )

        # Send notification email to NPO admins
        email_service = get_email_service()
        try:
            # Get all admins for this NPO
            admin_stmt = (
                select(NPOMember, User)
                .join(User, NPOMember.user_id == User.id)
                .where(
                    NPOMember.npo_id == invitation.npo_id,
                    NPOMember.role == MemberRole.ADMIN,
                    NPOMember.status == MemberStatus.ACTIVE,
                )
            )
            admin_result = await db.execute(admin_stmt)
            admins = admin_result.all()

            member_name = f"{user.first_name} {user.last_name}" if user.first_name else user.email

            # Send email to each admin
            for _admin_member, admin_user in admins:
                await email_service.send_npo_invitation_accepted_email(
                    to_email=admin_user.email,
                    npo_name=invitation.npo.name,
                    member_name=member_name,
                    member_role=invitation.role,
                )
        except EmailSendError as e:
            # Log error but don't fail the acceptance
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                f"Failed to send acceptance notification email: {e}",
                extra={"npo_id": str(invitation.npo_id), "member_id": str(member.id)},
            )

        return member

    @staticmethod
    async def accept_invitation_by_token(
        db: AsyncSession,
        token: str,
        user_id: uuid.UUID | None = None,
    ) -> NPOMember:
        """
        Accept an invitation using JWT token.

        Args:
            db: Database session
            token: JWT invitation token
            user_id: Optional user accepting the invitation. If omitted, the
                user is resolved from the invitation email claim.

        Returns:
            Created NPOMember

        Raises:
            HTTPException: If token is invalid, expired, or invitation already used
        """
        # Decode and validate JWT token
        try:
            claims = decode_token(token)
        except (jwt.DecodeError, jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invitation token",
            )

        if claims.get("type") != "invitation":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invitation token",
            )

        # Extract invitation ID from token
        invitation_id_str = claims.get("sub")
        if not invitation_id_str:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invitation token",
            )

        try:
            invitation_id = uuid.UUID(invitation_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invitation token",
            )

        stmt = select(Invitation).where(Invitation.id == invitation_id)
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation or not verify_password(token, invitation.token_hash):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invitation token",
            )

        if user_id is None:
            invite_email = claims.get("email")
            if not invite_email:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Invalid invitation token",
                )

            user_result = await db.execute(select(User).where(User.email == invite_email.lower()))
            user = user_result.scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No user found with the invitation email. Please create an account first.",
                )
            user_id = user.id

        # Use existing accept_invitation logic
        return await InvitationService.accept_invitation(
            db=db,
            invitation_id=invitation_id,
            user_id=user_id,
        )

    @staticmethod
    async def revoke_invitation(
        db: AsyncSession,
        invitation_id: uuid.UUID,
        revoked_by_user_id: uuid.UUID,
    ) -> Invitation:
        """
        Revoke a pending invitation.

        Args:
            db: Database session
            invitation_id: Invitation UUID
            revoked_by_user_id: User revoking the invitation

        Returns:
            Updated Invitation

        Raises:
            HTTPException: If invitation not found or cannot be revoked
        """
        stmt = select(Invitation).where(Invitation.id == invitation_id)
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found",
            )

        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending invitations can be revoked",
            )

        invitation.status = InvitationStatus.REVOKED
        await db.commit()
        await db.refresh(invitation)

        # Log audit event using existing audit service method
        await AuditService.log_npo_member_removed(
            db=db,
            npo_id=invitation.npo_id,
            npo_name=invitation.npo.name,
            member_user_id=invitation.invited_user_id
            or uuid.UUID(int=0),  # Placeholder if no user yet
            member_email=invitation.email,
            removed_by_user_id=revoked_by_user_id,
            reason="Invitation revoked",
        )

        return invitation

    @staticmethod
    async def get_npo_invitations(
        db: AsyncSession,
        npo_id: uuid.UUID,
        status_filter: InvitationStatus | None = None,
    ) -> list[Invitation]:
        """
        Get all invitations for an NPO.

        Args:
            db: Database session
            npo_id: NPO UUID
            status_filter: Optional status filter

        Returns:
            List of Invitations
        """
        stmt = select(Invitation).where(Invitation.npo_id == npo_id)

        if status_filter:
            stmt = stmt.where(Invitation.status == status_filter)

        stmt = stmt.order_by(Invitation.created_at.desc())

        result = await db.execute(stmt)
        return list(result.scalars().all())

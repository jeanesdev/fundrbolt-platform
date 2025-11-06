"""Service for NPO member management."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.npo import NPO
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.services.audit_service import AuditService


class MemberService:
    """Service for managing NPO members."""

    @staticmethod
    async def get_members(
        db: AsyncSession,
        npo_id: uuid.UUID,
        role_filter: MemberRole | None = None,
    ) -> list[NPOMember]:
        """
        Get all members for an NPO.

        Args:
            db: Database session
            npo_id: NPO ID
            role_filter: Optional role filter

        Returns:
            List of NPOMember objects
        """
        stmt = (
            select(NPOMember)
            .where(
                NPOMember.npo_id == npo_id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(NPOMember.user))
            .order_by(NPOMember.created_at)
        )

        if role_filter:
            stmt = stmt.where(NPOMember.role == role_filter)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update_member(
        db: AsyncSession,
        npo_id: uuid.UUID,
        member_id: uuid.UUID,
        new_role: MemberRole,
        updated_by_user_id: uuid.UUID,
    ) -> NPOMember:
        """
        Update member role.

        Args:
            db: Database session
            npo_id: NPO ID
            member_id: Member ID to update
            new_role: New role to assign
            updated_by_user_id: User performing the update

        Returns:
            Updated NPOMember

        Raises:
            HTTPException: If member not found or is the primary admin
        """
        # Get member
        stmt = (
            select(NPOMember)
            .where(
                NPOMember.id == member_id,
                NPOMember.npo_id == npo_id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(NPOMember.user))
        )
        result = await db.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found",
            )

        # Check if trying to demote primary admin
        npo_stmt = select(NPO).where(NPO.id == npo_id)
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one()

        if member.user_id == npo.created_by_user_id and new_role != MemberRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot demote the primary admin",
            )

        old_role = member.role
        member.role = new_role
        await db.commit()
        await db.refresh(member)

        # Get updater user for audit logging
        user_stmt = select(User).where(User.id == updated_by_user_id)
        user_result = await db.execute(user_stmt)
        updater = user_result.scalar_one()

        # Log audit event
        await AuditService.log_role_changed(
            db=db,
            user_id=member.user_id,
            email=member.user.email,
            old_role=old_role.value,
            new_role=new_role.value,
            admin_user_id=updated_by_user_id,
            admin_email=updater.email,
        )

        return member

    @staticmethod
    async def remove_member(
        db: AsyncSession,
        npo_id: uuid.UUID,
        member_id: uuid.UUID,
        removed_by_user_id: uuid.UUID,
    ) -> None:
        """
        Remove member from NPO (soft delete).

        Args:
            db: Database session
            npo_id: NPO ID
            member_id: Member ID to remove
            removed_by_user_id: User performing the removal

        Raises:
            HTTPException: If member not found or is the primary admin
        """
        # Get member
        stmt = (
            select(NPOMember)
            .where(
                NPOMember.id == member_id,
                NPOMember.npo_id == npo_id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(NPOMember.user))
        )
        result = await db.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found",
            )

        # Check if trying to remove primary admin
        npo_stmt = select(NPO).where(NPO.id == npo_id)
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one()

        if member.user_id == npo.created_by_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot remove the primary admin",
            )

        # Soft delete - change status to REMOVED
        member.status = MemberStatus.REMOVED
        await db.commit()

        # Log audit event
        await AuditService.log_npo_member_removed(
            db=db,
            npo_id=npo_id,
            npo_name=npo.name,
            member_user_id=member.user_id,
            member_email=member.user.email,
            removed_by_user_id=removed_by_user_id,
        )

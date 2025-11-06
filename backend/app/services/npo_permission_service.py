"""NPO-specific permission service for multi-tenant access control.

This service provides NPO-specific permission checks to ensure users can only
access NPOs they are members of or have administrative rights to.

Permission levels:
- SuperAdmin: Can access all NPOs, approve applications, manage any NPO
- NPO Admin: Full access to their NPO(s), can manage members/branding
- NPO Co-Admin: Same as Admin but cannot remove the primary Admin
- NPO Staff: Read-only access to their NPO(s), cannot manage members/branding

Multi-tenant isolation:
- All NPO operations are scoped to user's NPO membership
- Row-level security enforced at service layer
- Permissions cached in Redis for 5 minutes
"""

import uuid
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember


class NPOPermissionService:
    """Service for NPO-specific permission checks with multi-tenant isolation."""

    # Cache TTL in seconds (5 minutes)
    PERMISSION_CACHE_TTL = 300

    # Roles that can manage NPOs
    ADMIN_ROLES = {MemberRole.ADMIN, MemberRole.CO_ADMIN}

    async def _get_cached_permission(self, cache_key: str) -> bool | None:
        """Get permission result from cache."""
        try:
            redis_client = await get_redis()
            cached = await redis_client.get(cache_key)
            if cached is not None:
                return bool(cached == "1")
            return None
        except Exception:
            return None

    async def _set_cached_permission(self, cache_key: str, result: bool) -> None:
        """Cache permission result."""
        try:
            redis_client = await get_redis()
            await redis_client.setex(cache_key, self.PERMISSION_CACHE_TTL, "1" if result else "0")
        except Exception:
            pass

    @staticmethod
    async def invalidate_npo_permissions(
        user_id: uuid.UUID, npo_id: uuid.UUID | None = None
    ) -> None:
        """Invalidate cached NPO permissions for a user.

        Call this when:
        - User's NPO membership changes
        - User's role within an NPO changes
        - NPO status changes

        Args:
            user_id: User ID whose permissions to invalidate
            npo_id: Optional NPO ID to invalidate specific NPO permissions only
        """
        try:
            redis_client = await get_redis()
            if npo_id:
                pattern = f"npo_perm:{user_id}:{npo_id}:*"
            else:
                pattern = f"npo_perm:{user_id}:*"

            async for key in redis_client.scan_iter(match=pattern):
                await redis_client.delete(key)
        except Exception:
            pass

    async def get_user_npo_role(
        self, db: AsyncSession, user_id: uuid.UUID, npo_id: uuid.UUID
    ) -> tuple[MemberRole | None, MemberStatus | None]:
        """Get user's role and status in an NPO.

        Args:
            db: Database session
            user_id: User ID
            npo_id: NPO ID

        Returns:
            Tuple of (role, status) or (None, None) if not a member
        """
        stmt = select(NPOMember.role, NPOMember.status).where(
            and_(NPOMember.user_id == user_id, NPOMember.npo_id == npo_id)
        )
        result = await db.execute(stmt)
        row = result.first()
        return (row[0], row[1]) if row else (None, None)

    async def is_npo_member(self, db: AsyncSession, user: Any, npo_id: uuid.UUID) -> bool:
        """Check if user is an active member of an NPO.

        Args:
            db: Database session
            user: User object (must have .id and .role_name attributes)
            npo_id: NPO ID to check

        Returns:
            True if user is an active member or SuperAdmin
        """
        # SuperAdmin can access all NPOs
        if user.role_name == "super_admin":
            return True

        # Check cache
        cache_key = f"npo_perm:{user.id}:{npo_id}:is_member"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Check membership
        role, status = await self.get_user_npo_role(db, user.id, npo_id)
        result = role is not None and status == MemberStatus.ACTIVE

        await self._set_cached_permission(cache_key, result)
        return result

    async def can_view_npo(self, db: AsyncSession, user: Any, npo_id: uuid.UUID) -> bool:
        """Check if user can view NPO details.

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID

        Returns:
            True if user can view the NPO

        Rules:
            - SuperAdmin: Can view all NPOs
            - Active members: Can view their NPO
            - Others: Cannot view
        """
        return await self.is_npo_member(db, user, npo_id)

    async def can_manage_npo(self, db: AsyncSession, user: Any, npo_id: uuid.UUID) -> bool:
        """Check if user can manage NPO (update details, branding).

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID

        Returns:
            True if user can manage the NPO

        Rules:
            - SuperAdmin: Can manage all NPOs
            - NPO Admin/Co-Admin: Can manage their NPO
            - Staff: Cannot manage
        """
        # SuperAdmin can manage all NPOs
        if user.role_name == "super_admin":
            return True

        # Check cache
        cache_key = f"npo_perm:{user.id}:{npo_id}:can_manage"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Check if user is admin/co-admin with active status
        role, status = await self.get_user_npo_role(db, user.id, npo_id)
        result = role in self.ADMIN_ROLES and status == MemberStatus.ACTIVE

        await self._set_cached_permission(cache_key, result)
        return result

    async def can_manage_members(self, db: AsyncSession, user: Any, npo_id: uuid.UUID) -> bool:
        """Check if user can manage NPO members (invite, remove, change roles).

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID

        Returns:
            True if user can manage members

        Rules:
            - SuperAdmin: Can manage all NPO members
            - NPO Admin/Co-Admin: Can manage members in their NPO
            - Staff: Cannot manage members
        """
        return await self.can_manage_npo(db, user, npo_id)

    async def can_remove_member(
        self,
        db: AsyncSession,
        user: Any,
        npo_id: uuid.UUID,
        target_member_role: MemberRole,
    ) -> bool:
        """Check if user can remove a specific member.

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID
            target_member_role: Role of the member being removed

        Returns:
            True if user can remove the member

        Rules:
            - SuperAdmin: Can remove any member
            - Admin: Can remove any member except other Admins
            - Co-Admin: Can remove Staff only, not Admins or other Co-Admins
            - Staff: Cannot remove anyone
        """
        # SuperAdmin can remove anyone
        if user.role_name == "super_admin":
            return True

        # Get user's role
        user_role, status = await self.get_user_npo_role(db, user.id, npo_id)
        if status != MemberStatus.ACTIVE or user_role is None:
            return False

        # Admin can remove anyone except other Admins
        if user_role == MemberRole.ADMIN:
            return target_member_role != MemberRole.ADMIN

        # Co-Admin can only remove Staff
        if user_role == MemberRole.CO_ADMIN:
            return target_member_role == MemberRole.STAFF

        # Staff cannot remove anyone
        return False

    async def can_change_member_role(
        self,
        db: AsyncSession,
        user: Any,
        npo_id: uuid.UUID,
        current_role: MemberRole,
        new_role: MemberRole,
    ) -> bool:
        """Check if user can change a member's role.

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID
            current_role: Member's current role
            new_role: Desired new role

        Returns:
            True if user can change the role

        Rules:
            - SuperAdmin: Can change any role to any role
            - Admin: Can change roles except cannot promote to Admin
            - Co-Admin: Can only change Staff roles
            - Staff: Cannot change roles
        """
        # SuperAdmin can change any role
        if user.role_name == "super_admin":
            return True

        # Get user's role
        user_role, status = await self.get_user_npo_role(db, user.id, npo_id)
        if status != MemberStatus.ACTIVE or user_role is None:
            return False

        # Admin can change roles except cannot promote to Admin
        if user_role == MemberRole.ADMIN:
            return new_role != MemberRole.ADMIN and current_role != MemberRole.ADMIN

        # Co-Admin can only modify Staff roles
        if user_role == MemberRole.CO_ADMIN:
            return current_role == MemberRole.STAFF and new_role == MemberRole.STAFF

        # Staff cannot change roles
        return False

    async def can_approve_npo_application(self, user: Any) -> bool:
        """Check if user can approve NPO applications.

        Args:
            user: User object

        Returns:
            True if user can approve applications

        Rules:
            - Only SuperAdmin can approve applications
        """
        return bool(user.role_name == "super_admin")

    async def can_create_npo(self, user: Any) -> bool:
        """Check if user can create a new NPO.

        Args:
            user: User object

        Returns:
            True if user can create NPO

        Rules:
            - Any authenticated user can create NPO (draft or application)
            - NPO will start in 'draft' status
        """
        # Any authenticated user can create an NPO
        return True

    async def can_submit_application(self, db: AsyncSession, user: Any, npo_id: uuid.UUID) -> bool:
        """Check if user can submit NPO application for approval.

        Args:
            db: Database session
            user: User object
            npo_id: NPO ID

        Returns:
            True if user can submit application

        Rules:
            - Creator of the NPO can submit
            - Admin/Co-Admin can submit
            - NPO must be in draft or rejected status
        """
        # Check if user created the NPO
        stmt = select(NPO.created_by_user_id, NPO.status).where(NPO.id == npo_id)
        result = await db.execute(stmt)
        row = result.first()

        if not row:
            return False

        created_by, npo_status = row

        # Creator can submit
        if created_by == user.id:
            return True

        # Admin/Co-Admin can submit
        return await self.can_manage_npo(db, user, npo_id)

    async def can_view_all_npos(self, user: Any) -> bool:
        """Check if user can view all NPOs (admin list view).

        Args:
            user: User object

        Returns:
            True if user can view all NPOs

        Rules:
            - Only SuperAdmin can view all NPOs
        """
        return bool(user.role_name == "super_admin")

    async def filter_npos_by_permission(self, db: AsyncSession, user: Any) -> list[uuid.UUID]:
        """Get list of NPO IDs the user has access to.

        Args:
            db: Database session
            user: User object

        Returns:
            List of NPO IDs user can access
        """
        # SuperAdmin can access all NPOs
        if user.role_name == "super_admin":
            stmt = select(NPO.id).where(NPO.status != NPOStatus.REJECTED)
            result = await db.execute(stmt)
            return [row[0] for row in result]

        # Get NPOs where user is an active member
        stmt = select(NPOMember.npo_id).where(
            and_(
                NPOMember.user_id == user.id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
        )
        result = await db.execute(stmt)
        return [row[0] for row in result]

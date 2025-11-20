"""Permission service for role-based access control.

This service provides methods to check if a user can perform specific actions
based on their role and NPO assignment.

Role hierarchy:
- super_admin: Full platform access across all NPOs
- npo_admin: Full access within assigned NPO(s)
- event_coordinator: Event/auction management within NPO
- staff: Donor registration/check-in within assigned events
- donor: Bidding and profile management only

Permission caching:
- Results cached in Redis for 5 minutes to reduce DB load
- Cache key format: "perm:{user_id}:{permission}:{target_id}"
- Cache invalidated on role/NPO changes
"""

import uuid
from typing import Any

from app.core.redis import get_redis


class PermissionService:
    """Service for checking user permissions based on roles with Redis caching."""

    # Cache TTL in seconds (5 minutes)
    PERMISSION_CACHE_TTL = 300

    # Roles that require npo_id
    ROLES_REQUIRING_NPO = {"npo_admin", "event_coordinator"}

    # Roles that forbid npo_id
    ROLES_FORBIDDING_NPO = {"donor", "staff"}

    # Roles that can view users
    ROLES_CAN_VIEW_USERS = {"super_admin", "npo_admin", "event_coordinator"}

    # Roles that can create users
    ROLES_CAN_CREATE_USERS = {"super_admin", "npo_admin", "event_coordinator"}

    # Roles that can assign roles
    ROLES_CAN_ASSIGN_ROLES = {"super_admin", "npo_admin", "event_coordinator"}

    async def _get_cached_permission(self, cache_key: str) -> bool | None:
        """Get permission result from cache.

        Args:
            cache_key: Redis cache key

        Returns:
            Cached boolean result or None if not cached
        """
        try:
            redis_client = await get_redis()
            cached = await redis_client.get(cache_key)
            if cached is not None:
                return bool(cached == "1")
            return None
        except Exception:
            # If Redis fails, continue without cache
            return None

    async def _set_cached_permission(self, cache_key: str, result: bool) -> None:
        """Cache permission result.

        Args:
            cache_key: Redis cache key
            result: Permission check result
        """
        try:
            redis_client = await get_redis()
            await redis_client.setex(cache_key, self.PERMISSION_CACHE_TTL, "1" if result else "0")
        except Exception:
            # If Redis fails, continue without caching
            pass

    @staticmethod
    async def invalidate_user_permissions(user_id: uuid.UUID) -> None:
        """Invalidate all cached permissions for a user.

        Call this when user role or NPO assignment changes.

        Args:
            user_id: User ID whose permissions to invalidate
        """
        try:
            redis_client = await get_redis()
            # Delete all keys matching pattern perm:{user_id}:*
            pattern = f"perm:{user_id}:*"
            async for key in redis_client.scan_iter(match=pattern):
                await redis_client.delete(key)
        except Exception:
            # If Redis fails, cache will expire naturally
            pass

    async def can_view_user(self, user: Any, target_user_npo_id: uuid.UUID | None) -> bool:
        """Check if user can view a target user.

        Args:
            user: User making the request (must have .role and .npo_id attributes)
            target_user_npo_id: NPO ID of the user being viewed (None for platform-wide users)

        Returns:
            True if user can view the target user, False otherwise

        Rules:
            - super_admin: Can view all users
            - npo_admin: Can view users in their NPO only
            - event_coordinator: Can view users in their NPO only
            - staff/donor: Cannot view user lists
        """
        # Check cache
        cache_key = f"perm:{user.id}:view_user:{target_user_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Compute permission
        result = False
        if user.role_name not in self.ROLES_CAN_VIEW_USERS:
            result = False
        elif user.role_name == "super_admin":
            result = True
        elif user.role_name in {"npo_admin", "event_coordinator"}:
            if user.npo_id is None:
                result = False
            else:
                result = bool(target_user_npo_id == user.npo_id)

        # Cache and return
        await self._set_cached_permission(cache_key, result)
        return result

    async def can_create_user(self, user: Any, target_npo_id: uuid.UUID | None) -> bool:
        """Check if user can create a new user.

        Args:
            user: User making the request
            target_npo_id: NPO ID for the new user (None for platform-wide users like donors)

        Returns:
            True if user can create a user with the specified NPO, False otherwise

        Rules:
            - super_admin: Can create users in any NPO
            - npo_admin: Can create users in their NPO only (including donors)
            - event_coordinator: Can create users in their NPO only (staff/donors for events)
            - Others: Cannot create users
        """
        # Check cache
        cache_key = f"perm:{user.id}:create_user:{target_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Compute permission
        result = False
        if user.role_name not in self.ROLES_CAN_CREATE_USERS:
            result = False
        elif user.role_name == "super_admin":
            result = True
        elif user.role_name == "npo_admin":
            if user.npo_id is None:
                result = False
            else:
                result = target_npo_id is None or target_npo_id == user.npo_id
        elif user.role_name == "event_coordinator":
            if user.npo_id is None:
                result = False
            else:
                result = bool(target_npo_id == user.npo_id)

        # Cache and return
        await self._set_cached_permission(cache_key, result)
        return result

    async def can_assign_role(self, user: Any, target_role: str) -> bool:
        """Check if user can assign a specific role.

        Args:
            user: User making the request
            target_role: Role being assigned

        Returns:
            True if user can assign this role, False otherwise

        Rules:
            - super_admin: Can assign any role
            - npo_admin: Can assign all roles except super_admin
            - event_coordinator: Can assign staff and donor only
            - Others: Cannot assign roles
        """
        # Check cache
        cache_key = f"perm:{user.id}:assign_role:{target_role}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Compute permission
        result = False
        if user.role_name not in self.ROLES_CAN_ASSIGN_ROLES:
            result = False
        elif user.role_name == "super_admin":
            result = True
        elif user.role_name == "npo_admin":
            result = target_role != "super_admin"
        elif user.role_name == "event_coordinator":
            result = target_role in {"staff", "donor"}

        # Cache and return
        await self._set_cached_permission(cache_key, result)
        return result

    async def can_modify_user(self, user: Any, target_user_npo_id: uuid.UUID | None) -> bool:
        """Check if user can modify (update/delete) a target user.

        Args:
            user: User making the request
            target_user_npo_id: NPO ID of the user being modified

        Returns:
            True if user can modify the target user, False otherwise

        Rules:
            - super_admin: Can modify all users
            - npo_admin: Can modify users in their NPO only
            - Others: Cannot modify users
        """
        # Check cache
        cache_key = f"perm:{user.id}:modify_user:{target_user_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        # Compute permission
        result = False
        if user.role_name == "super_admin":
            result = True
        elif user.role_name == "npo_admin":
            if user.npo_id is None:
                result = False
            else:
                result = target_user_npo_id is None or target_user_npo_id == user.npo_id

        # Cache and return
        await self._set_cached_permission(cache_key, result)
        return result

    def role_requires_npo_id(self, role: str) -> bool:
        """Check if a role requires npo_id to be set.

        Args:
            role: Role name

        Returns:
            True if role requires npo_id, False otherwise
        """
        return role in self.ROLES_REQUIRING_NPO

    def role_forbids_npo_id(self, role: str) -> bool:
        """Check if a role forbids npo_id from being set.

        Args:
            role: Role name

        Returns:
            True if role forbids npo_id, False otherwise
        """
        return role in self.ROLES_FORBIDDING_NPO

    def validate_role_npo_id_combination(
        self, role: str, npo_id: uuid.UUID | None
    ) -> tuple[bool, str | None]:
        """Validate that role and npo_id combination is valid.

        Args:
            role: Role name
            npo_id: NPO ID (can be None)

        Returns:
            Tuple of (is_valid, error_message)
        """
        if self.role_requires_npo_id(role) and npo_id is None:
            return False, f"Role '{role}' requires npo_id to be set"

        if self.role_forbids_npo_id(role) and npo_id is not None:
            return False, f"Role '{role}' must not have npo_id set"

        return True, None

    async def can_view_npo(self, user: Any, target_npo_id: uuid.UUID) -> bool:
        """Check if user can view a specific NPO.

        Args:
            user: User making the request
            target_npo_id: NPO ID being viewed

        Returns:
            True if user can view the NPO, False otherwise

        Rules:
            - super_admin: Can view all NPOs
            - npo_admin: Can view their NPO only
            - event_coordinator: Can view NPOs they're registered with (read-only)
            - staff: Can view their NPO only (read-only)
            - donor: Cannot access admin PWA
        """
        cache_key = f"perm:{user.id}:view_npo:{target_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        result = False
        if user.role_name == "super_admin":
            result = True
        elif user.role_name in {"npo_admin", "event_coordinator", "staff"}:
            if user.npo_id is None:
                result = False
            else:
                result = bool(target_npo_id == user.npo_id)

        await self._set_cached_permission(cache_key, result)
        return result

    async def can_modify_npo(self, user: Any, target_npo_id: uuid.UUID) -> bool:
        """Check if user can modify (update/delete) a specific NPO.

        Args:
            user: User making the request
            target_npo_id: NPO ID being modified

        Returns:
            True if user can modify the NPO, False otherwise

        Rules:
            - super_admin: Can modify all NPOs
            - npo_admin: Can modify their NPO only
            - event_coordinator: Read-only access
            - staff: Read-only access
        """
        cache_key = f"perm:{user.id}:modify_npo:{target_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        result = False
        if user.role_name == "super_admin":
            result = True
        elif user.role_name == "npo_admin":
            if user.npo_id is None:
                result = False
            else:
                result = bool(target_npo_id == user.npo_id)

        await self._set_cached_permission(cache_key, result)
        return result

    async def can_view_event(self, user: Any, event_npo_id: uuid.UUID) -> bool:
        """Check if user can view an event.

        Args:
            user: User making the request
            event_npo_id: NPO ID that owns the event

        Returns:
            True if user can view the event, False otherwise

        Rules:
            - super_admin: Can view all events
            - npo_admin: Can view events in their NPO
            - event_coordinator: Can view events in their NPO
            - staff: Can view events in their NPO (assigned events only in practice)
        """
        cache_key = f"perm:{user.id}:view_event:{event_npo_id}"
        cached_result = await self._get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result

        result = False
        if user.role_name == "super_admin":
            result = True
        elif user.role_name in {"npo_admin", "event_coordinator", "staff"}:
            if user.npo_id is None:
                result = False
            else:
                result = bool(event_npo_id == user.npo_id)

        await self._set_cached_permission(cache_key, result)
        return result

    def get_npo_filter_for_user(
        self, user: Any, requested_npo_id: uuid.UUID | None = None
    ) -> uuid.UUID | None:
        """Get NPO filter to apply for list queries based on user role.

        Args:
            user: User making the request
            requested_npo_id: NPO ID from NPO context selector (None = "Augeo Platform" for SuperAdmin)

        Returns:
            - None: No filtering (show all NPOs) - SuperAdmin with "Augeo Platform" selected
            - UUID: Filter to single NPO - All other users or SuperAdmin with specific NPO selected

        Rules:
            - super_admin: Use requested_npo_id (None = all, UUID = specific NPO)
            - npo_admin: Always filter to user.npo_id (ignore requested_npo_id)
            - event_coordinator: Always filter to user.npo_id (ignore requested_npo_id)
            - staff: Always filter to user.npo_id (ignore requested_npo_id)
        """
        if user.role_name == "super_admin":
            # SuperAdmin respects NPO context selector
            return requested_npo_id
        elif user.role_name in {"npo_admin", "event_coordinator", "staff"}:
            # All other roles locked to their NPO
            npo_id: uuid.UUID | None = user.npo_id
            return npo_id
        else:
            # Donor role should never reach here (blocked at route level)
            return None

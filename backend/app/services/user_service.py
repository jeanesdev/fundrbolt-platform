"""User management service for admin operations.

This service provides methods for administrators to manage users,
including listing, creating, updating roles, and deactivating users.
"""

import uuid
from datetime import datetime
from math import ceil

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.schemas.users import (
    UserCreateRequest,
    UserListResponse,
    UserPublicWithRole,
    UserUpdateRequest,
)
from app.services.permission_service import PermissionService

MEMBER_ROLE_BY_USER_ROLE = {
    "npo_admin": MemberRole.ADMIN,
    "event_coordinator": MemberRole.STAFF,
    "staff": MemberRole.STAFF,
}


class UserService:
    """Service for user management operations."""

    def __init__(self) -> None:
        """Initialize UserService with PermissionService."""
        self.permission_service = PermissionService()

    async def list_users(
        self,
        db: AsyncSession,
        current_user: User,
        page: int = 1,
        per_page: int = 20,
        role: str | None = None,
        npo_id: uuid.UUID | None = None,
        email_verified: bool | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> UserListResponse:
        """List users with pagination and filtering.

        Args:
            db: Database session
            current_user: User making the request
            page: Page number (1-indexed)
            per_page: Items per page (max 100)
            role: Filter by role name
            npo_id: Filter by NPO ID
            email_verified: Filter by email verification status
            is_active: Filter by active status
            search: Search in name and email

        Returns:
            Paginated list of users

        Raises:
            ValueError: If page < 1 or per_page < 1 or per_page > 100
            PermissionError: If user doesn't have permission to view users
        """
        # Validate pagination
        if page < 1:
            raise ValueError("Page must be >= 1")
        if per_page < 1 or per_page > 100:
            raise ValueError("Per page must be between 1 and 100")

        # Build base query
        stmt = select(User)

        # Apply access control based on user role
        # Note: role_name is added dynamically by auth middleware
        if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
            if npo_id is None:
                raise PermissionError("npo_id is required to view users")
            if not await self.permission_service.can_view_user(current_user, npo_id, db=db):
                raise PermissionError("Insufficient permissions to view users")

        # Apply filters
        if role:
            # Join with roles table to filter by role name
            from app.models.base import Base

            roles_table = Base.metadata.tables["roles"]
            stmt = stmt.join(roles_table, User.role_id == roles_table.c.id).where(
                roles_table.c.name == role
            )

        if npo_id:
            stmt = stmt.join(NPOMember, NPOMember.user_id == User.id).where(
                and_(NPOMember.npo_id == npo_id, NPOMember.status == MemberStatus.ACTIVE)
            )

        if email_verified is not None:
            stmt = stmt.where(User.email_verified == email_verified)

        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        if search:
            search_pattern = f"%{search.lower()}%"
            # Search in first_name, last_name, email, phone
            search_conditions = [
                func.lower(User.first_name).like(search_pattern),
                func.lower(User.last_name).like(search_pattern),
                func.lower(User.email).like(search_pattern),
                func.lower(User.phone).like(search_pattern),  # Simple phone search
                # Search full name (concatenated first + last)
                func.lower(func.concat(User.first_name, " ", User.last_name)).like(search_pattern),
            ]

            # Search in NPO memberships (npo name)
            from app.models.npo import NPO
            from app.models.npo_member import NPOMember

            npo_subquery = (
                select(NPOMember.user_id)
                .join(NPO, NPOMember.npo_id == NPO.id)
                .where(
                    and_(NPOMember.status == "active", func.lower(NPO.name).like(search_pattern))
                )
            )
            search_conditions.append(User.id.in_(npo_subquery))

            stmt = stmt.where(or_(*search_conditions))

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.alias())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()

        # Apply pagination
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)

        # Execute query
        result = await db.execute(stmt)
        users = result.scalars().all()

        # Get role names and NPO memberships for users
        user_list = []
        for user in users:
            # Fetch role name
            from app.models.base import Base
            from app.models.npo_member import NPOMember

            roles_table = Base.metadata.tables["roles"]
            role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
            role_result = await db.execute(role_stmt)
            role_name = role_result.scalar_one()

            # Fetch NPO memberships
            npo_memberships = []
            member_stmt = (
                select(NPOMember)
                .where(NPOMember.user_id == user.id)
                .where(NPOMember.status == MemberStatus.ACTIVE)
            )
            member_result = await db.execute(member_stmt)
            members = member_result.scalars().all()

            for member in members:
                # Get NPO name
                from app.models.npo import NPO

                npo_stmt = select(NPO.name).where(NPO.id == member.npo_id)
                npo_result = await db.execute(npo_stmt)
                npo_name = npo_result.scalar_one_or_none()

                if npo_name:
                    npo_memberships.append(
                        {
                            "npo_id": member.npo_id,
                            "npo_name": npo_name,
                            "role": member.role.value,
                            "status": member.status.value,
                        }
                    )

            user_dict = {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "role": role_name,
                "npo_memberships": npo_memberships,
                "email_verified": user.email_verified,
                "is_active": user.is_active,
                "last_login_at": user.last_login_at,
                "created_at": user.created_at,
                "updated_at": user.updated_at,
            }
            user_list.append(UserPublicWithRole(**user_dict))

        # Calculate total pages, handling case where total is None
        total_pages = ceil(total / per_page) if (total is not None and total > 0) else 1
        # Ensure total is not None for response
        total = total or 0

        return UserListResponse(
            items=user_list,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    async def create_user(
        self,
        db: AsyncSession,
        current_user: User,
        user_data: UserCreateRequest,
    ) -> User:
        """Create a new user (admin only).

        Args:
            db: Database session
            current_user: User making the request
            user_data: User creation data

        Returns:
            Created user

        Raises:
            ValueError: If email already exists or role/npo_id validation fails
            PermissionError: If user doesn't have permission to create users
        """
        # Check permissions
        if not await self.permission_service.can_create_user(current_user, user_data.npo_id, db=db):
            raise PermissionError("Insufficient permissions to create users")

        if not await self.permission_service.can_assign_role(current_user, user_data.role):
            raise PermissionError(f"Cannot assign role: {user_data.role}")

        # Note: role/npo_id validation is now handled at the schema level (UserCreateRequest)
        # See app/schemas/users.py for validation logic

        # Check if email already exists
        stmt = select(User).where(User.email == user_data.email.lower())
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise ValueError("Email already exists")

        # Get role ID
        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.id).where(roles_table.c.name == user_data.role)
        role_result = await db.execute(role_stmt)
        role_id = role_result.scalar_one_or_none()
        if not role_id:
            raise ValueError(f"Invalid role: {user_data.role}")

        # Create user with provided password
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
            password_hash=hash_password(user_data.password),
            role_id=role_id,
            email_verified=False,  # Will need email verification
            is_active=False,  # Activated after email verification
        )

        db.add(user)
        await db.flush()

        if user_data.npo_id is not None:
            member_role = MEMBER_ROLE_BY_USER_ROLE.get(user_data.role)
            if not member_role:
                raise ValueError("Unsupported role for NPO membership")
            db.add(
                NPOMember(
                    npo_id=user_data.npo_id,
                    user_id=user.id,
                    role=member_role,
                    status=MemberStatus.ACTIVE,
                    joined_at=datetime.utcnow(),
                )
            )

        await db.commit()
        await db.refresh(user)

        return user

    async def get_user(
        self,
        db: AsyncSession,
        current_user: User,
        user_id: uuid.UUID,
        npo_id: uuid.UUID | None = None,
    ) -> User:
        """Get a user by ID.

        Args:
            db: Database session
            current_user: User making the request
            user_id: User ID to retrieve

        Returns:
            User model

        Raises:
            ValueError: If user not found
            PermissionError: If user doesn't have permission to view this user
        """
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Check permissions
        if current_user.id != user_id:
            if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
                if npo_id is None:
                    raise PermissionError("npo_id is required to view this user")
                if not await self.permission_service.can_view_user(current_user, npo_id, db=db):
                    raise PermissionError("Insufficient permissions to view this user")
                if not await self._user_has_membership(db, user.id, npo_id):
                    raise PermissionError("User is not a member of this NPO")

        # Refresh to ensure all attributes are loaded
        await db.refresh(user)

        return user

    async def update_user(
        self,
        db: AsyncSession,
        current_user: User,
        user_id: uuid.UUID,
        user_data: UserUpdateRequest,
        npo_id: uuid.UUID | None = None,
    ) -> User:
        """Update user profile.

        Args:
            db: Database session
            current_user: User making the request
            user_id: User ID to update
            user_data: Updated user data

        Returns:
            Updated user

        Raises:
            ValueError: If user not found
            PermissionError: If user doesn't have permission to modify this user
        """
        user = await self.get_user(db, current_user, user_id, npo_id=npo_id)

        # Check permissions
        if current_user.id != user_id:
            if not await self.permission_service.can_modify_user(current_user, npo_id, db=db):
                raise PermissionError("Insufficient permissions to modify this user")

        # Update fields
        if user_data.first_name is not None:
            user.first_name = user_data.first_name
        if user_data.last_name is not None:
            user.last_name = user_data.last_name
        if user_data.phone is not None:
            user.phone = user_data.phone or None  # Convert empty string to None
        if user_data.organization_name is not None:
            user.organization_name = user_data.organization_name or None
        if user_data.address_line1 is not None:
            user.address_line1 = user_data.address_line1 or None
        if user_data.address_line2 is not None:
            user.address_line2 = user_data.address_line2 or None
        if user_data.city is not None:
            user.city = user_data.city or None
        if user_data.state is not None:
            user.state = user_data.state or None
        if user_data.postal_code is not None:
            user.postal_code = user_data.postal_code or None
        if user_data.country is not None:
            user.country = user_data.country or None
        if user_data.social_media_links is not None:
            user.social_media_links = user_data.social_media_links
        if user_data.password is not None:
            user.password_hash = hash_password(user_data.password)

        await db.commit()
        await db.refresh(user)

        return user

    async def update_role(
        self,
        db: AsyncSession,
        current_user: User,
        user_id: uuid.UUID,
        role: str,
        npo_id: uuid.UUID | None = None,
    ) -> User:
        """Update user's role and optionally npo_id.

        Args:
            db: Database session
            current_user: User making the request
            user_id: User ID to update
            role: New role name
            npo_id: New NPO ID (required for npo_admin/event_coordinator)

        Returns:
            Updated user

        Raises:
            ValueError: If user not found or role/npo_id validation fails
            PermissionError: If user doesn't have permission to assign this role
        """
        user = await self.get_user(db, current_user, user_id, npo_id=npo_id)

        # Prevent users from changing their own role
        if current_user.id == user_id:
            raise PermissionError("Cannot change your own role")

        # Check permissions
        if not await self.permission_service.can_modify_user(current_user, npo_id, db=db):
            raise PermissionError("Insufficient permissions to modify this user")

        if not await self.permission_service.can_assign_role(current_user, role):
            raise PermissionError(f"Cannot assign role: {role}")

        # Note: role/npo_id validation is now handled at the schema level (RoleUpdateRequest)
        # See app/schemas/users.py for validation logic

        # Get role ID
        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.id).where(roles_table.c.name == role)
        role_result = await db.execute(role_stmt)
        role_id = role_result.scalar_one_or_none()
        if not role_id:
            raise ValueError(f"Invalid role: {role}")

        # Update role and membership
        user.role_id = role_id

        member_role = MEMBER_ROLE_BY_USER_ROLE.get(role)
        if member_role:
            if npo_id is None:
                raise ValueError("npo_id is required for NPO membership roles")
            await self._upsert_membership(db, user.id, npo_id, member_role)
        else:
            await self._remove_memberships(db, user.id, npo_id)

        await db.commit()
        await db.refresh(user)

        return user

    async def deactivate_user(
        self,
        db: AsyncSession,
        current_user: User,
        user_id: uuid.UUID,
        npo_id: uuid.UUID | None = None,
    ) -> User:
        """Deactivate a user (soft delete).

        Args:
            db: Database session
            current_user: User making the request
            user_id: User ID to deactivate

        Returns:
            Deactivated user

        Raises:
            ValueError: If user not found
            PermissionError: If user doesn't have permission to modify this user
        """
        user = await self.get_user(db, current_user, user_id, npo_id=npo_id)

        # Check permissions
        if not await self.permission_service.can_modify_user(current_user, npo_id, db=db):
            raise PermissionError("Insufficient permissions to modify this user")

        user.is_active = False

        await db.commit()
        await db.refresh(user)

        return user

    async def activate_user(
        self,
        db: AsyncSession,
        current_user: User,
        user_id: uuid.UUID,
        npo_id: uuid.UUID | None = None,
    ) -> User:
        """Activate a user account.

        Args:
            db: Database session
            current_user: User making the request
            user_id: User ID to activate

        Returns:
            Activated user

        Raises:
            ValueError: If user not found
            PermissionError: If user doesn't have permission to modify this user
        """
        user = await self.get_user(db, current_user, user_id, npo_id=npo_id)

        # Check permissions
        if not await self.permission_service.can_modify_user(current_user, npo_id, db=db):
            raise PermissionError("Insufficient permissions to modify this user")

        user.is_active = True

        await db.commit()
        await db.refresh(user)

        return user

    async def _user_has_membership(
        self, db: AsyncSession, user_id: uuid.UUID, npo_id: uuid.UUID
    ) -> bool:
        stmt = select(NPOMember.id).where(
            and_(
                NPOMember.user_id == user_id,
                NPOMember.npo_id == npo_id,
                NPOMember.status == MemberStatus.ACTIVE,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def _upsert_membership(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        role: MemberRole,
    ) -> None:
        stmt = select(NPOMember).where(
            and_(NPOMember.user_id == user_id, NPOMember.npo_id == npo_id)
        )
        result = await db.execute(stmt)
        membership = result.scalar_one_or_none()
        if membership:
            membership.role = role
            membership.status = MemberStatus.ACTIVE
        else:
            db.add(
                NPOMember(
                    npo_id=npo_id,
                    user_id=user_id,
                    role=role,
                    status=MemberStatus.ACTIVE,
                    joined_at=datetime.utcnow(),
                )
            )

    async def _remove_memberships(
        self, db: AsyncSession, user_id: uuid.UUID, npo_id: uuid.UUID | None
    ) -> None:
        stmt = select(NPOMember).where(NPOMember.user_id == user_id)
        if npo_id is not None:
            stmt = stmt.where(NPOMember.npo_id == npo_id)
        result = await db.execute(stmt)
        for membership in result.scalars().all():
            await db.delete(membership)

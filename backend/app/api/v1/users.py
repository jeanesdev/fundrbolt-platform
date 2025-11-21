"""User management endpoints for administrators."""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.user import User
from app.schemas.users import (
    ProfileUpdateRequest,
    RoleUpdateRequest,
    UserActivateRequest,
    UserCreateRequest,
    UserListResponse,
    UserPublicWithRole,
    UserUpdateRequest,
)
from app.services.audit_service import AuditService
from app.services.user_service import UserService

router = APIRouter()


async def build_user_response(user: User, db: AsyncSession) -> dict[str, object]:
    """Build a complete user response dict with all fields including address.

    Args:
        user: User model instance
        db: Database session

    Returns:
        dict with all user fields including role name and address fields
    """
    # Get role name
    from sqlalchemy import select

    from app.models.base import Base

    roles_table = Base.metadata.tables["roles"]
    role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
    role_result = await db.execute(role_stmt)
    role_name = role_result.scalar_one()

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "organization_name": user.organization_name,
        "address_line1": user.address_line1,
        "address_line2": user.address_line2,
        "city": user.city,
        "state": user.state,
        "postal_code": user.postal_code,
        "country": user.country,
        "profile_picture_url": user.profile_picture_url,
        "social_media_links": user.social_media_links,
        "role": role_name,
        "npo_id": user.npo_id,
        "email_verified": user.email_verified,
        "is_active": user.is_active,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


@router.get("/me", response_model=UserPublicWithRole)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserPublicWithRole:
    """Get current authenticated user's profile.

    Returns the profile of the currently authenticated user based on their JWT token.
    This endpoint is accessible to all authenticated users.

    Returns:
        UserPublicWithRole: Current user's profile with role information

    Raises:
        401: Not authenticated
    """
    # Fetch role name from current_user
    role_name = getattr(current_user, "role_name", "unknown")

    return UserPublicWithRole(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        profile_picture_url=current_user.profile_picture_url,
        email_verified=current_user.email_verified,
        is_active=current_user.is_active,
        role=role_name,
        npo_id=current_user.npo_id,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        last_login_at=current_user.last_login_at,
    )


@router.patch("/me/profile", response_model=UserPublicWithRole)
async def update_current_user_profile(
    profile_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPublicWithRole:
    """Update current user's profile.

    Allows authenticated users to update their own profile information.
    Email changes are not allowed via this endpoint (requires separate verification flow).

    Access Control (T052):
    - All authenticated users can update their own profile

    Args:
        profile_data: Updated profile data
        current_user: Current authenticated user
        db: Database session

    Returns:
        UserPublicWithRole: Updated user profile

    Raises:
        400: Invalid data
        401: Not authenticated
        404: User not found
    """
    user_service = UserService()

    try:
        # Create UserUpdateRequest from ProfileUpdateRequest
        # (T051: Backend Pydantic validation already handled by ProfileUpdateRequest)
        update_data = UserUpdateRequest(
            first_name=profile_data.first_name,
            last_name=profile_data.last_name,
            phone=profile_data.phone,
            organization_name=profile_data.organization_name,
            address_line1=profile_data.address_line1,
            address_line2=profile_data.address_line2,
            city=profile_data.city,
            state=profile_data.state,
            postal_code=profile_data.postal_code,
            country=profile_data.country,
            social_media_links=profile_data.social_media_links,
            password=None,  # Profile updates don't change password
        )

        # Update user - user can only update their own profile (T052)
        updated_user = await user_service.update_user(
            db=db,
            current_user=current_user,
            user_id=current_user.id,  # Enforce updating only own profile
            user_data=update_data,
        )

        # Log profile update
        fields_updated = [
            field
            for field in [
                "first_name",
                "last_name",
                "phone",
                "organization_name",
                "address_line1",
                "address_line2",
                "city",
                "state",
                "postal_code",
                "country",
            ]
            if getattr(profile_data, field, None) is not None
        ]

        await AuditService.log_user_updated(
            db=db,
            user_id=updated_user.id,
            email=updated_user.email,
            fields_updated=fields_updated,
            admin_user_id=current_user.id,
            admin_email=current_user.email,
            ip_address=None,
        )

        # Return updated user with role info
        role_name = getattr(updated_user, "role_name", "unknown")
        return UserPublicWithRole(
            id=updated_user.id,
            email=updated_user.email,
            first_name=updated_user.first_name,
            last_name=updated_user.last_name,
            phone=updated_user.phone,
            email_verified=updated_user.email_verified,
            is_active=updated_user.is_active,
            role=role_name,
            npo_id=updated_user.npo_id,
            created_at=updated_user.created_at,
            updated_at=updated_user.updated_at,
            last_login_at=updated_user.last_login_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("", response_model=UserListResponse)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    role: str | None = None,
    npo_id: uuid.UUID | None = None,
    email_verified: bool | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    """List users with pagination and filtering.

    Access Control:
    - Super Admin: Can view all users
    - NPO Admin: Can view users in their NPO
    - Event Coordinator: Can view users in their NPO
    - Staff/Donor: Not allowed

    Query Parameters:
    - page: Page number (1-indexed)
    - per_page: Items per page (1-100, default 20)
    - role: Filter by role name
    - npo_id: Filter by NPO ID
    - email_verified: Filter by email verification status
    - is_active: Filter by active status
    - search: Search in name and email

    Returns:
        Paginated list of users with role information

    Raises:
        400: Invalid pagination parameters
        403: Insufficient permissions
    """
    user_service = UserService()

    try:
        return await user_service.list_users(
            db=db,
            current_user=current_user,
            page=page,
            per_page=per_page,
            role=role,
            npo_id=npo_id,
            email_verified=email_verified,
            is_active=is_active,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin")
async def create_user(
    user_data: UserCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Create a new user (admin only).

    Access Control:
    - Super Admin: Can create users with any role in any NPO
    - NPO Admin: Can create users in their NPO (except super_admin)
    - Others: Not allowed

    Business Rules:
    - Email must be unique
    - npo_admin and event_coordinator roles MUST have npo_id
    - staff and donor roles MUST NOT have npo_id
    - Created user gets temporary password (should be changed on first login)
    - User starts with email_verified=false, is_active=false

    Args:
        user_data: User creation data

    Returns:
        Created user with role information

    Raises:
        400: Invalid data or role/npo_id constraint violation
        403: Insufficient permissions
        409: Email already exists
    """
    user_service = UserService()

    try:
        user = await user_service.create_user(db=db, current_user=current_user, user_data=user_data)

        # Get role name for response
        from sqlalchemy import select

        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
        role_result = await db.execute(role_stmt)
        role_name = role_result.scalar_one()

        # Log user creation
        ip_address = None
        await AuditService.log_user_created(
            db=db,
            user_id=user.id,
            email=user.email,
            role=role_name,
            admin_user_id=current_user.id,
            admin_email=current_user.email,
            ip_address=ip_address,
        )

        return await build_user_response(user, db)
    except ValueError as e:
        if "already exists" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{user_id}", response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get a user by ID.

    Access Control:
    - Super Admin: Can view any user
    - NPO Admin: Can view users in their NPO
    - Event Coordinator: Can view users in their NPO
    - Others: Not allowed

    Args:
        user_id: User ID

    Returns:
        User with role information

    Raises:
        403: Insufficient permissions
        404: User not found
    """
    user_service = UserService()

    try:
        user = await user_service.get_user(db=db, current_user=current_user, user_id=user_id)

        # Get role name
        from sqlalchemy import select

        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
        role_result = await db.execute(role_stmt)
        role_name = role_result.scalar_one()

        return {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "organization_name": user.organization_name,
            "address_line1": user.address_line1,
            "address_line2": user.address_line2,
            "city": user.city,
            "state": user.state,
            "postal_code": user.postal_code,
            "country": user.country,
            "profile_picture_url": user.profile_picture_url,
            "social_media_links": user.social_media_links,
            "role": role_name,
            "npo_id": user.npo_id,
            "npo_memberships": [],  # Will be populated by service if needed
            "email_verified": user.email_verified,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{user_id}", response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin")
async def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Update user profile.

    Access Control:
    - Super Admin: Can update any user
    - NPO Admin: Can update users in their NPO
    - Others: Not allowed

    Args:
        user_id: User ID
        user_data: Updated user data

    Returns:
        Updated user with role information

    Raises:
        403: Insufficient permissions
        404: User not found
    """
    user_service = UserService()

    try:
        user = await user_service.update_user(
            db=db, current_user=current_user, user_id=user_id, user_data=user_data
        )

        # Log user update
        # Determine which fields were updated
        fields_updated = []
        if user_data.first_name is not None:
            fields_updated.append("first_name")
        if user_data.last_name is not None:
            fields_updated.append("last_name")
        if user_data.phone is not None:
            fields_updated.append("phone")

        ip_address = None
        await AuditService.log_user_updated(
            db=db,
            user_id=user.id,
            email=user.email,
            fields_updated=fields_updated,
            admin_user_id=current_user.id,
            admin_email=current_user.email,
            ip_address=ip_address,
        )

        return await build_user_response(user, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_role("super_admin", "npo_admin")
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a user (soft delete by deactivating).

    Access Control:
    - Super Admin: Can delete any user
    - NPO Admin: Can delete users in their NPO
    - Others: Not allowed

    Args:
        user_id: User ID

    Raises:
        403: Insufficient permissions
        404: User not found
    """
    user_service = UserService()

    try:
        user = await user_service.deactivate_user(db=db, current_user=current_user, user_id=user_id)

        # Log user deletion/deactivation
        ip_address = None
        await AuditService.log_user_deleted(
            db=db,
            user_id=user.id,
            email=user.email,
            admin_user_id=current_user.id,
            admin_email=current_user.email,
            ip_address=ip_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{user_id}/role", response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin", "event_coordinator")
async def update_user_role(
    user_id: uuid.UUID,
    role_data: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Update user's role and optionally npo_id.

    Access Control:
    - Super Admin: Can assign any role
    - NPO Admin: Can assign roles except super_admin
    - Event Coordinator: Can assign staff and donor only
    - Others: Not allowed

    Business Rules:
    - npo_admin and event_coordinator roles MUST have npo_id
    - staff and donor roles MUST NOT have npo_id
    - Changing from npo_admin/event_coordinator to staff/donor clears npo_id

    Args:
        user_id: User ID
        role_data: New role and optional npo_id

    Returns:
        Updated user with role information

    Raises:
        400: Invalid role/npo_id combination
        403: Insufficient permissions
        404: User not found
    """
    user_service = UserService()

    try:
        # First, get the user to retrieve old role
        old_user = await user_service.get_user(db, current_user, user_id)

        from sqlalchemy import select

        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        old_role_stmt = select(roles_table.c.name).where(roles_table.c.id == old_user.role_id)
        old_role_result = await db.execute(old_role_stmt)
        old_role_name = old_role_result.scalar_one()

        # Update the role
        user = await user_service.update_role(
            db=db,
            current_user=current_user,
            user_id=user_id,
            role=role_data.role,
            npo_id=role_data.npo_id,
        )

        # Get new role name
        new_role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
        new_role_result = await db.execute(new_role_stmt)
        new_role_name = new_role_result.scalar_one()

        # Log role change
        ip_address = None
        await AuditService.log_role_changed(
            db=db,
            user_id=user.id,
            email=user.email,
            old_role=old_role_name,
            new_role=new_role_name,
            admin_user_id=current_user.id,
            admin_email=current_user.email,
            ip_address=ip_address,
        )

        return {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "role": new_role_name,
            "npo_id": user.npo_id,
            "email_verified": user.email_verified,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{user_id}/activate", response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin")
async def activate_user(
    user_id: uuid.UUID,
    activate_data: UserActivateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Activate or deactivate a user account.

    Access Control:
    - Super Admin: Can activate/deactivate any user
    - NPO Admin: Can activate/deactivate users in their NPO
    - Others: Not allowed

    Args:
        user_id: User ID
        activate_data: Activation status

    Returns:
        Updated user with role information

    Raises:
        403: Insufficient permissions
        404: User not found
    """
    user_service = UserService()

    try:
        if activate_data.is_active:
            user = await user_service.activate_user(
                db=db, current_user=current_user, user_id=user_id
            )
        else:
            user = await user_service.deactivate_user(
                db=db, current_user=current_user, user_id=user_id
            )

        # Get role name
        from sqlalchemy import select

        from app.models.base import Base

        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.name).where(roles_table.c.id == user.role_id)
        role_result = await db.execute(role_stmt)
        role_name = role_result.scalar_one()

        # Log activation change
        ip_address = None
        if activate_data.is_active:
            await AuditService.log_account_reactivated(
                db=db,
                user_id=user.id,
                email=user.email,
                admin_user_id=current_user.id,
                ip_address=ip_address,
            )
        else:
            await AuditService.log_account_deactivated(
                db=db,
                user_id=user.id,
                email=user.email,
                reason="Manual deactivation",
                admin_user_id=current_user.id,
                ip_address=ip_address,
            )

        return {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "role": role_name,
            "npo_id": user.npo_id,
            "email_verified": user.email_verified,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{user_id}/verify-email", response_model=UserPublicWithRole)
@require_role("super_admin", "npo_admin")
async def verify_user_email(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Manually verify a user's email address.

    Access Control:
    - Super Admin: Can verify any user's email
    - NPO Admin: Can verify emails for users in their NPO
    - Others: Not allowed

    Args:
        user_id: User ID

    Returns:
        Updated user with role information

    Raises:
        403: Insufficient permissions
        404: User not found
    """
    from sqlalchemy import select, update

    from app.models.base import Base

    try:
        # Get the user
        user_stmt = select(User).where(User.id == user_id)
        result = await db.execute(user_stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Check permissions
        if current_user.role_name == "npo_admin":  # type: ignore[attr-defined]
            if user.npo_id != current_user.npo_id:
                raise PermissionError("You can only verify emails for users in your NPO")

        # Update email_verified
        update_stmt = (
            update(User).where(User.id == user_id).values(email_verified=True).returning(User)
        )
        result = await db.execute(update_stmt)
        updated_user = result.scalar_one()
        await db.commit()

        # Get role name
        roles_table = Base.metadata.tables["roles"]
        role_stmt = select(roles_table.c.name).where(roles_table.c.id == updated_user.role_id)
        role_result = await db.execute(role_stmt)
        role_name = role_result.scalar_one()

        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "first_name": updated_user.first_name,
            "last_name": updated_user.last_name,
            "phone": updated_user.phone,
            "role": role_name,
            "npo_id": updated_user.npo_id,
            "email_verified": updated_user.email_verified,
            "is_active": updated_user.is_active,
            "last_login_at": updated_user.last_login_at,
            "created_at": updated_user.created_at,
            "updated_at": updated_user.updated_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{user_id}/profile-picture")
async def upload_profile_picture(
    user_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    """Upload or update user profile picture.

    Allows users to upload their profile picture. Users can only update their own picture,
    except for super_admin who can update any user's picture.

    Args:
        user_id: User ID
        file: Uploaded image file
        current_user: Currently authenticated user
        db: Database session

    Returns:
        dict with profile_picture_url

    Raises:
        403: User trying to update another user's picture (non-admin)
        404: User not found
        400: Invalid file type or size
    """
    from sqlalchemy import select, update

    from app.services.file_upload_service import FileUploadService

    # Permission check: users can only update their own picture, except super_admin
    if current_user.id != user_id and current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile picture",
        )

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    # Read file content
    file_content = await file.read()

    # Validate file size (5MB limit)
    max_size = 5 * 1024 * 1024  # 5MB
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB",
        )

    # Get the user
    user_stmt = select(User).where(User.id == user_id)
    result = await db.execute(user_stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Upload file
    file_upload_service = FileUploadService(settings)

    # Use user_id as npo_id for file upload service (store in user-specific folder)
    profile_picture_url = file_upload_service.upload_file(
        npo_id=user_id,  # Use user_id as folder identifier
        file_name=file.filename or "profile.jpg",
        content_type=file.content_type,
        file_content=file_content,
    )

    # Update user's profile_picture_url
    update_stmt = (
        update(User)
        .where(User.id == user_id)
        .values(profile_picture_url=profile_picture_url)
        .returning(User)
    )
    await db.execute(update_stmt)
    await db.commit()

    # Audit log
    await AuditService.log_user_updated(
        db=db,
        user_id=user_id,
        email=user.email,
        fields_updated=["profile_picture_url"],
        admin_user_id=current_user.id,
        admin_email=current_user.email,
        ip_address=None,
    )

    return {"profile_picture_url": profile_picture_url}

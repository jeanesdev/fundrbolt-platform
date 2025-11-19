"""API endpoints for NPO Branding management.

Handles visual identity configuration including colors, logos, and social media links.
"""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.npo_branding import (
    BrandingResponse,
    BrandingUpdateRequest,
    BrandingUpdateResponse,
    LogoUploadRequest,
    LogoUploadResponse,
)
from app.services.branding_service import BrandingService
from app.services.file_upload_service import FileUploadService
from app.services.npo_permission_service import NPOPermissionService

router = APIRouter(prefix="/npos", tags=["NPO Branding"])
logger = get_logger(__name__)


@router.get(
    "/{npo_id}/branding",
    response_model=BrandingResponse,
    status_code=status.HTTP_200_OK,
    summary="Get NPO branding",
    description="Get visual identity configuration for an NPO. Creates default if not exists.",
)
async def get_npo_branding(
    npo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandingResponse:
    """Get NPO branding configuration.

    Requires:
    - User must be a member of the NPO or SuperAdmin

    Returns:
    - 200: Branding configuration
    - 401: Not authenticated
    - 403: No permission to access this NPO
    - 404: NPO not found
    """
    # Check if NPO exists first (to return 404 before 403)
    branding_service = BrandingService()
    try:
        branding = await branding_service.get_branding(db, npo_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "npo_not_found", "message": str(e)},
        )

    # Check permission
    permission_service = NPOPermissionService()
    has_permission = await permission_service.can_view_npo(db, current_user, npo_id)

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "no_permission", "message": "No permission to access this NPO"},
        )

    return BrandingResponse.model_validate(branding)


@router.patch(
    "/{npo_id}/branding",
    response_model=BrandingUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update NPO branding",
    description="Update visual identity configuration. Requires NPO admin role.",
)
@router.put(
    "/{npo_id}/branding",
    response_model=BrandingUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update NPO branding",
    description="Update visual identity configuration. Requires NPO admin role.",
)
async def update_npo_branding(
    npo_id: uuid.UUID,
    branding_data: BrandingUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandingUpdateResponse:
    """Update NPO branding configuration.

    Requires:
    - User must be NPO admin or co-admin

    Validates:
    - Color format (hex)
    - Social media URLs (platform-specific patterns)
    - Logo URL format

    Returns:
    - 200: Updated branding
    - 401: Not authenticated
    - 403: No permission (requires admin)
    - 404: NPO not found
    - 422: Validation error
    """
    # Check if NPO exists first (to return 404 before 403)
    branding_service = BrandingService()
    try:
        _ = await branding_service.get_branding(db, npo_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "npo_not_found", "message": str(e)},
        )

    # Check permission
    permission_service = NPOPermissionService()
    can_manage = await permission_service.can_manage_npo(db, current_user, npo_id)

    if not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "insufficient_permissions",
                "message": "Only NPO admins can update branding",
            },
        )

    # Update branding
    branding = await branding_service.update_branding(db, npo_id, branding_data)
    return BrandingUpdateResponse(
        branding=BrandingResponse.model_validate(branding),
        message="Branding updated successfully",
    )


@router.post(
    "/{npo_id}/branding/logo-upload",
    response_model=LogoUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate logo upload URL",
    description="Generate pre-signed Azure Blob Storage URL for logo upload.",
)
@router.post(
    "/{npo_id}/logo/upload-url",
    response_model=LogoUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate logo upload URL",
    description="Generate pre-signed Azure Blob Storage URL for logo upload.",
)
async def generate_logo_upload_url(
    npo_id: uuid.UUID,
    upload_request: LogoUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> LogoUploadResponse:
    """Generate pre-signed URL for direct logo upload to Azure Blob Storage.

    Workflow:
    1. Request upload URL with file metadata
    2. Receive pre-signed URL (valid for 15 minutes)
    3. Upload file directly to Azure using PUT request
    4. Update branding with logo_url

    Requires:
    - User must be NPO admin or co-admin
    - File must be image type (jpg, png, gif, webp)
    - File size ≤ 5MB

    Returns:
    - 200: Pre-signed upload URL and final logo URL
    - 401: Not authenticated
    - 403: No permission (requires admin)
    - 422: Invalid file type or size
    """
    # Check permission
    permission_service = NPOPermissionService()
    can_manage = await permission_service.can_manage_npo(db, current_user, npo_id)

    if not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "insufficient_permissions",
                "message": "Only NPO admins can upload logos",
            },
        )

    # Generate upload URL
    try:
        file_upload_service = FileUploadService(settings)

        upload_data = file_upload_service.generate_upload_url(
            npo_id=npo_id,
            file_name=upload_request.file_name,
            content_type=upload_request.content_type,
            file_size=upload_request.file_size,
        )

        return LogoUploadResponse(
            upload_url=str(upload_data["upload_url"]),
            logo_url=str(upload_data["logo_url"]),
            expires_in=int(upload_data["expires_in"]),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "validation_error", "message": str(e)},
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "upload_url_generation_failed", "message": str(e)},
        )


@router.post(
    "/{npo_id}/branding/logo-upload-local",
    response_model=BrandingUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload logo (local storage)",
    description="Upload logo file directly to local storage (development mode).",
)
async def upload_logo_local(
    npo_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> BrandingUpdateResponse:
    """Upload logo file directly to local storage.

    This endpoint is used in development when Azure Blob Storage is not configured.

    Requires:
    - User must be NPO admin or co-admin
    - File must be image type (jpg, png, gif, webp)
    - File size ≤ 5MB

    Returns:
    - 200: Updated branding with logo_url
    - 401: Not authenticated
    - 403: No permission (requires admin)
    - 422: Invalid file type or size
    """
    # Check permission
    permission_service = NPOPermissionService()
    can_manage = await permission_service.can_manage_npo(db, current_user, npo_id)

    if not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "insufficient_permissions",
                "message": "Only NPO admins can upload logos",
            },
        )

    # Read file content
    try:
        file_content = await file.read()
        file_size = len(file_content)
        content_type = file.content_type or "application/octet-stream"
        file_name = file.filename or "logo.png"

        print("\n=== LOGO UPLOAD DEBUG ===")
        print(f"NPO ID: {npo_id}")
        print(f"File name: {file_name}")
        print(f"File size: {file_size} bytes")
        print(f"Content type: {content_type}")
        print("========================\n")

        logger.info(
            f"Logo upload attempt: npo_id={npo_id}, file_name={file_name}, "
            f"file_size={file_size}, content_type={content_type}"
        )

        # Validate and upload
        file_upload_service = FileUploadService(settings)

        # Validate file
        is_valid, error_msg = file_upload_service.validate_image_file(
            file_content, content_type, file_name
        )
        if not is_valid:
            logger.error(f"File validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Upload file to Azure or local storage
        logo_url = file_upload_service.upload_file(
            npo_id=npo_id,
            file_name=file_name,
            content_type=content_type,
            file_content=file_content,
        )

        # Update branding with logo URL
        branding_service = BrandingService()

        # Get current branding first
        current_branding = await branding_service.get_branding(db, npo_id)

        # Update only the logo_url field
        current_branding.logo_url = logo_url
        await db.commit()
        await db.refresh(current_branding)

        # Convert to response
        branding_response = BrandingResponse.model_validate(current_branding)

        return BrandingUpdateResponse(
            message="Logo uploaded successfully",
            branding=branding_response,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "validation_error", "message": str(e)},
        )

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "npo_not_found", "message": "NPO not found"},
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "logo_upload_failed", "message": str(e)},
        )

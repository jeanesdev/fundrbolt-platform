"""
NPO Service

Business logic for NPO creation, management, and CRUD operations.
Handles multi-tenant data isolation and status transitions.
"""

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.npo import NPO, NPOStatus
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.schemas.npo import NPOCreateRequest, NPOListRequest, NPOUpdateRequest
from app.services.npo_permission_service import NPOPermissionService

logger = logging.getLogger(__name__)


class NPOService:
    """Service for NPO management operations."""

    @staticmethod
    async def create_npo(
        db: AsyncSession,
        npo_data: NPOCreateRequest,
        created_by_user_id: uuid.UUID,
    ) -> NPO:
        """
        Create a new NPO in DRAFT status.

        Args:
            db: Database session
            npo_data: NPO creation data
            created_by_user_id: User creating the NPO

        Returns:
            Created NPO object

        Raises:
            HTTPException: If name is duplicate or validation fails
        """
        # Check for duplicate name
        existing = await db.execute(
            select(NPO).where(
                and_(
                    func.lower(NPO.name) == npo_data.name.lower(),
                    NPO.deleted_at.is_(None),
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"NPO with name '{npo_data.name}' already exists",
            )

        # Create NPO
        npo = NPO(
            **npo_data.model_dump(),
            status=NPOStatus.DRAFT,
            created_by_user_id=created_by_user_id,
        )

        db.add(npo)
        await db.flush()  # Get npo.id

        # Add creator as admin member
        member = NPOMember(
            npo_id=npo.id,
            user_id=created_by_user_id,
            role=MemberRole.ADMIN,
            status=MemberStatus.ACTIVE,
            joined_at=datetime.utcnow(),
        )
        db.add(member)

        await db.commit()
        await db.refresh(npo)

        logger.info(f"NPO created: {npo.name} (ID: {npo.id}) by user {created_by_user_id}")

        return npo

    @staticmethod
    async def get_npo_by_id(
        db: AsyncSession,
        npo_id: uuid.UUID,
        include_deleted: bool = False,
    ) -> NPO | None:
        """
        Get NPO by ID with relationships.

        Args:
            db: Database session
            npo_id: NPO UUID
            include_deleted: Include soft-deleted NPOs

        Returns:
            NPO object or None if not found
        """
        query = select(NPO).where(NPO.id == npo_id)

        if not include_deleted:
            query = query.where(NPO.deleted_at.is_(None))

        # Eager load relationships
        query = query.options(
            selectinload(NPO.branding),
            selectinload(NPO.members).selectinload(NPOMember.user),
            selectinload(NPO.applications),
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_npos(
        db: AsyncSession,
        current_user: User,
        list_params: NPOListRequest,
    ) -> tuple[list[NPO], int]:
        """
        List NPOs with filtering and pagination based on user permissions.

        Args:
            db: Database session
            current_user: User making the request
            list_params: Filter and pagination parameters

        Returns:
            Tuple of (NPO list, total count)
        """
        # Build base query
        query = select(NPO).where(NPO.deleted_at.is_(None))

        # Apply permission filtering
        if current_user.role_name == "super_admin":  # type: ignore[attr-defined]
            # SuperAdmin sees all NPOs
            pass
        else:
            # Filter to NPOs user is a member of or created
            permission_service = NPOPermissionService()
            npos_filter = await permission_service.filter_npos_by_permission(db, current_user)
            query = query.where(NPO.id.in_(npos_filter))

        # Apply status filter
        if list_params.status:
            try:
                status_enum = NPOStatus(list_params.status)
                query = query.where(NPO.status == status_enum)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {list_params.status}. Valid options: {[s.value for s in NPOStatus]}",
                )

        # Apply search filter
        if list_params.search:
            search_term = f"%{list_params.search}%"
            query = query.where(
                or_(
                    NPO.name.ilike(search_term),
                    NPO.description.ilike(search_term),
                    NPO.mission_statement.ilike(search_term),
                )
            )

        # Apply creator filter (SuperAdmin only)
        if list_params.created_by_user_id:
            if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only SuperAdmins can filter by creator",
                )
            query = query.where(NPO.created_by_user_id == list_params.created_by_user_id)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        query = query.order_by(NPO.created_at.desc())
        query = query.limit(list_params.page_size)
        query = query.offset((list_params.page - 1) * list_params.page_size)

        # Execute query
        result = await db.execute(query)
        npos = result.scalars().all()

        return list(npos), total

    @staticmethod
    async def update_npo(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_data: NPOUpdateRequest,
        updated_by_user_id: uuid.UUID,
    ) -> NPO:
        """
        Update NPO details.

        Args:
            db: Database session
            npo_id: NPO UUID
            npo_data: Partial update data
            updated_by_user_id: User making the update

        Returns:
            Updated NPO object

        Raises:
            HTTPException: If NPO not found, duplicate name, or invalid status
        """
        # Get NPO
        npo = await NPOService.get_npo_by_id(db, npo_id)
        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {npo_id} not found",
            )

        # Check if status allows editing
        if npo.status == NPOStatus.PENDING_APPROVAL:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot edit NPO while application is PENDING_APPROVAL. Wait for review or withdraw application.",
            )

        # Check for duplicate name (if name is being changed)
        if npo_data.name and npo_data.name != npo.name:
            existing = await db.execute(
                select(NPO).where(
                    and_(
                        func.lower(NPO.name) == npo_data.name.lower(),
                        NPO.id != npo_id,
                        NPO.deleted_at.is_(None),
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"NPO with name '{npo_data.name}' already exists",
                )

        # Update fields
        for field, value in npo_data.model_dump(exclude_unset=True).items():
            setattr(npo, field, value)

        npo.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(npo)

        logger.info(f"NPO updated: {npo.name} (ID: {npo.id}) by user {updated_by_user_id}")

        return npo

    @staticmethod
    async def update_npo_status(
        db: AsyncSession,
        npo_id: uuid.UUID,
        new_status: str,
        notes: str | None = None,
    ) -> NPO:
        """
        Update NPO status (SuperAdmin only).

        Args:
            db: Database session
            npo_id: NPO UUID
            new_status: New status value
            notes: Optional status change notes

        Returns:
            Updated NPO object

        Raises:
            HTTPException: If NPO not found or invalid transition
        """
        # Get NPO
        npo = await NPOService.get_npo_by_id(db, npo_id)
        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {npo_id} not found",
            )

        # Validate status value
        try:
            new_status_enum = NPOStatus(new_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {new_status}. Valid options: {[s.value for s in NPOStatus]}",
            )

        # Validate status transition
        old_status = npo.status
        valid_transitions = {
            NPOStatus.DRAFT: [NPOStatus.PENDING_APPROVAL],
            NPOStatus.PENDING_APPROVAL: [NPOStatus.APPROVED, NPOStatus.REJECTED],
            NPOStatus.APPROVED: [NPOStatus.SUSPENDED],
            NPOStatus.SUSPENDED: [NPOStatus.APPROVED],
            NPOStatus.REJECTED: [NPOStatus.DRAFT],
        }

        if new_status_enum not in valid_transitions.get(old_status, []):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid status transition from {old_status.value} to {new_status}",
            )

        # Update status
        npo.status = new_status_enum
        npo.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(npo)

        logger.info(
            f"NPO status changed: {npo.name} (ID: {npo.id}) from {old_status.value} to {new_status}"
        )

        return npo

    @staticmethod
    async def delete_npo(
        db: AsyncSession,
        npo_id: uuid.UUID,
        deleted_by_user_id: uuid.UUID,
    ) -> None:
        """
        Soft delete NPO (SuperAdmin only).

        Args:
            db: Database session
            npo_id: NPO UUID
            deleted_by_user_id: User deleting the NPO

        Raises:
            HTTPException: If NPO not found or status doesn't allow deletion
        """
        # Get NPO
        npo = await NPOService.get_npo_by_id(db, npo_id)
        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {npo_id} not found",
            )

        # Check if status allows deletion
        if npo.status in [NPOStatus.APPROVED, NPOStatus.SUSPENDED]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete NPO with status {npo.status.value}. Suspend first if needed.",
            )

        # Soft delete
        npo.deleted_at = datetime.utcnow()
        npo.updated_at = datetime.utcnow()

        await db.commit()

        logger.info(f"NPO deleted: {npo.name} (ID: {npo.id}) by user {deleted_by_user_id}")

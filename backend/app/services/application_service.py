"""Application service for NPO application submission and review."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.npo import NPO, NPOStatus
from app.models.user import User
from app.services.audit_service import AuditService

logger = get_logger(__name__)


class ApplicationService:
    """
    Service for managing NPO application workflows.

    Handles:
    - Application submission (DRAFT → PENDING_APPROVAL)
    - SuperAdmin review (approve/reject)
    - State transition validation
    - Email notifications
    """

    @staticmethod
    async def submit_application(
        db: AsyncSession,
        npo_id: UUID,
        submitted_by_user_id: UUID,
    ) -> NPO:
        """
        Submit NPO application for SuperAdmin review.

        Validates:
        - NPO exists and is in DRAFT status
        - User has permission to submit (creator or admin)
        - All required fields are complete

        State transition: DRAFT → PENDING_APPROVAL

        Args:
            db: Database session
            npo_id: NPO ID to submit
            submitted_by_user_id: User submitting the application

        Returns:
            Updated NPO with PENDING_APPROVAL status

        Raises:
            HTTPException: If validation fails or state transition is invalid
        """
        # Fetch NPO with creator relationship
        stmt = (
            select(NPO)
            .options(selectinload(NPO.creator))
            .where(NPO.id == npo_id, NPO.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        npo = result.scalar_one_or_none()

        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {npo_id} not found",
            )

        # Validate user permission
        if str(npo.created_by_user_id) != str(submitted_by_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the NPO creator can submit the application",
            )

        # Validate current status
        if npo.status != NPOStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit application: NPO status is {npo.status.value}, must be 'draft'",
            )

        # Validate required fields
        field_labels = {
            "name": "Organization Name",
            "description": "Description",
            "email": "Email Address",
            "phone": "Phone Number",
            "address": "Physical Address",
            "tax_id": "Tax ID (EIN)",
        }
        missing_fields = []
        if not npo.name:
            missing_fields.append("name")
        if not npo.description:
            missing_fields.append("description")
        if not npo.email:
            missing_fields.append("email")
        if not npo.phone:
            missing_fields.append("phone")
        if not npo.address:
            missing_fields.append("address")
        if not npo.tax_id:
            missing_fields.append("tax_id")

        if missing_fields:
            missing_labels = [field_labels[field] for field in missing_fields]
            if len(missing_labels) == 1:
                detail = f"Please complete the required field: {missing_labels[0]}"
            else:
                detail = (
                    f"Please complete the following required fields: {', '.join(missing_labels)}"
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            )

        # Update status
        npo.status = NPOStatus.PENDING_APPROVAL
        await db.commit()
        await db.refresh(npo)

        # Log audit event
        await AuditService.log_npo_status_changed(
            db=db,
            npo_id=npo_id,
            npo_name=npo.name,
            old_status="draft",
            new_status="pending_approval",
            changed_by_user_id=submitted_by_user_id,
            changed_by_email=npo.creator.email,
            notes="Application submitted for review",
        )

        logger.info(
            f"NPO application submitted: {npo.name} (ID: {npo_id})",
            extra={"npo_id": str(npo_id), "submitted_by": str(submitted_by_user_id)},
        )

        return npo

    @staticmethod
    async def review_application(
        db: AsyncSession,
        npo_id: UUID,
        reviewer_id: UUID,
        decision: str,  # "approve" or "reject"
        notes: str | None = None,
    ) -> NPO:
        """
        Review NPO application (SuperAdmin only).

        State transitions:
        - PENDING_APPROVAL → APPROVED (on approval)
        - PENDING_APPROVAL → REJECTED (on rejection)

        Args:
            db: Database session
            npo_id: NPO ID to review
            reviewer_id: SuperAdmin user ID
            decision: "approve" or "reject"
            notes: Optional review notes/feedback

        Returns:
            Updated NPO with new status

        Raises:
            HTTPException: If validation fails or state transition is invalid
        """
        # Validate decision
        if decision not in ("approve", "reject"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision must be 'approve' or 'reject'",
            )

        # Fetch NPO with creator
        stmt = (
            select(NPO)
            .options(selectinload(NPO.creator))
            .where(NPO.id == npo_id, NPO.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        npo = result.scalar_one_or_none()

        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {npo_id} not found",
            )

        # Validate current status
        if npo.status != NPOStatus.PENDING_APPROVAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review application: NPO status is {npo.status.value}, must be 'pending_approval'",
            )

        # Update status
        if decision == "approve":
            npo.status = NPOStatus.APPROVED
        else:  # reject
            npo.status = NPOStatus.REJECTED

        await db.commit()
        await db.refresh(npo)

        # Log audit event
        reviewer = await db.get(User, reviewer_id)
        if not reviewer:
            raise HTTPException(status_code=404, detail="Reviewer not found")

        await AuditService.log_npo_application_reviewed(
            db=db,
            npo_id=npo_id,
            npo_name=npo.name,
            status="approved" if decision == "approve" else "rejected",
            reviewed_by_user_id=reviewer_id,
            reviewed_by_email=reviewer.email,
        )

        logger.info(
            f"NPO application {decision}d: {npo.name} (ID: {npo_id})",
            extra={
                "npo_id": str(npo_id),
                "reviewer_id": str(reviewer_id),
                "decision": decision,
            },
        )

        return npo

    @staticmethod
    async def get_pending_applications(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NPO], int]:
        """
        Get all NPOs with PENDING_APPROVAL status (SuperAdmin only).

        Args:
            db: Database session
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return

        Returns:
            Tuple of (list of pending NPOs, total count)
        """
        # Count query
        count_stmt = select(NPO).where(
            NPO.status == NPOStatus.PENDING_APPROVAL,
            NPO.deleted_at.is_(None),
        )
        count_result = await db.execute(count_stmt)
        total = len(count_result.scalars().all())

        # Data query with pagination
        stmt = (
            select(NPO)
            .options(selectinload(NPO.creator))
            .where(
                NPO.status == NPOStatus.PENDING_APPROVAL,
                NPO.deleted_at.is_(None),
            )
            .order_by(NPO.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        npos = result.scalars().all()

        return list(npos), total

    @staticmethod
    async def get_application_by_npo_id(
        db: AsyncSession,
        npo_id: UUID,
    ) -> NPO | None:
        """
        Get NPO application details by NPO ID.

        Args:
            db: Database session
            npo_id: NPO ID

        Returns:
            NPO object or None if not found
        """
        stmt = (
            select(NPO)
            .options(selectinload(NPO.creator))
            .where(NPO.id == npo_id, NPO.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

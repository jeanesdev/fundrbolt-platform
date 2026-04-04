"""Admin API endpoints for donor labels."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.donor_label import DonorLabel
from app.models.donor_label_assignment import DonorLabelAssignment
from app.models.npo import NPO
from app.models.npo_member import MemberStatus, NPOMember
from app.models.user import User
from app.schemas.donor_label import (
    DonorLabelAssignmentInfo,
    DonorLabelAssignRequest,
    DonorLabelCreateRequest,
    DonorLabelListResponse,
    DonorLabelResponse,
    DonorLabelUpdateRequest,
)

router = APIRouter(prefix="/admin/npos/{npo_id}/donor-labels", tags=["admin-donor-labels"])


async def _require_npo_access(
    npo_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> NPO:
    """Verify the user has access to the NPO."""
    role_name = getattr(current_user, "role_name", "")

    if role_name == "super_admin":
        stmt = select(NPO).where(NPO.id == npo_id)
        result = await db.execute(stmt)
        npo = result.scalar_one_or_none()
        if not npo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NPO not found")
        return npo

    # Check NPO membership (any active member can manage labels)
    member_stmt = select(NPOMember).where(
        NPOMember.npo_id == npo_id,
        NPOMember.user_id == current_user.id,
        NPOMember.status == MemberStatus.ACTIVE,
    )
    result = await db.execute(member_stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    npo_stmt = select(NPO).where(NPO.id == npo_id)
    result = await db.execute(npo_stmt)
    npo = result.scalar_one_or_none()
    if not npo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NPO not found")
    return npo


@router.get("", response_model=DonorLabelListResponse)
async def list_donor_labels(
    npo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DonorLabelListResponse:
    """List all donor labels for an NPO."""
    await _require_npo_access(npo_id, current_user, db)
    stmt = select(DonorLabel).where(DonorLabel.npo_id == npo_id).order_by(DonorLabel.name.asc())
    result = await db.execute(stmt)
    labels = list(result.scalars().all())
    return DonorLabelListResponse(
        items=[DonorLabelResponse.model_validate(label) for label in labels]
    )


@router.post("", response_model=DonorLabelResponse, status_code=status.HTTP_201_CREATED)
async def create_donor_label(
    npo_id: UUID,
    body: DonorLabelCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DonorLabelResponse:
    """Create a new donor label for an NPO."""
    await _require_npo_access(npo_id, current_user, db)

    # Check uniqueness (case-insensitive)
    name = " ".join(body.name.strip().split())
    stmt = select(DonorLabel.id).where(
        DonorLabel.npo_id == npo_id,
        func.lower(DonorLabel.name) == name.lower(),
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Label '{name}' already exists for this NPO",
        )

    label = DonorLabel(npo_id=npo_id, name=name, color=body.color)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return DonorLabelResponse.model_validate(label)


@router.patch("/{label_id}", response_model=DonorLabelResponse)
async def update_donor_label(
    npo_id: UUID,
    label_id: UUID,
    body: DonorLabelUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DonorLabelResponse:
    """Update a donor label."""
    await _require_npo_access(npo_id, current_user, db)

    stmt = select(DonorLabel).where(DonorLabel.id == label_id, DonorLabel.npo_id == npo_id)
    result = await db.execute(stmt)
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    if body.name is not None:
        name = " ".join(body.name.strip().split())
        # Check uniqueness excluding self
        dup_stmt = select(DonorLabel.id).where(
            DonorLabel.npo_id == npo_id,
            func.lower(DonorLabel.name) == name.lower(),
            DonorLabel.id != label_id,
        )
        dup_result = await db.execute(dup_stmt)
        if dup_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Label '{name}' already exists for this NPO",
            )
        label.name = name

    if body.color is not None:
        label.color = body.color

    await db.commit()
    await db.refresh(label)
    return DonorLabelResponse.model_validate(label)


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_donor_label(
    npo_id: UUID,
    label_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a donor label and all its assignments."""
    await _require_npo_access(npo_id, current_user, db)

    stmt = select(DonorLabel).where(DonorLabel.id == label_id, DonorLabel.npo_id == npo_id)
    result = await db.execute(stmt)
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    await db.delete(label)
    await db.commit()


# ── User label assignments ──────────────────────────────────────────


@router.get("/users/{user_id}", response_model=list[DonorLabelAssignmentInfo])
async def get_user_labels(
    npo_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DonorLabelAssignmentInfo]:
    """Get all donor labels assigned to a user within this NPO."""
    await _require_npo_access(npo_id, current_user, db)

    stmt = (
        select(DonorLabel)
        .join(DonorLabelAssignment, DonorLabel.id == DonorLabelAssignment.label_id)
        .where(
            DonorLabelAssignment.user_id == user_id,
            DonorLabel.npo_id == npo_id,
        )
        .order_by(DonorLabel.name.asc())
    )
    result = await db.execute(stmt)
    labels = list(result.scalars().all())
    return [
        DonorLabelAssignmentInfo(id=label.id, name=label.name, color=label.color)
        for label in labels
    ]


@router.put("/users/{user_id}", response_model=list[DonorLabelAssignmentInfo])
async def set_user_labels(
    npo_id: UUID,
    user_id: UUID,
    body: DonorLabelAssignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DonorLabelAssignmentInfo]:
    """Set the donor labels for a user (replaces existing assignments)."""
    await _require_npo_access(npo_id, current_user, db)

    # Verify user exists
    user_stmt = select(User.id).where(User.id == user_id)
    user_result = await db.execute(user_stmt)
    if user_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Verify all label_ids belong to this NPO
    if body.label_ids:
        labels_stmt = select(DonorLabel).where(
            DonorLabel.id.in_(body.label_ids),
            DonorLabel.npo_id == npo_id,
        )
        labels_result = await db.execute(labels_stmt)
        found_labels = {label.id: label for label in labels_result.scalars().all()}
        missing = set(body.label_ids) - set(found_labels.keys())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Labels not found in this NPO: {[str(x) for x in missing]}",
            )
    else:
        found_labels = {}

    # Remove existing assignments for this NPO
    existing_stmt = (
        select(DonorLabelAssignment)
        .join(DonorLabel, DonorLabel.id == DonorLabelAssignment.label_id)
        .where(
            DonorLabelAssignment.user_id == user_id,
            DonorLabel.npo_id == npo_id,
        )
        .options(selectinload(DonorLabelAssignment.label))
    )
    existing_result = await db.execute(existing_stmt)
    for assignment in existing_result.scalars().all():
        await db.delete(assignment)

    # Create new assignments
    for label_id in body.label_ids:
        db.add(DonorLabelAssignment(user_id=user_id, label_id=label_id))

    await db.commit()

    # Return updated list
    return [
        DonorLabelAssignmentInfo(id=label.id, name=label.name, color=label.color)
        for label in [found_labels[lid] for lid in body.label_ids if lid in found_labels]
    ]

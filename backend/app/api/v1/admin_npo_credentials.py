"""Admin NPO payment credentials router — T019 skeleton.

Endpoints (US1 — implemented in T022):
  GET    /admin/npos/{npo_id}/payment-credentials       — masked credentials or not-configured
  POST   /admin/npos/{npo_id}/payment-credentials       — create credentials
  PUT    /admin/npos/{npo_id}/payment-credentials       — replace all credentials
  DELETE /admin/npos/{npo_id}/payment-credentials       — delete credentials
  POST   /admin/npos/{npo_id}/payment-credentials/test  — test gateway connectivity

All endpoints require Super Admin privileges (FR-028, FR-029, FR-030).
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.npo import NPO
from app.models.user import User
from app.schemas.payment import (
    CredentialCreate,
    CredentialNotConfigured,
    CredentialRead,
    CredentialTestResponse,
)
from app.services.payment_gateway_credential_service import (
    PaymentGatewayCredentialService,
)

router = APIRouter(prefix="/admin/npos", tags=["admin-npo-credentials"])


# ── Auth guard ────────────────────────────────────────────────────────────────


def require_superadmin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Verify the caller is a Super Admin."""
    if getattr(current_user, "role_name", None) != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required for this operation",
        )
    return current_user


# ── NPO existence check ───────────────────────────────────────────────────────


async def _get_npo_or_404(npo_id: UUID, db: AsyncSession) -> NPO:
    result = await db.execute(select(NPO).where(NPO.id == npo_id))
    npo = result.scalar_one_or_none()
    if npo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPO {npo_id} not found",
        )
    return npo


# ── GET ───────────────────────────────────────────────────────────────────────


@router.get(
    "/{npo_id}/payment-credentials",
    summary="Get NPO payment credentials (masked)",
    response_model=None,
)
async def get_payment_credentials(
    npo_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_superadmin)],
) -> CredentialRead | CredentialNotConfigured:
    """Return masked payment credentials for *npo_id*.

    If no credentials are configured, returns ``{"npo_id": "...", "configured": false}``.
    Sensitive fields are never returned in plaintext (FR-029).
    """
    await _get_npo_or_404(npo_id, db)

    service = PaymentGatewayCredentialService(db)
    cred = await service.get_or_none(npo_id)

    if cred is None:
        return CredentialNotConfigured(npo_id=npo_id)

    return service.to_masked_response(cred)


# ── POST ──────────────────────────────────────────────────────────────────────


@router.post(
    "/{npo_id}/payment-credentials",
    status_code=status.HTTP_201_CREATED,
    summary="Create NPO payment credentials",
    response_model=CredentialRead,
)
async def create_payment_credentials(
    npo_id: UUID,
    data: CredentialCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_superadmin)],
) -> CredentialRead:
    """Create Deluxe/stub credentials for *npo_id*.

    Returns 409 Conflict if credentials already exist — use PUT to replace them.
    Credentials are Fernet-encrypted before storage.
    """
    await _get_npo_or_404(npo_id, db)

    service = PaymentGatewayCredentialService(db)
    cred = await service.create(npo_id, data)
    return service.to_masked_response(cred)


# ── PUT ───────────────────────────────────────────────────────────────────────


@router.put(
    "/{npo_id}/payment-credentials",
    summary="Replace NPO payment credentials",
    response_model=CredentialRead,
)
async def replace_payment_credentials(
    npo_id: UUID,
    data: CredentialCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_superadmin)],
) -> CredentialRead:
    """Replace all payment credentials for *npo_id* (full replacement).

    Returns 404 Not Found if no credentials exist — use POST to create them first.
    """
    await _get_npo_or_404(npo_id, db)

    service = PaymentGatewayCredentialService(db)
    cred = await service.update(npo_id, data)
    return service.to_masked_response(cred)


# ── DELETE ────────────────────────────────────────────────────────────────────


@router.delete(
    "/{npo_id}/payment-credentials",
    summary="Delete NPO payment credentials",
)
async def delete_payment_credentials(
    npo_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_superadmin)],
) -> dict[str, Any]:
    """Remove payment credentials for *npo_id*.

    The NPO will no longer be able to collect payments.
    Returns 404 if no credentials exist.
    """
    await _get_npo_or_404(npo_id, db)

    service = PaymentGatewayCredentialService(db)
    await service.delete(npo_id)
    return {"deleted": True}


# ── TEST ──────────────────────────────────────────────────────────────────────


@router.post(
    "/{npo_id}/payment-credentials/test",
    summary="Test NPO payment gateway credentials",
    response_model=CredentialTestResponse,
)
async def test_payment_credentials(
    npo_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_superadmin)],
) -> CredentialTestResponse:
    """Validate stored credentials via a lightweight gateway ping (FR-030).

    Calls ``create_hosted_session()`` with $0 to verify connectivity.
    Returns 200 for both success and authentication failures — the ``success``
    field drives the UI state.  Returns 503 on network errors.
    """
    await _get_npo_or_404(npo_id, db)

    service = PaymentGatewayCredentialService(db)
    return await service.test_connection(npo_id)

"""Payment gateway FastAPI dependency factory.

T016 — Phase 2.

Usage:
    from app.core.payment_deps import get_payment_gateway

    @router.post("/payments/session")
    async def create_session(
        gateway: PaymentGatewayPort = Depends(get_payment_gateway),
    ):
        ...

Returns the correct PaymentGatewayPort implementation based on the
PAYMENT_GATEWAY_BACKEND env var:
  - "stub"   → StubPaymentGateway (local dev / CI)
  - "deluxe" → DeluxePaymentGateway (instantiated with NPO credentials from DB)

For NPO-scoped deluxe instances, use `get_npo_payment_gateway(npo_id, db)` which
looks up credentials, decrypts them, and returns a configured DeluxePaymentGateway.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import Depends

from app.core.config import get_settings
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_gateway.stub_gateway import StubPaymentGateway

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def get_payment_gateway() -> PaymentGatewayPort:
    """FastAPI dependency: return the configured payment gateway singleton.

    For stub backend, returns a shared StubPaymentGateway.
    For deluxe backend, raises RuntimeError — use `get_npo_payment_gateway()` instead
    which requires NPO credentials from the DB.

    Raises:
        RuntimeError: If PAYMENT_GATEWAY_BACKEND is set to an unknown value.
    """
    settings = get_settings()
    backend = settings.payment_gateway_backend.lower()

    if backend == "stub":
        return StubPaymentGateway(stub_hpf_base_url=settings.stub_hpf_base_url)

    if backend == "deluxe":
        raise RuntimeError(
            "Cannot create DeluxePaymentGateway without NPO credentials. "
            "Use get_npo_payment_gateway(npo_id, db) for endpoints that require "
            "NPO-specific Deluxe credentials."
        )

    raise RuntimeError(
        f"Unknown PAYMENT_GATEWAY_BACKEND: {backend!r}. Valid values: 'stub', 'deluxe'."
    )


async def get_npo_payment_gateway(
    npo_id: str,
    db: AsyncSession,
) -> PaymentGatewayPort:
    """Return a PaymentGatewayPort instance configured for the given NPO.

    For stub backend: always returns StubPaymentGateway (credentials ignored).
    For deluxe backend: loads NPO credentials from DB, decrypts them, and
    returns a configured DeluxePaymentGateway.

    Args:
        npo_id: UUID string of the NPO whose credentials to load.
        db: Open AsyncSession (inject via FastAPI Depends).

    Raises:
        HTTPException 404: If no credentials found for npo_id.
        HTTPException 503: If credentials exist but are marked inactive.
        CredentialEncryptionError: If decryption fails.
    """
    from uuid import UUID

    from fastapi import HTTPException
    from sqlalchemy import select

    from app.core.encryption import decrypt_credential
    from app.models.payment_gateway_credential import PaymentGatewayCredential
    from app.services.payment_gateway.deluxe_gateway import DeluxePaymentGateway

    settings = get_settings()
    backend = settings.payment_gateway_backend.lower()

    if backend == "stub":
        return StubPaymentGateway(stub_hpf_base_url=settings.stub_hpf_base_url)

    if backend != "deluxe":
        raise RuntimeError(
            f"Unknown PAYMENT_GATEWAY_BACKEND: {backend!r}. Valid values: 'stub', 'deluxe'."
        )

    # Load credentials from DB
    result = await db.execute(
        select(PaymentGatewayCredential).where(PaymentGatewayCredential.npo_id == UUID(str(npo_id)))
    )
    cred = result.scalar_one_or_none()

    if cred is None:
        raise HTTPException(
            status_code=404,
            detail=f"No payment credentials configured for NPO {npo_id}. "
            "Configure credentials via /admin/npos/{npo_id}/payment-credentials.",
        )
    if not cred.is_active:
        raise HTTPException(
            status_code=503,
            detail="NPO payment credentials are currently disabled.",
        )

    return DeluxePaymentGateway(
        merchant_id=decrypt_credential(cred.merchant_id_enc),
        api_key=decrypt_credential(cred.api_key_enc),
        api_secret=decrypt_credential(cred.api_secret_enc),
        gateway_id=cred.gateway_id,
        is_live_mode=cred.is_live_mode,
    )


# Convenient type alias for FastAPI Depends
PaymentGatewayDep = Annotated[PaymentGatewayPort, Depends(get_payment_gateway)]

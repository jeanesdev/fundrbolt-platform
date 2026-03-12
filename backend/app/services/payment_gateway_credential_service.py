"""PaymentGatewayCredentialService — create, read, update, delete and test NPO credentials.

T021 — Phase 3 (US1).

All sensitive credential values (merchant_id, api_key, api_secret) are Fernet-encrypted
before storage and are never returned in plaintext.  The ``to_masked_response()`` helper
exposes only the last 4 characters of each secret so admins can confirm they are looking at
the expected record.
"""

import time
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.encryption import decrypt_credential, encrypt_credential
from app.models.payment_gateway_credential import PaymentGatewayCredential
from app.schemas.payment import CredentialCreate, CredentialRead, CredentialTestResponse
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_gateway.stub_gateway import StubPaymentGateway


class PaymentGatewayCredentialService:
    """Manage per-NPO payment gateway credentials.

    Usage::

        service = PaymentGatewayCredentialService(db)
        cred = await service.create(npo_id, data)
        response = service.to_masked_response(cred)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def get_or_none(self, npo_id: uuid.UUID) -> PaymentGatewayCredential | None:
        """Return the credential record for *npo_id* or ``None`` if it doesn't exist."""
        result = await self.db.execute(
            select(PaymentGatewayCredential).where(PaymentGatewayCredential.npo_id == npo_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _mask(value: str) -> str:
        """Return value with all but the last 4 characters replaced by '*'.

        If the value is 4 characters or fewer the entire value is masked as ``"****"``.
        """
        if len(value) <= 4:
            return "****"
        return "*" * (len(value) - 4) + value[-4:]

    def to_masked_response(self, cred: PaymentGatewayCredential) -> CredentialRead:
        """Build a :class:`CredentialRead` response with all secrets masked.

        Decrypts the stored ciphertexts *only* to compute the mask — plaintext
        is never stored in the response object.
        """
        merchant_id_plain = decrypt_credential(cred.merchant_id_enc)
        api_key_plain = decrypt_credential(cred.api_key_enc)
        return CredentialRead(
            id=cred.id,
            npo_id=cred.npo_id,
            gateway_name=cred.gateway_name,
            merchant_id_masked=self._mask(merchant_id_plain),
            api_key_masked=self._mask(api_key_plain),
            gateway_id=cred.gateway_id,
            is_live_mode=cred.is_live_mode,
            is_active=cred.is_active,
            created_at=cred.created_at,
            updated_at=cred.updated_at,
        )

    def _build_gateway(self, cred: PaymentGatewayCredential) -> PaymentGatewayPort:
        """Instantiate the correct gateway implementation from stored credentials."""
        if cred.gateway_name == "stub":
            settings = get_settings()
            return StubPaymentGateway(stub_hpf_base_url=settings.stub_hpf_base_url)

        # deluxe — decrypt credentials on demand
        from app.services.payment_gateway.deluxe_gateway import DeluxePaymentGateway

        return DeluxePaymentGateway(
            merchant_id=decrypt_credential(cred.merchant_id_enc),
            api_key=decrypt_credential(cred.api_key_enc),
            api_secret=decrypt_credential(cred.api_secret_enc),
            gateway_id=cred.gateway_id,
            is_live_mode=cred.is_live_mode,
        )

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def create(self, npo_id: uuid.UUID, data: CredentialCreate) -> PaymentGatewayCredential:
        """Create new credentials for *npo_id*.

        Raises:
            HTTPException 409: Credentials already exist (use :meth:`update`).
        """
        existing = await self.get_or_none(npo_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Credentials already exist for this NPO. Use PUT to update.",
            )

        cred = PaymentGatewayCredential(
            npo_id=npo_id,
            gateway_name=data.gateway_name,
            merchant_id_enc=encrypt_credential(data.merchant_id),
            api_key_enc=encrypt_credential(data.api_key),
            api_secret_enc=encrypt_credential(data.api_secret),
            gateway_id=data.gateway_id,
            is_live_mode=data.is_live_mode,
        )
        self.db.add(cred)
        await self.db.commit()
        await self.db.refresh(cred)
        return cred

    async def update(self, npo_id: uuid.UUID, data: CredentialCreate) -> PaymentGatewayCredential:
        """Replace all credential fields for *npo_id* (full replacement via PUT).

        Raises:
            HTTPException 404: No credentials exist yet (use :meth:`create`).
        """
        cred = await self.get_or_none(npo_id)
        if cred is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No credentials configured for this NPO. Use POST to create.",
            )

        cred.gateway_name = data.gateway_name
        cred.merchant_id_enc = encrypt_credential(data.merchant_id)
        cred.api_key_enc = encrypt_credential(data.api_key)
        cred.api_secret_enc = encrypt_credential(data.api_secret)
        cred.gateway_id = data.gateway_id
        cred.is_live_mode = data.is_live_mode

        await self.db.commit()
        await self.db.refresh(cred)
        return cred

    async def delete(self, npo_id: uuid.UUID) -> None:
        """Delete the credential record for *npo_id*.

        Raises:
            HTTPException 404: No credentials to delete.
        """
        cred = await self.get_or_none(npo_id)
        if cred is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No credentials configured for this NPO.",
            )

        await self.db.delete(cred)
        await self.db.commit()

    # ── Connectivity test ─────────────────────────────────────────────────────

    async def test_connection(self, npo_id: uuid.UUID) -> CredentialTestResponse:
        """Validate stored credentials by making a lightweight gateway ping.

        Calls ``create_hosted_session()`` with a $0 amount as a connectivity check.
        Returns a :class:`CredentialTestResponse` regardless of outcome — the
        ``success`` field drives UI state.

        Raises:
            HTTPException 404: No credentials configured for this NPO.
            HTTPException 503: Network unreachable (propagated as 503).
        """
        cred = await self.get_or_none(npo_id)
        if cred is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No credentials configured for this NPO.",
            )

        gateway = self._build_gateway(cred)
        mode_label = "Live" if cred.is_live_mode else "Sandbox"
        start = time.monotonic()

        try:
            await gateway.create_hosted_session(
                transaction_id=uuid.uuid4(),
                amount=Decimal("0"),
                return_url="",
                webhook_url="",
                save_profile=False,
                metadata={"test_connection": True},
            )
            latency_ms = int((time.monotonic() - start) * 1000)
            return CredentialTestResponse(
                success=True,
                gateway_name=cred.gateway_name,
                is_live_mode=cred.is_live_mode,
                message=f"{mode_label} credentials verified successfully",
                latency_ms=latency_ms,
            )

        except NotImplementedError:
            # Deluxe gateway skeleton — not yet implemented
            latency_ms = int((time.monotonic() - start) * 1000)
            return CredentialTestResponse(
                success=False,
                gateway_name=cred.gateway_name,
                is_live_mode=cred.is_live_mode,
                message="Deluxe gateway integration not yet implemented",
                latency_ms=latency_ms,
            )

        except OSError as exc:
            # Network-level failure — propagate as 503 so callers can distinguish
            # from authentication failures.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Gateway unreachable: {exc}",
            ) from exc

        except Exception as exc:  # noqa: BLE001
            latency_ms = int((time.monotonic() - start) * 1000)
            return CredentialTestResponse(
                success=False,
                gateway_name=cred.gateway_name,
                is_live_mode=cred.is_live_mode,
                message=str(exc),
                latency_ms=latency_ms,
            )

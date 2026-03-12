"""Donor payments router — Phase 4 + Phase 6 endpoints.

Endpoints:
  POST   /payments/session                        — create HPF session (US2)
  GET    /payments/stub-hpf                       — stub HPF HTML page (stub backend only)
  GET    /payments/profiles                       — list saved cards (US2)
  POST   /payments/profiles                       — save card after HPF completion (US2)
  DELETE /payments/profiles/{profile_id}          — delete saved card (US2)
  PATCH  /payments/profiles/{profile_id}/default  — set default card (US2)

  POST   /payments/webhook                        — gateway IPN handler (US4 / T035)
  GET    /payments/transactions/{id}              — get transaction details (US4 / T035)
  GET    /payments/transactions/{id}/receipt      — download PDF receipt (US4 / T035)

  Future (Phase 8+):
  GET    /payments/checkout/balance               — outstanding balance
  POST   /payments/checkout                       — end-of-night self-checkout
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.payment_deps import get_payment_gateway
from app.middleware.auth import get_current_active_user
from app.models.payment_receipt import PaymentReceipt
from app.models.payment_transaction import PaymentTransaction
from app.models.user import User
from app.schemas.payment import (
    CheckoutBalanceResponse,
    CheckoutRequest,
    CheckoutResponse,
    PaymentProfileCreate,
    PaymentProfileRead,
    PaymentSessionRequest,
    PaymentSessionResponse,
)
from app.services.checkout_service import (
    CheckoutNotOpenError,
    CheckoutService,
    ZeroBalanceError,
)
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_profile_service import PaymentProfileService, profile_to_read
from app.services.payment_transaction_service import PaymentTransactionService

router = APIRouter(prefix="/payments", tags=["payments"])

# ── Typed dependency aliases ──────────────────────────────────────────────────

CurrentUser = Annotated[User, Depends(get_current_active_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
Gateway = Annotated[PaymentGatewayPort, Depends(get_payment_gateway)]


# ── HPF Session ───────────────────────────────────────────────────────────────


@router.post("/session", response_model=PaymentSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_session(
    body: PaymentSessionRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> PaymentSessionResponse:
    """Create a hosted payment form (HPF) session for the authenticated donor.

    Returns a short-lived session URL to embed in an iframe.  The session is
    associated with a PENDING PaymentTransaction persisted in the database.
    Idempotent: returns the existing session if the same idempotency_key is
    retried while the transaction is still PENDING.

    **Errors**:
    - 404 if the event does not exist
    - 409 if the idempotency_key has already been used for a non-PENDING transaction
    - 503 if the payment gateway is unreachable
    """
    svc = PaymentTransactionService(db)
    response = await svc.create_hosted_session(
        user_id=current_user.id,
        request=body,
        gateway=gateway,
    )
    await db.commit()
    return response


# ── Stub HPF page ─────────────────────────────────────────────────────────────


@router.get("/stub-hpf", response_class=HTMLResponse, include_in_schema=False)
async def stub_hpf_page(
    token: str,
    transaction_id: str,
    amount: str = "0.00",
) -> HTMLResponse:
    """Render a local stub hosted payment form for development/testing.

    This endpoint is only meaningful when PAYMENT_GATEWAY_BACKEND=stub.
    It renders a simple HTML page that auto-approves payments and fires a
    postMessage back to the parent iframe when "Pay" is clicked.
    """
    settings = get_settings()
    if settings.payment_gateway_backend.lower() != "stub":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stub HPF is only available in stub mode.",
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stub Payment Form</title>
  <style>
    body {{
      font-family: system-ui, sans-serif;
      max-width: 420px;
      margin: 48px auto;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 8px;
    }}
    .badge {{
      display: inline-block;
      background: #ffc107;
      color: #000;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    h1 {{ font-size: 1.2rem; margin-bottom: 4px; }}
    p {{ color: #555; font-size: 0.9rem; margin-top: 0; }}
    .amount {{
      font-size: 2rem;
      font-weight: 700;
      margin: 16px 0;
    }}
    button {{
      width: 100%;
      padding: 12px;
      background: #198754;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }}
    button:hover {{ background: #157347; }}
    .decline {{
      margin-top: 8px;
      background: #dc3545;
    }}
    .decline:hover {{ background: #bb2d3b; }}
  </style>
</head>
<body>
  <span class="badge">⚠ Stub Mode — Dev Only</span>
  <h1>Test Payment Form</h1>
  <p>This simulates a hosted payment form. No real card data is collected.</p>
  <div class="amount">${amount}</div>
  <p style="font-size:0.75rem;color:#888">Transaction: {transaction_id}<br>Token: {token}</p>
  <button onclick="approvePayment()">✓ Approve Payment</button>
  <button class="decline" onclick="declinePayment()">✗ Simulate Decline</button>
  <script>
    function postResult(payload) {{
      const msg = {{ source: 'fundrbolt-hpf', ...payload }};
      if (window.parent && window.parent !== window) {{
        window.parent.postMessage(msg, '*');
      }} else {{
        window.opener && window.opener.postMessage(msg, '*');
      }}
    }}
    function approvePayment() {{
      postResult({{
        type: 'hpf_complete',
        status: 'approved',
        token: '{token}',
        transactionId: '{transaction_id}',
        gatewayProfileId: 'stub_profile_' + Math.random().toString(36).slice(2),
        cardLast4: '4242',
        cardBrand: 'Visa',
        cardExpiryMonth: 12,
        cardExpiryYear: 2027,
      }});
    }}
    function declinePayment() {{
      postResult({{
        type: 'hpf_complete',
        status: 'declined',
        token: '{token}',
        transactionId: '{transaction_id}',
        declineReason: 'Insufficient funds (stub)',
      }});
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── Payment Profiles ──────────────────────────────────────────────────────────


@router.get("/profiles", response_model=list[PaymentProfileRead])
async def list_payment_profiles(
    npo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> list[PaymentProfileRead]:
    """List the authenticated donor's saved cards for a given NPO."""
    svc = PaymentProfileService(db)
    profiles = await svc.list_profiles(user_id=current_user.id, npo_id=npo_id)
    return [profile_to_read(p) for p in profiles]


@router.post("/profiles", response_model=PaymentProfileRead, status_code=status.HTTP_201_CREATED)
async def create_payment_profile(
    body: PaymentProfileCreate,
    current_user: CurrentUser,
    db: DB,
) -> PaymentProfileRead:
    """Save a tokenised card vault reference after the HPF has completed.

    The frontend calls this with the `gatewayProfileId` received via
    postMessage from the HPF iframe (see HpfIframe component).
    """
    svc = PaymentProfileService(db)
    profile = await svc.create_profile(
        user_id=current_user.id,
        npo_id=body.npo_id,
        data=body,
    )
    await db.commit()
    await db.refresh(profile)
    return profile_to_read(profile)


@router.delete(
    "/profiles/{profile_id}",
    response_model=dict[str, str | None],
    status_code=status.HTTP_200_OK,
)
async def delete_payment_profile(
    profile_id: uuid.UUID,
    npo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> dict[str, str | None]:
    """Soft-delete a saved card. Returns ``{"warning": str | null}``.

    The vault token is deleted from the gateway first. If the donor has an
    outstanding balance with this NPO a warning is included in the response
    (the delete still succeeds — it is the caller's responsibility to prompt
    the donor).
    """
    svc = PaymentProfileService(db)
    result = await svc.soft_delete(
        profile_id=profile_id,
        user_id=current_user.id,
        npo_id=npo_id,
        gateway=gateway,
    )
    await db.commit()
    return result


@router.patch(
    "/profiles/{profile_id}/default",
    response_model=PaymentProfileRead,
)
async def set_default_payment_profile(
    profile_id: uuid.UUID,
    npo_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> PaymentProfileRead:
    """Promote a saved card to be the default card for paying this NPO."""
    svc = PaymentProfileService(db)
    profile = await svc.set_default(
        profile_id=profile_id,
        user_id=current_user.id,
        npo_id=npo_id,
    )
    await db.commit()
    await db.refresh(profile)
    return profile_to_read(profile)


# ── Webhook (unauthenticated — HMAC verified) ────────────────────────────────


@router.post("/webhook", status_code=status.HTTP_200_OK, response_model=dict[str, str])
async def payment_webhook(
    request: Request,
    db: DB,
    gateway: Gateway,
) -> dict[str, str]:
    """Receive and process a signed IPN/webhook from the payment gateway.

    Protected by HMAC-SHA256 signature in ``X-Deluxe-Signature``.
    Handles transaction status updates, profile vault upserts, ticket purchase
    completion, and receipt generation enqueueing.

    Returns ``{}`` immediately after scheduling background work so the gateway
    does not time out waiting for a slow PDF render.
    """
    raw_body = await request.body()
    signature_header = request.headers.get("X-Deluxe-Signature", "")
    timestamp_header = request.headers.get("X-Deluxe-Timestamp", "")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be valid JSON.",
        ) from None

    svc = PaymentTransactionService(db)
    await svc.handle_webhook(
        raw_body=raw_body,
        signature_header=signature_header,
        timestamp_header=timestamp_header,
        payload=payload,
        gateway=gateway,
    )
    await db.commit()
    return {}


# ── Transactions ──────────────────────────────────────────────────────────────


class TransactionReadResponse(PaymentSessionResponse):
    """Extended transaction response including status and card info."""

    transaction_status: str
    transaction_type: str
    card_brand: str | None = None
    card_last4: str | None = None
    receipt_url: str | None = None


@router.get("/transactions/{transaction_id}", response_model=dict[str, Any])
async def get_transaction(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, Any]:
    """Retrieve a transaction by ID.

    Donors can only access their own transactions.  Admins and Super Admins
    can access any transaction.

    **Errors**:
    - 403 if a donor tries to access another donor's transaction
    - 404 if not found
    """
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found.",
        )

    role = getattr(current_user, "role_name", None)
    is_admin = role in ("super_admin", "npo_admin", "npo_staff")
    if not is_admin and txn.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own transactions.",
        )

    receipt_url: str | None = None
    if txn.receipt is not None and txn.receipt.pdf_url:
        receipt_url = f"/api/v1/payments/transactions/{transaction_id}/receipt"

    # Get profile card data
    card_brand: str | None = None
    card_last4: str | None = None
    if txn.payment_profile is not None:
        card_brand = txn.payment_profile.card_brand
        card_last4 = txn.payment_profile.card_last4
    elif txn.gateway_response:
        webhook_data = txn.gateway_response.get("webhook", {})
        card_brand = webhook_data.get("card_brand")
        card_last4 = webhook_data.get("card_last4")

    return {
        "id": str(txn.id),
        "status": txn.status.value,
        "transaction_type": txn.transaction_type.value,
        "amount": float(txn.amount),
        "currency": txn.currency,
        "line_items": (txn.line_items or {}).get("items", []),
        "card_brand": card_brand,
        "card_last4": card_last4,
        "created_at": txn.created_at.isoformat() if txn.created_at else None,
        "receipt_url": receipt_url,
    }


@router.get("/transactions/{transaction_id}/receipt")
async def get_transaction_receipt(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> RedirectResponse:
    """Download the PDF receipt for a transaction.

    Redirects to the Azure Blob URL if available, otherwise returns 503
    while the receipt is still being generated.

    **Errors**:
    - 403 if a donor tries to access another donor's receipt
    - 404 if the transaction or receipt row does not exist
    - 503 if the PDF has not been generated yet
    """
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found.",
        )

    role = getattr(current_user, "role_name", None)
    is_admin = role in ("super_admin", "npo_admin", "npo_staff")
    if not is_admin and txn.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own receipts.",
        )

    receipt_result = await db.execute(
        select(PaymentReceipt).where(PaymentReceipt.transaction_id == transaction_id)
    )
    receipt = receipt_result.scalar_one_or_none()

    if receipt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt record found for this transaction.",
        )

    if receipt.pdf_url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Receipt PDF is still being generated. Please try again shortly.",
        )

    # Redirect to blob URL or proxy the PDF
    return RedirectResponse(url=receipt.pdf_url, status_code=302)


# ── Checkout ─────────────────────────────────────────────────────────────────


@router.get("/checkout/balance", response_model=CheckoutBalanceResponse)
async def get_checkout_balance(
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CheckoutBalanceResponse:
    """Return the donor's outstanding balance breakdown for an event.

    Used to populate the end-of-night checkout screen.
    """
    svc = CheckoutService(db)
    return await svc.aggregate_balance(
        user_id=current_user.id,
        event_id=event_id,
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def post_checkout(
    body: CheckoutRequest,
    current_user: CurrentUser,
    db: DB,
    gateway: Gateway,
) -> CheckoutResponse:
    """Execute end-of-night self-checkout for the current donor.

    The balance is always re-derived from the database; the ``line_items``
    and ``total_amount`` in the request body are informational / for UI
    confirmation only and are NOT trusted for billing.

    Returns 409 if checkout is not open for the event.
    Returns 422 if the donor has no outstanding balance.
    """
    svc = CheckoutService(db)
    try:
        return await svc.checkout(
            user_id=current_user.id,
            event_id=body.event_id,
            payment_profile_id=body.payment_profile_id,
            cover_fee=body.cover_processing_fee,
            idempotency_key=body.idempotency_key or str(current_user.id),
            gateway=gateway,
        )
    except CheckoutNotOpenError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ZeroBalanceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

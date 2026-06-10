import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.members import create_invitation, resend_invitation
from app.core.security import create_invitation_token, hash_password
from app.models.npo_member import MemberRole
from app.schemas.member import CreateInvitationRequest
from app.services.email_service import EmailSendError
from app.services.invitation_service import InvitationService


@pytest.mark.asyncio
async def test_create_invitation_surfaces_email_delivery_failures() -> None:
    npo_id = uuid.uuid4()
    current_user = SimpleNamespace(id=uuid.uuid4())
    db = AsyncMock()
    invitation_data = CreateInvitationRequest(email="invitee@example.com", role=MemberRole.STAFF)

    with (
        patch(
            "app.api.v1.members.NPOPermissionService.can_manage_members",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "app.api.v1.members.NPOPermissionService.get_user_npo_role",
            new=AsyncMock(return_value=(MemberRole.ADMIN, None)),
        ),
        patch(
            "app.api.v1.members.InvitationService.create_invitation",
            new=AsyncMock(side_effect=EmailSendError("delivery failed")),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await create_invitation(
                npo_id=npo_id,
                invitation_data=invitation_data,
                current_user=current_user,
                db=db,
                request_id="req-1",
            )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "INVITATION_EMAIL_FAILED"


@pytest.mark.asyncio
async def test_resend_invitation_surfaces_email_delivery_failures() -> None:
    npo_id = uuid.uuid4()
    invitation_id = uuid.uuid4()
    current_user = SimpleNamespace(id=uuid.uuid4())
    db = AsyncMock()

    with (
        patch(
            "app.api.v1.members.NPOPermissionService.can_manage_members",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "app.api.v1.members.InvitationService.resend_invitation",
            new=AsyncMock(side_effect=EmailSendError("delivery failed")),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await resend_invitation(
                npo_id=npo_id,
                invitation_id=invitation_id,
                current_user=current_user,
                db=db,
                request_id="req-2",
            )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "INVITATION_EMAIL_FAILED"


@pytest.mark.asyncio
async def test_accept_invitation_by_token_uses_jwt_and_stored_hash() -> None:
    invitation_id = uuid.uuid4()
    npo_id = uuid.uuid4()
    token = create_invitation_token(
        invitation_id=str(invitation_id),
        npo_id=str(npo_id),
        email="invitee@example.com",
        npo_name="Test NPO",
        role="staff",
    )
    invitation = SimpleNamespace(id=invitation_id, token_hash=hash_password(token))
    user = SimpleNamespace(id=uuid.uuid4(), email="invitee@example.com")

    invitation_result = SimpleNamespace(scalar_one_or_none=lambda: invitation)
    user_result = SimpleNamespace(scalar_one_or_none=lambda: user)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[invitation_result, user_result])

    accepted_member = SimpleNamespace(id=uuid.uuid4())

    with patch.object(
        InvitationService,
        "accept_invitation",
        new=AsyncMock(return_value=accepted_member),
    ) as accept_mock:
        result = await InvitationService.accept_invitation_by_token(db=db, token=token)

    assert result is accepted_member
    accept_mock.assert_awaited_once_with(db=db, invitation_id=invitation_id, user_id=user.id)

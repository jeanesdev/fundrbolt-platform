"""Pydantic schemas package."""

from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    UserCreate,
    UserPublic,
    UserRegisterResponse,
)
from app.schemas.consent import (
    ConsentAcceptRequest,
    ConsentAuditLogResponse,
    ConsentHistoryResponse,
    ConsentResponse,
    ConsentStatusResponse,
    DataDeletionRequest,
    DataExportRequest,
)
from app.schemas.cookies import (
    CookieConsentRequest,
    CookieConsentResponse,
    CookieConsentStatusResponse,
    CookieConsentUpdateRequest,
)
from app.schemas.legal_documents import (
    LegalDocumentCreateRequest,
    LegalDocumentListResponse,
    LegalDocumentPublicResponse,
    LegalDocumentResponse,
    LegalDocumentUpdateRequest,
)
from app.schemas.npo import (
    NPOCreateRequest,
    NPOCreateResponse,
    NPODetailResponse,
    NPOListRequest,
    NPOListResponse,
    NPOResponse,
    NPOStatusUpdateRequest,
    NPOUpdateRequest,
)
from app.schemas.npo_application import (
    ApplicationCreateRequest,
    ApplicationDetailResponse,
    ApplicationListRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationReviewRequest,
    ApplicationReviewResponse,
)
from app.schemas.npo_branding import (
    BrandingCreateRequest,
    BrandingCreateResponse,
    BrandingDetailResponse,
    BrandingResponse,
    BrandingUpdateRequest,
    BrandingUpdateResponse,
    LogoUploadRequest,
    LogoUploadResponse,
)
from app.schemas.npo_member import (
    MemberAddRequest,
    MemberAddResponse,
    MemberDetailResponse,
    MemberInviteRequest,
    MemberInviteResponse,
    MemberListRequest,
    MemberListResponse,
    MemberResponse,
    MemberRoleUpdateRequest,
    MemberStatusUpdateRequest,
)

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "LogoutRequest",
    "MessageResponse",
    "RefreshRequest",
    "RefreshResponse",
    "UserCreate",
    "UserPublic",
    "UserRegisterResponse",
    # Consent
    "ConsentAcceptRequest",
    "ConsentAuditLogResponse",
    "ConsentHistoryResponse",
    "ConsentResponse",
    "ConsentStatusResponse",
    "DataDeletionRequest",
    "DataExportRequest",
    # Cookies
    "CookieConsentRequest",
    "CookieConsentResponse",
    "CookieConsentStatusResponse",
    "CookieConsentUpdateRequest",
    # Legal Documents
    "LegalDocumentCreateRequest",
    "LegalDocumentListResponse",
    "LegalDocumentPublicResponse",
    "LegalDocumentResponse",
    "LegalDocumentUpdateRequest",
    # NPO
    "NPOCreateRequest",
    "NPOCreateResponse",
    "NPODetailResponse",
    "NPOListRequest",
    "NPOListResponse",
    "NPOResponse",
    "NPOStatusUpdateRequest",
    "NPOUpdateRequest",
    # NPO Application
    "ApplicationCreateRequest",
    "ApplicationDetailResponse",
    "ApplicationListRequest",
    "ApplicationListResponse",
    "ApplicationResponse",
    "ApplicationReviewRequest",
    "ApplicationReviewResponse",
    # NPO Branding
    "BrandingCreateRequest",
    "BrandingCreateResponse",
    "BrandingDetailResponse",
    "BrandingResponse",
    "BrandingUpdateRequest",
    "BrandingUpdateResponse",
    "LogoUploadRequest",
    "LogoUploadResponse",
    # NPO Member
    "MemberAddRequest",
    "MemberAddResponse",
    "MemberDetailResponse",
    "MemberInviteRequest",
    "MemberInviteResponse",
    "MemberListRequest",
    "MemberListResponse",
    "MemberResponse",
    "MemberRoleUpdateRequest",
    "MemberStatusUpdateRequest",
]

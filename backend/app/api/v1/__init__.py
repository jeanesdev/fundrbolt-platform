"""API v1 routes package."""

from fastapi import APIRouter

from app.api.v1 import auth, branding, consent, cookies, legal_documents, npos, users

# Create v1 API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(npos.router, tags=["npos"])
api_router.include_router(branding.router, tags=["branding"])
api_router.include_router(legal_documents.router, prefix="/legal", tags=["legal"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(cookies.router, prefix="/cookies", tags=["cookies"])

__all__ = ["api_router"]

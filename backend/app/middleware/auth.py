"""Authentication middleware for FastAPI.

Provides dependency injection for protected endpoints that require authentication.
"""

import uuid
from uuid import UUID
from collections.abc import Callable
from functools import wraps
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.services.redis_service import RedisService


class HTTPBearerAuth(HTTPBearer):
    """Custom HTTPBearer that returns 401 instead of 403 for missing credentials."""

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials | None:
        """Override to return 401 for missing credentials."""
        try:
            return await super().__call__(request)
        except HTTPException as e:
            if e.status_code == 403:
                # Convert 403 (Forbidden) to 401 (Unauthorized) for missing credentials
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            raise


# HTTP Bearer token scheme
security = HTTPBearerAuth()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate JWT from Authorization header.

    Flow:
    1. Extract Bearer token from Authorization header
    2. Decode JWT and validate signature
    3. Check if token is blacklisted in Redis
    4. Verify token hasn't expired
    5. Fetch user from database
    6. Verify user is active

    Args:
        credentials: HTTP Bearer credentials from Authorization header
        db: Database session

    Returns:
        Authenticated User object

    Raises:
        HTTPException 401: Invalid, expired, or blacklisted token
        HTTPException 403: User account deactivated

    Usage:
        @router.get("/protected")
        async def protected_route(
            current_user: Annotated[User, Depends(get_current_user)]
        ):
            return {"user_id": current_user.id}
    """
    token = credentials.credentials

    try:
        # Decode and validate JWT
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        token_jti = payload.get("jti")

        if (
            not user_id_str
            or not token_jti
            or not isinstance(user_id_str, str)
            or not isinstance(token_jti, str)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Token missing required claims",
                    }
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = uuid.UUID(user_id_str)

        # Check if token is blacklisted
        redis_service = RedisService()
        is_blacklisted = await redis_service.is_token_blacklisted(token_jti)
        if is_blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "TOKEN_REVOKED",
                        "message": "Token has been revoked",
                    }
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Fetch user from database
        from sqlalchemy import select

        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "USER_NOT_FOUND",
                        "message": "User not found",
                    }
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if user account is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "ACCOUNT_DEACTIVATED",
                        "message": "Account has been deactivated",
                    }
                },
            )

        # Fetch role name from roles table and attach to user object
        from sqlalchemy import text

        role_stmt = text("SELECT name FROM roles WHERE id = :role_id")
        role_result = await db.execute(role_stmt, {"role_id": user.role_id})
        role_name_str = role_result.scalar_one_or_none()

        # Attach role name to user object for permission checks
        # Note: user.role is the SQLAlchemy relationship, so we use a custom attribute
        user.role_name = role_name_str if role_name_str else "unknown"  # type: ignore[attr-defined]

        return user

    except (jwt.DecodeError, jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        # Token decode errors (invalid signature, expired, etc.)
        error_msg = str(e)
        if "expired" in error_msg.lower() or isinstance(e, jwt.ExpiredSignatureError):
            code = "TOKEN_EXPIRED"
            message = "Token has expired"
        else:
            code = "INVALID_TOKEN"
            message = "Invalid authentication token"

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": code, "message": message}},
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except ValueError as e:
        # Other validation errors (invalid UUID, etc.)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": str(e)}},
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_current_user_optional(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Extract and validate JWT if present, return None if not authenticated.

    This is used for endpoints that work for both authenticated and anonymous users.

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        Authenticated User object or None if no valid token

    Usage:
        @router.get("/public-or-private")
        async def flexible_route(
            current_user: Annotated[User | None, Depends(get_current_user_optional)]
        ):
            if current_user:
                return {"user_id": current_user.id}
            return {"message": "Anonymous user"}
    """
    # Try to extract Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")

    try:
        # Decode and validate JWT
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        token_jti = payload.get("jti")

        if not user_id_str or not token_jti:
            return None

        user_id = uuid.UUID(user_id_str)

        # Check if token is blacklisted
        redis_service = RedisService()
        is_blacklisted = await redis_service.is_token_blacklisted(token_jti)
        if is_blacklisted:
            return None

        # Fetch user from database
        from sqlalchemy import select

        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        # Fetch role name and attach to user object
        from sqlalchemy import text

        role_stmt = text("SELECT name FROM roles WHERE id = :role_id")
        role_result = await db.execute(role_stmt, {"role_id": user.role_id})
        role_name_str = role_result.scalar_one_or_none()

        user.role_name = role_name_str if role_name_str else "unknown"  # type: ignore[attr-defined]

        return user

    except Exception:
        # Any error in token validation - return None (anonymous)
        return None


async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Get current user and verify email is verified.

    This is a stricter version of get_current_user that also checks email verification.

    Args:
        current_user: User from get_current_user dependency

    Returns:
        Authenticated User with verified email

    Raises:
        HTTPException 403: Email not verified

    Usage:
        @router.get("/protected")
        async def protected_route(
            current_user: Annotated[User, Depends(get_current_active_user)]
        ):
            # User is authenticated AND email verified
            return {"user_id": current_user.id}
    """
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "EMAIL_NOT_VERIFIED",
                    "message": "Email verification required",
                }
            },
        )

    return current_user


def require_role(*allowed_roles: str) -> Callable[..., Any]:
    """Decorator to require specific roles for an endpoint.

    Args:
        *allowed_roles: Role names that are allowed to access the endpoint

    Returns:
        Decorator function

    Usage:
        @router.get("/admin-only")
        @require_role("super_admin", "npo_admin")
        async def admin_endpoint(
            current_user: Annotated[User, Depends(get_current_user)]
        ):
            return {"message": "Admin access granted"}

    Raises:
        HTTPException 403: User role not in allowed roles
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract current_user from kwargs (injected by FastAPI)
            current_user = kwargs.get("current_user")

            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Current user not found in request context",
                        }
                    },
                )

            # Check if user has an allowed role
            user_role = getattr(current_user, "role_name", None)  # Use role_name, not role
            if user_role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": {
                            "code": "INSUFFICIENT_PERMISSIONS",
                            "message": (
                                f"Role '{user_role}' not authorized. "
                                f"Required: {', '.join(allowed_roles)}"
                            ),
                        }
                    },
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_permission(resource: str, action: str) -> Callable[..., Any]:
    """Decorator to require specific permission for an endpoint.

    This is a more fine-grained alternative to require_role that checks
    specific resource:action permissions based on the user's role.

    Args:
        resource: Resource name (e.g., 'users', 'events', 'auctions')
        action: Action name (e.g., 'create', 'read', 'update', 'delete')

    Returns:
        Decorator function

    Usage:
        @router.post("/users")
        @require_permission("users", "create")
        async def create_user(
            current_user: Annotated[User, Depends(get_current_user)]
        ):
            return {"message": "User creation granted"}

    Raises:
        HTTPException 403: User lacks required permission

    Note:
        This decorator uses PermissionService to check if the user's role
        has permission for the specified resource:action combination.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract current_user from kwargs
            current_user = kwargs.get("current_user")

            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Current user not found in request context",
                        }
                    },
                )

            # Import here to avoid circular dependency
            from app.services.permission_service import PermissionService

            permission_service = PermissionService()
            user_role = getattr(current_user, "role", None)

            # Map resource:action to permission check methods
            # For now, we'll use a simple role-based check
            # TODO: Implement granular permission checking when Permission table is added
            if user_role == "super_admin":
                # Super admin has all permissions
                pass
            elif resource == "users":
                if action == "create" and not await permission_service.can_create_user(
                    current_user, None
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error": {
                                "code": "INSUFFICIENT_PERMISSIONS",
                                "message": f"Permission denied: {resource}:{action}",
                            }
                        },
                    )
                elif action in ("read", "list") and not await permission_service.can_view_user(
                    current_user, None
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error": {
                                "code": "INSUFFICIENT_PERMISSIONS",
                                "message": f"Permission denied: {resource}:{action}",
                            }
                        },
                    )
            else:
                # For other resources, allow super_admin and npo_admin by default
                if user_role not in ("super_admin", "npo_admin"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error": {
                                "code": "INSUFFICIENT_PERMISSIONS",
                                "message": f"Permission denied: {resource}:{action}",
                            }
                        },
                    )

            return await func(*args, **kwargs)

        return wrapper

    return decorator

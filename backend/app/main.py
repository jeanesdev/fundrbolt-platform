"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.metrics import router as metrics_router
from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.database import async_engine
from app.core.errors import (
    AuthenticationError,
    AuthorizationError,
    DuplicateResourceError,
    RateLimitError,
    ResourceNotFoundError,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import get_logger, setup_logging
from app.core.metrics import set_up
from app.core.redis import get_redis
from app.middleware.consent_check import ConsentCheckMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.slug_validator import SlugValidationMiddleware

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan events.

    Startup:
    - Initialize Redis connection
    - Log application start

    Shutdown:
    - Close database connections
    - Close Redis connection
    """
    # Startup
    logger.info(
        "Starting Augeo Platform API",
        extra={
            "environment": settings.environment,
            "debug": settings.debug,
            "cors_origins": settings.get_cors_origins_list(),
        },
    )

    # Initialize Redis
    redis_client = await get_redis()
    logger.info("Redis connection established")

    # Mark service as up for metrics
    set_up(1)

    yield

    # Shutdown
    logger.info("Shutting down Augeo Platform API")

    # Close database engine
    await async_engine.dispose()
    logger.info("Database connections closed")

    # Close Redis connection
    await redis_client.aclose()  # type: ignore[attr-defined]
    logger.info("Redis connection closed")

    # Mark service as down
    set_up(0)


# Create FastAPI app
app = FastAPI(
    title=settings.project_name,
    description="Augeo Platform API for nonprofit auction management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "Augeo Platform Support",
        "email": "support@augeo.app",
    },
    license_info={
        "name": "Proprietary",
    },
    openapi_tags=[
        {"name": "auth", "description": "Authentication and authorization operations"},
        {"name": "users", "description": "User management operations"},
        {"name": "npos", "description": "Nonprofit organization management"},
        {"name": "branding", "description": "NPO branding and visual identity customization"},
        {"name": "events", "description": "Event management and coordination"},
        {"name": "search", "description": "Cross-resource search with role-based filtering"},
        {"name": "legal", "description": "Legal documents (Terms of Service, Privacy Policy)"},
        {"name": "consent", "description": "User consent management and GDPR compliance"},
        {"name": "cookies", "description": "Cookie consent management (EU Cookie Law)"},
        {"name": "public-contact", "description": "Public contact form submission"},
        {"name": "admin-seating", "description": "Admin seating management and configuration"},
        {"name": "health", "description": "Health check and monitoring"},
        {"name": "metrics", "description": "Prometheus metrics for monitoring"},
        {"name": "root", "description": "Root API information"},
    ],
)

# CORS middleware (MUST be first to add headers to all responses)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID middleware
app.add_middleware(RequestIDMiddleware)

# Metrics middleware
app.add_middleware(MetricsMiddleware)

# Slug validation middleware
app.add_middleware(SlugValidationMiddleware)

# Consent check middleware
app.add_middleware(ConsentCheckMiddleware)

# Exception handlers
app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(AuthenticationError, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(AuthorizationError, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(ResourceNotFoundError, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(DuplicateResourceError, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RateLimitError, http_exception_handler)  # type: ignore[arg-type]

# Include API routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(health_router)
app.include_router(metrics_router)

# Mount static files (for local logo uploads in development)
static_dir = Path("static")
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# Root endpoint
@app.get("/", tags=["root"])
async def root() -> JSONResponse:
    """
    Root endpoint.

    Returns:
        JSONResponse with API information
    """
    return JSONResponse(
        content={
            "message": "Augeo Platform API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
        }
    )

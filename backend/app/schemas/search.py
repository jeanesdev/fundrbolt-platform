"""Pydantic schemas for search endpoints.

Cross-resource search with role-based filtering.
Supports searching Users, NPOs, and Events.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ================================
# Request Schemas
# ================================


class SearchRequest(BaseModel):
    """Request schema for cross-resource search.
    
    Searches across Users, NPOs, and Events using PostgreSQL tsvector.
    Results are filtered based on user role and NPO context.
    """

    query: str = Field(min_length=2, max_length=255, description="Search query (min 2 characters)")
    resource_types: list[Literal["users", "npos", "events"]] | None = Field(
        None,
        description="Limit search to specific resource types (default: all)",
    )
    npo_id: uuid.UUID | None = Field(
        None,
        description="Filter results to specific NPO (SuperAdmin only)",
    )
    limit: int = Field(
        10,
        ge=1,
        le=100,
        description="Maximum results per resource type (default: 10, max: 100)",
    )


# ================================
# Response Schemas
# ================================


class UserSearchResult(BaseModel):
    """Search result for a user."""

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    npo_id: uuid.UUID | null = None
    organization_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NPOSearchResult(BaseModel):
    """Search result for an NPO."""

    id: uuid.UUID
    name: str
    ein: str | None = None
    status: str
    tagline: str | None = None
    logo_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventSearchResult(BaseModel):
    """Search result for an event."""

    id: uuid.UUID
    name: str
    npo_id: uuid.UUID
    npo_name: str  # Denormalized for display
    event_type: str
    status: str
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    """Response schema for search results.
    
    Groups results by resource type for easy display.
    """

    query: str = Field(description="Original search query")
    users: list[UserSearchResult] = Field(default_factory=list, description="Matching users")
    npos: list[NPOSearchResult] = Field(default_factory=list, description="Matching NPOs")
    events: list[EventSearchResult] = Field(default_factory=list, description="Matching events")
    total_results: int = Field(description="Total number of results across all types")
    
    @property
    def has_results(self) -> bool:
        """Check if search returned any results."""
        return len(self.users) > 0 or len(self.npos) > 0 or len(self.events) > 0

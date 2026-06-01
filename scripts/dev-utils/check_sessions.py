#!/usr/bin/env python3
"""Check recent sessions and device tracking."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.database import async_engine  # noqa: E402
from app.models.session import Session  # noqa: E402


async def check_sessions():
    """Display recent sessions with device info."""
    async with async_engine.begin() as conn:
        session = AsyncSession(bind=conn)

        result = await session.execute(
            select(Session).order_by(Session.created_at.desc()).limit(5)
        )
        sessions = result.scalars().all()

        if not sessions:
            print("❌ No sessions found")
            return

        print(f"\n📱 Last {len(sessions)} Sessions:\n")
        print("=" * 80)

        for i, s in enumerate(sessions, 1):
            print(f"\nSession {i}:")
            print(f"  User ID: {s.user_id}")
            print(f"  Created: {s.created_at}")
            print(f"  Expires: {s.expires_at}")
            print(f"  Revoked: {s.revoked_at or 'Active'}")
            print(f"  Device: {s.device_info[:80] if s.device_info else 'N/A'}")
            print(f"  User-Agent: {s.user_agent[:80] if s.user_agent else 'N/A'}")
            print(f"  IP: {s.ip_address or 'N/A'}")
            print("-" * 80)

        await session.close()
    await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_sessions())

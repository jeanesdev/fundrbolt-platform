from __future__ import annotations

import argparse
import asyncio
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT.parent.parent / "backend"
for path in (str(BACKEND_DIR), str(ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

from fixtures import (  # noqa: E402
    auction_items,
    events,
    legal,
    organizations,
    seating,
    sponsors,
    tickets,
    users,
)

from app.core.database import AsyncSessionLocal  # noqa: E402


async def run_seed(environment: str, tenant_slug: str) -> int:
    state: dict[str, object] = {"environment": environment, "tenant_slug": tenant_slug}
    modules = OrderedDict(
        [
            ("legal_documents", legal),
            ("users", users),
            ("organizations", organizations),
            ("events", events),
            ("tickets", tickets),
            ("auction_items", auction_items),
            ("seating", seating),
            ("sponsors", sponsors),
        ]
    )
    summary: dict[str, dict[str, int]] = {}

    async with AsyncSessionLocal() as session:
        for name, module in modules.items():
            summary[name] = await module.seed(session, state)

    for entity, counts in summary.items():
        print(f"{entity}: {counts['created']} created, {counts['unchanged']} unchanged")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed beta-readiness integration fixtures"
    )
    parser.add_argument("--tenant-slug", default="seed-nonprofit")
    parser.add_argument("--environment", default="development")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return asyncio.run(run_seed(args.environment, args.tenant_slug))
    except Exception as exc:  # pragma: no cover - CLI guard
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

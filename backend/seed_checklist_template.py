"""Seed script: Create system default checklist template with 26 items."""

import asyncio
import uuid

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.checklist import ChecklistTemplate, ChecklistTemplateItem

# 26-item default template from spec (offset_days: negative=before event, positive=after)
DEFAULT_TEMPLATE_ITEMS = [
    (-84, "Set fundraising goal and budget"),
    (-84, "Form planning committee"),
    (-70, "Select and book venue"),
    (-70, "Choose event theme/branding"),
    (-63, "Begin sponsor outreach"),
    (-63, "Create event timeline/run-of-show"),
    (-56, "Design and order invitations"),
    (-56, "Arrange catering and menu planning"),
    (-49, "Secure entertainment/speakers"),
    (-42, "Launch event website/registration page"),
    (-42, "Begin social media promotion"),
    (-35, "Collect and catalog auction items"),
    (-28, "Send invitations"),
    (-28, "Arrange audio/visual equipment"),
    (-28, "Recruit and assign volunteers"),
    (-21, "Finalize seating chart"),
    (-14, "Confirm all vendor contracts"),
    (-7, "Print event programs and bid sheets"),
    (-3, "Final walkthrough of venue"),
    (-3, "Prepare registration/check-in materials"),
    (-1, "Confirm final headcount with caterer"),
    (0, "Set up venue and decorations"),
    (0, "Event day — execute run-of-show"),
    (3, "Send thank-you notes to donors/sponsors"),
    (7, "Process payments and reconcile finances"),
    (14, "Conduct post-event debrief and report"),
]


async def seed_default_template() -> None:
    """Create or update the system default checklist template."""
    async with AsyncSessionLocal() as db:
        # Check if system default already exists
        result = await db.execute(
            select(ChecklistTemplate).where(ChecklistTemplate.is_system_default.is_(True))
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"System default template already exists: {existing.id}")
            return

        template = ChecklistTemplate(
            id=uuid.uuid4(),
            npo_id=None,
            name="Fundraising Gala Default",
            is_default=False,
            is_system_default=True,
            created_by=None,
        )
        db.add(template)
        await db.flush()

        for order, (offset, title) in enumerate(DEFAULT_TEMPLATE_ITEMS):
            item = ChecklistTemplateItem(
                id=uuid.uuid4(),
                template_id=template.id,
                title=title,
                offset_days=offset,
                display_order=order,
            )
            db.add(item)

        await db.commit()
        print(
            f"Created system default template '{template.name}' "
            f"with {len(DEFAULT_TEMPLATE_ITEMS)} items (ID: {template.id})"
        )


if __name__ == "__main__":
    asyncio.run(seed_default_template())

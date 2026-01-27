"""Generate a demo ZIP package for auction item bulk import."""

from __future__ import annotations

import argparse
import random
import zipfile
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont

CATEGORIES = [
    "Experiences",
    "Dining",
    "Travel",
    "Wellness",
    "Sports",
    "Family",
    "Art",
    "Retail",
    "Services",
    "Other",
]


def build_workbook(rows: list[dict[str, object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    if sheet is None:
        raise RuntimeError("Failed to initialize workbook sheet")
    sheet.title = "Auction Items"

    headers = [
        "external_id",
        "title",
        "description",
        "fair_market_value",
        "starting_bid",
        "category",
        "image_filename",
        "buy_it_now",
        "quantity",
        "donor_name",
        "tags",
        "restrictions",
        "fulfillment_notes",
        "is_featured",
        "sort_order",
    ]
    sheet.append(headers)

    for row in rows:
        sheet.append([row.get(header) for header in headers])

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def generate_image(text: str, size: tuple[int, int] = (800, 600)) -> bytes:
    image = Image.new(
        "RGB",
        size,
        color=(random.randint(50, 200), random.randint(50, 200), random.randint(50, 200)),
    )
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    draw.text((20, 20), text, fill=(255, 255, 255), font=font)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def build_rows(count: int) -> list[dict[str, object]]:
    rows = []
    for index in range(1, count + 1):
        category = random.choice(CATEGORIES)
        external_id = f"demo-{index:03d}"
        rows.append(
            {
                "external_id": external_id,
                "title": f"{category} Package {index}",
                "description": f"A curated {category.lower()} item for fundraising demo #{index}.",
                "fair_market_value": 250 + index * 5,
                "starting_bid": 100 + index * 2,
                "category": category,
                "image_filename": f"{external_id}.png",
                "buy_it_now": 400 + index * 5,
                "quantity": 1,
                "donor_name": "Demo Donor",
                "tags": "demo,import",
                "restrictions": "No cash value",
                "fulfillment_notes": "Coordinate with event staff",
                "is_featured": False,
                "sort_order": index,
            }
        )
    return rows


def create_zip(output_path: Path, rows: list[dict[str, object]]) -> None:
    workbook_bytes = build_workbook(rows)

    with zipfile.ZipFile(output_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("auction_items.xlsx", workbook_bytes)
        for row in rows:
            image_name = str(row["image_filename"])
            image_bytes = generate_image(str(row["title"]))
            zip_file.writestr(f"images/{image_name}", image_bytes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate demo auction item import package")
    parser.add_argument("--count", type=int, default=20, help="Number of items to generate")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./auction-item-import-demo.zip"),
        help="Output ZIP path",
    )
    args = parser.parse_args()

    rows = build_rows(args.count)
    create_zip(args.output, rows)
    print(f"Created {args.output} with {args.count} items")


if __name__ == "__main__":
    main()

"""Generate a demo ZIP package for auction item bulk import."""

from __future__ import annotations

import argparse
import json
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

HEADERS = [
    "external_id",
    "title",
    "description",
    "auction_type",
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


def build_workbook(rows: list[dict[str, object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    if sheet is None:
        raise RuntimeError("Failed to initialize workbook sheet")
    sheet.title = "Auction Items"

    sheet.append(HEADERS)

    for row in rows:
        sheet.append([row.get(header) for header in HEADERS])

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
                "auction_type": "silent",
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


def load_rows_from_json(path: Path) -> list[dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Expected JSON array of auction items")

    rows: list[dict[str, object]] = []
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError("Each JSON item must be an object")

        image_filename = item.get("image_filename")
        if not image_filename:
            image_filenames = item.get("image_filenames")
            if isinstance(image_filenames, list) and image_filenames:
                image_filename = image_filenames[0]

        normalized: dict[str, object] = {
            header: item.get(header) for header in HEADERS
        }
        normalized["image_filename"] = image_filename

        if normalized.get("quantity") in (None, ""):
            normalized["quantity"] = 1
        if normalized.get("sort_order") in (None, ""):
            normalized["sort_order"] = index

        rows.append(normalized)

    return rows


def create_zip(output_path: Path, rows: list[dict[str, object]]) -> None:
    workbook_bytes = build_workbook(rows)

    with zipfile.ZipFile(output_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("auction_items.xlsx", workbook_bytes)
        for row in rows:
            image_name = str(row["image_filename"])
            image_bytes = generate_image(str(row["title"]))
            zip_file.writestr(f"images/{image_name}", image_bytes)


def _find_image_candidate(images_dir: Path, image_name: str) -> Path | None:
    if not images_dir.exists():
        return None

    exact_path = images_dir / image_name
    if exact_path.exists():
        return exact_path

    stem = Path(image_name).stem.lower()
    candidates = [
        path
        for path in images_dir.iterdir()
        if path.is_file()
        and path.suffix.lower() in {".png", ".jpg", ".jpeg"}
        and stem in path.name.lower()
    ]
    if not candidates:
        return None

    return sorted(candidates, key=lambda path: len(path.name))[0]


def create_zip_from_json(
    output_path: Path, rows: list[dict[str, object]], images_dir: Path | None
) -> None:
    workbook_bytes = build_workbook(rows)
    images_root = images_dir or Path.cwd()

    with zipfile.ZipFile(output_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("auction_items.xlsx", workbook_bytes)
        for row in rows:
            image_name = row.get("image_filename")
            if not image_name:
                continue
            image_name = str(image_name)
            image_path = _find_image_candidate(images_root, image_name)
            if image_path and image_path.exists():
                zip_file.write(image_path, arcname=f"images/{image_name}")
            else:
                image_bytes = generate_image(str(row.get("title", image_name)))
                zip_file.writestr(f"images/{image_name}", image_bytes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate demo auction item import package")
    parser.add_argument("--count", type=int, default=20, help="Number of items to generate")
    parser.add_argument("--json", type=Path, help="Path to JSON file of auction items")
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=Path("./auction_items.xlsx"),
        help="Output workbook path when using --json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./auction-item-import-demo.zip"),
        help="Output ZIP path",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        help="Directory containing item images when using --json",
    )
    args = parser.parse_args()

    if args.json:
        rows = load_rows_from_json(args.json)
        if args.output:
            create_zip_from_json(args.output, rows, args.images_dir)
            print(f"Created {args.output} with {len(rows)} items")
            return
        workbook_bytes = build_workbook(rows)
        args.xlsx.write_bytes(workbook_bytes)
        print(f"Created {args.xlsx} with {len(rows)} items")
        return

    rows = build_rows(args.count)
    create_zip(args.output, rows)
    print(f"Created {args.output} with {args.count} items")


if __name__ == "__main__":
    main()

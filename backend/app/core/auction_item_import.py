"""Configuration constants for auction item bulk import."""

from __future__ import annotations

from pathlib import Path

WORKBOOK_FILENAME = "auction_items.xlsx"
MAX_IMPORT_ROWS = 500

ALLOWED_CATEGORIES = [
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

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}

ZIP_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024  # 50 MB
ZIP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB
ZIP_MAX_ENTRIES = 2000
ZIP_MAX_ENTRY_BYTES = 20 * 1024 * 1024  # 20 MB


def is_allowed_image_filename(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_IMAGE_EXTENSIONS

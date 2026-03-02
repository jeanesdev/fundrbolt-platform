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

ZIP_MAX_COMPRESSED_BYTES = 150 * 1024 * 1024  # 150 MB
ZIP_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB
ZIP_MAX_ENTRIES = 2000
ZIP_MAX_ENTRY_BYTES = 50 * 1024 * 1024  # 50 MB


def is_allowed_image_filename(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_IMAGE_EXTENSIONS

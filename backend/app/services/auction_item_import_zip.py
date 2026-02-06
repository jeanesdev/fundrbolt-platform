"""ZIP validation utilities for auction item bulk import."""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.auction_item_import import (
    ALLOWED_IMAGE_EXTENSIONS,
    WORKBOOK_FILENAME,
    ZIP_MAX_COMPRESSED_BYTES,
    ZIP_MAX_ENTRIES,
    ZIP_MAX_ENTRY_BYTES,
    ZIP_MAX_UNCOMPRESSED_BYTES,
)


@dataclass
class ImportZipContents:
    workbook_bytes: bytes
    workbook_filename: str
    image_files: dict[str, bytes]


class ImportZipValidationError(ValueError):
    """Raised when ZIP validation fails."""


def validate_zip_bytes(zip_bytes: bytes) -> ImportZipContents:
    if len(zip_bytes) > ZIP_MAX_COMPRESSED_BYTES:
        raise ImportZipValidationError("ZIP file exceeds maximum compressed size")

    try:
        zip_file = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise ImportZipValidationError("Invalid ZIP archive") from exc

    entries = zip_file.infolist()
    if len(entries) > ZIP_MAX_ENTRIES:
        raise ImportZipValidationError("ZIP file contains too many entries")

    total_uncompressed = 0
    workbook_entries: list[tuple[PurePosixPath, bytes]] = []
    image_files: dict[str, bytes] = {}

    for entry in entries:
        _validate_zip_entry(entry)
        total_uncompressed += entry.file_size
        if total_uncompressed > ZIP_MAX_UNCOMPRESSED_BYTES:
            raise ImportZipValidationError("ZIP file exceeds maximum uncompressed size")

        if entry.file_size > ZIP_MAX_ENTRY_BYTES:
            raise ImportZipValidationError("ZIP entry exceeds maximum size")

        entry_path = PurePosixPath(entry.filename)
        if entry.is_dir():
            continue

        with zip_file.open(entry) as entry_stream:
            entry_bytes = entry_stream.read()

        if entry_path.suffix.lower() in {".xlsx", ".csv"}:
            workbook_entries.append((entry_path, entry_bytes))
            continue

        if entry_path.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
            _validate_image_signature(entry_path.name, entry_bytes)
            if entry_path.name in image_files:
                raise ImportZipValidationError(f"Duplicate image filename found: {entry_path.name}")
            image_files[entry_path.name] = entry_bytes
            continue

        raise ImportZipValidationError(
            f"Unsupported file type in ZIP: {entry_path.name}. Only .xlsx, .csv, .jpg, .jpeg, .png are allowed."
        )

    if not workbook_entries:
        raise ImportZipValidationError("Missing workbook (.xlsx or .csv) in ZIP")

    if len(workbook_entries) > 1:
        workbook_names = ", ".join(path.name for path, _ in workbook_entries)
        raise ImportZipValidationError(
            f"ZIP must contain exactly one workbook (.xlsx or .csv). Found: {workbook_names}"
        )

    workbook_path, workbook_bytes = workbook_entries[0]
    if workbook_path.suffix.lower() == ".xlsx":
        _validate_workbook_signature(workbook_bytes)
    elif not workbook_bytes:
        raise ImportZipValidationError("Workbook file is empty")

    if not image_files:
        raise ImportZipValidationError("ZIP file contains no image files")

    return ImportZipContents(
        workbook_bytes=workbook_bytes,
        workbook_filename=workbook_path.name,
        image_files=image_files,
    )


def _validate_zip_entry(entry: zipfile.ZipInfo) -> None:
    entry_path = PurePosixPath(entry.filename)
    if entry_path.is_absolute() or ".." in entry_path.parts:
        raise ImportZipValidationError("ZIP entry contains invalid path")


def _validate_workbook_signature(entry_bytes: bytes) -> None:
    if not entry_bytes.startswith(b"PK"):
        raise ImportZipValidationError("Workbook file is not a valid .xlsx archive")


def _validate_image_signature(filename: str, entry_bytes: bytes) -> None:
    if entry_bytes.startswith(b"\xff\xd8\xff"):
        return
    if entry_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return
    raise ImportZipValidationError(f"Invalid image signature for {filename}")

#!/usr/bin/env python3
"""Dev-only CLI for generating demo images via Azure OpenAI."""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import sys
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from openai import AzureOpenAI, RateLimitError

REQUIRED_ENV_VARS = (
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_API_VERSION",
)

ALLOWED_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


class ConfigError(RuntimeError):
    """Raised when required configuration is missing or invalid."""


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def load_env() -> dict[str, str]:
    missing = [name for name in REQUIRED_ENV_VARS if not os.getenv(name)]
    if missing:
        raise ConfigError(f"Missing required environment variables: {', '.join(missing)}")
    return {name: os.environ[name] for name in REQUIRED_ENV_VARS}


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate demo images for auction items using Azure OpenAI."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to JSON file containing auction items.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output folder where images will be saved.",
    )
    parser.add_argument(
        "--prompt-prefix",
        default="",
        help="Optional prefix applied to every prompt.",
    )
    parser.add_argument(
        "--prompt-suffix",
        default="",
        help="Optional suffix applied to every prompt.",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=0,
        help="Optional limit on number of images to generate (0 = no limit).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and report planned outputs without generating images.",
    )
    return parser.parse_args(argv)


def load_items(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a list of auction items.")
    return data


def normalize_item(item: dict[str, Any]) -> tuple[str, list[str], list[str]]:
    title = item.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Item is missing required field: title")

    prompts = item.get("image_prompts")
    filenames = item.get("image_filenames")

    if prompts is None and filenames is None:
        prompt = item.get("image_prompt")
        filename = item.get("image_filename")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"Item '{title}' is missing image_prompt")
        if not isinstance(filename, str) or not filename.strip():
            raise ValueError(f"Item '{title}' is missing image_filename")
        return title, [prompt], [filename]

    if not isinstance(prompts, list) or not isinstance(filenames, list):
        raise ValueError(
            f"Item '{title}' must provide both image_prompts and image_filenames lists"
        )
    if len(prompts) != len(filenames):
        raise ValueError(f"Item '{title}' has mismatched image_prompts and image_filenames lengths")
    if not prompts:
        raise ValueError(f"Item '{title}' has no prompts")

    clean_prompts: list[str] = []
    clean_filenames: list[str] = []
    for prompt, filename in zip(prompts, filenames, strict=False):
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"Item '{title}' has an empty prompt")
        if not isinstance(filename, str) or not filename.strip():
            raise ValueError(f"Item '{title}' has an empty image filename")
        clean_prompts.append(prompt)
        clean_filenames.append(filename)

    return title, clean_prompts, clean_filenames


def apply_prompt_affixes(prompt: str, prefix: str, suffix: str) -> str:
    parts = [part.strip() for part in (prefix, prompt, suffix) if part.strip()]
    return " ".join(parts)


def sanitize_filename(value: str, max_length: int = 120) -> str:
    value = value.replace(" ", "-")
    value = ALLOWED_FILENAME_CHARS.sub("", value)
    value = re.sub(r"-+", "-", value)
    value = value.strip("-._")
    if len(value) > max_length:
        value = value[:max_length]
    if not value:
        raise ValueError("Filename became empty after sanitization")
    return value


def build_output_name(
    title: str,
    image_filename: str,
    index: int,
    total: int,
) -> str:
    image_path = Path(image_filename)
    base = f"{title}-{image_path.stem}"
    base = sanitize_filename(base)
    suffix = image_path.suffix or ".png"
    if total > 1:
        base = f"{base}-{index + 1}"
    return f"{base}{suffix}"


def ensure_unique(filename: str, used: set[str]) -> str:
    if filename not in used:
        used.add(filename)
        return filename

    path = Path(filename)
    stem = path.stem
    suffix = path.suffix
    counter = 2
    while True:
        candidate = f"{stem}-{counter}{suffix}"
        if candidate not in used:
            used.add(candidate)
            return candidate
        counter += 1


def generate_image(
    client: AzureOpenAI,
    deployment: str,
    prompt: str,
    *,
    max_retries: int = 3,
    base_delay: float = 2.0,
) -> bytes:
    attempt = 0
    while True:
        try:
            response = client.images.generate(
                model=deployment,
                prompt=prompt,
                size="1024x1024",
                response_format="b64_json",
            )
            data = response.data
            if not data or not getattr(data[0], "b64_json", None):
                raise RuntimeError("Image generation response missing data")
            b64_payload = data[0].b64_json
            if b64_payload is None:
                raise RuntimeError("Image generation response missing base64 payload")
            return base64.b64decode(b64_payload)
        except RateLimitError as exc:
            attempt += 1
            if attempt > max_retries:
                raise RuntimeError("Rate limit exceeded after retries") from exc
            delay = base_delay * (2 ** (attempt - 1))
            logging.warning("Rate limited. Retrying in %.1f seconds...", delay)
            time.sleep(delay)


def main(argv: Sequence[str] | None = None) -> int:
    configure_logging()
    args = parse_args(argv)

    output_dir = Path(args.output)
    if not output_dir.exists() or not output_dir.is_dir():
        logging.error("Output folder does not exist or is not a directory: %s", output_dir)
        return 1

    try:
        env = load_env()
    except ConfigError as exc:
        logging.error(str(exc))
        return 1

    try:
        items = load_items(Path(args.input))
    except (OSError, ValueError) as exc:
        logging.error("Failed to load input JSON: %s", exc)
        return 1

    client = AzureOpenAI(
        api_key=env["AZURE_OPENAI_API_KEY"],
        azure_endpoint=env["AZURE_OPENAI_ENDPOINT"],
        api_version=env["AZURE_OPENAI_API_VERSION"],
    )

    total_prompts = 0
    saved_count = 0
    skipped_count = 0
    failed_count = 0
    errors: list[str] = []
    used_names: set[str] = set()

    for item in items:
        try:
            title, prompts, filenames = normalize_item(item)
        except ValueError as exc:
            logging.error("Invalid item: %s", exc)
            failed_count += 1
            errors.append(str(exc))
            break

        logging.info("Processing item: %s", title)
        for index, (prompt, filename) in enumerate(zip(prompts, filenames, strict=False)):
            if args.max_images and total_prompts >= args.max_images:
                logging.info("Reached max image limit (%s).", args.max_images)
                break
            total_prompts += 1
            final_prompt = apply_prompt_affixes(
                prompt,
                args.prompt_prefix,
                args.prompt_suffix,
            )

            try:
                output_name = build_output_name(title, filename, index, len(prompts))
                output_name = ensure_unique(output_name, used_names)
            except ValueError as exc:
                logging.error("Failed to build filename for '%s': %s", title, exc)
                failed_count += 1
                errors.append(str(exc))
                return 1

            output_path = output_dir / output_name
            if output_path.exists():
                logging.info("Skipping existing file: %s", output_path)
                skipped_count += 1
                continue

            if args.dry_run:
                logging.info("Dry run: would generate %s", output_path)
                continue

            try:
                image_bytes = generate_image(
                    client,
                    env["AZURE_OPENAI_DEPLOYMENT"],
                    final_prompt,
                )
                output_path.write_bytes(image_bytes)
                saved_count += 1
                logging.info("Saved image: %s", output_path)
            except Exception as exc:  # noqa: BLE001 - CLI should stop on first failure
                logging.error("Generation failed for '%s': %s", title, exc)
                failed_count += 1
                errors.append(f"{title}: {exc}")
                logging.info("Stopping after first failure.")
                break

        if failed_count:
            break
        if args.max_images and total_prompts >= args.max_images:
            break

    logging.info(
        "Run summary: total=%s saved=%s skipped=%s failed=%s",
        total_prompts,
        saved_count,
        skipped_count,
        failed_count,
    )
    if errors:
        logging.info("Errors: %s", "; ".join(errors))

    return 1 if failed_count else 0


if __name__ == "__main__":
    sys.exit(main())

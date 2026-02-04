# Quickstart: Image Generator Utility (Dev CLI)

## Prerequisites

- Azure OpenAI credentials available via environment variables.
- Input JSON file with auction items and image prompts.

## Example Command

Run from repo root:

- Input file required
- Output folder required
- Optional prompt prefix/suffix supported

Example usage:
- `poetry run python backend/scripts/image_generator_cli.py --input ignore/example_auction_items.json --output ./generated-images --prompt-prefix "Studio photo of" --prompt-suffix "high detail"`

## Required Environment Variables

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

## Behavior Notes

- Existing files are skipped and logged as skipped.
- The run stops on the first generation failure.
- Filenames are sanitized and made unique when needed.

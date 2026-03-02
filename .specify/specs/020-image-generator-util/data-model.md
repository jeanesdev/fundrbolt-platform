# Data Model: Image Generator Utility (Dev CLI)

## Entities

### AuctionItem
- **Description**: Represents an auction item record from the input JSON used for image generation.
- **Required fields (for this utility)**:
  - `title` (string): Item name used in file naming.
  - `image_prompt` (string) OR `image_prompts` (array of strings): One or more prompts for image generation.
  - `image_filename` (string) OR `image_filenames` (array of strings): Base filenames for output images.
- **Optional fields (ignored by this utility)**:
  - Any additional fields present in the JSON (e.g., `external_id`, `description`, `category`).

### ImagePrompt
- **Description**: A single prompt associated with an auction item.
- **Fields**:
  - `text` (string): Final prompt text after applying optional prefix/suffix.
  - `index` (integer): Position in the prompt list for multi-image items.

### GeneratedImage
- **Description**: A locally saved image produced from an ImagePrompt.
- **Fields**:
  - `filename` (string): Sanitized filename derived from item title + image filename + optional index.
  - `path` (string): Full path to saved file.
  - `status` (enum): `saved`, `skipped`, or `failed`.

### RunSummary
- **Description**: Aggregated result of a CLI run.
- **Fields**:
  - `total_prompts` (integer)
  - `saved_count` (integer)
  - `skipped_count` (integer)
  - `failed_count` (integer)
  - `errors` (list of strings with item/prompt context)

## Validation Rules

- Either the single-field pair (`image_prompt`, `image_filename`) or the list-field pair (`image_prompts`, `image_filenames`) MUST be present per item.
- When lists are provided, `image_prompts` and `image_filenames` MUST have equal length.
- Prompts MUST be non-empty strings.
- Filenames MUST be non-empty strings after sanitization; otherwise the item is invalid.
- Duplicate target filenames MUST be resolved by appending a numeric index.

## Relationships

- One `AuctionItem` has one or more `ImagePrompt` entries.
- Each `ImagePrompt` results in zero or one `GeneratedImage` depending on skip/fail outcome.

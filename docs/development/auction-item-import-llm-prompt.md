# LLM Prompt: Generate Auction Item Import Pack Data

Use this prompt with your preferred LLM. It outputs a JSON array you can convert into the workbook (`auction_items.xlsx`) and image prompts for AI image generation.

---

## Prompt (copy/paste)

You are generating bulk import data for a nonprofit gala fundraiser auction. These items will be used in a customer demo and should feel realistic for a mid-to-large nonprofit event (donor-friendly, aspirational, and diverse). Produce a **JSON array** of **40 items**. Each item MUST include the fields below and MUST follow the constraints.

**Output format**: JSON array only. No prose, no markdown, no code fences.

**Fields (required):**
- `external_id` (string, unique, format: `demo-###` starting at `demo-001`)
- `title` (string, max 60 chars)
- `description` (string, 2–4 sentences, realistic and sales-friendly)
- `auction_type` (string, either `live` or `silent`)
- `fair_market_value` (number, >= starting_bid)
- `starting_bid` (number, >= 0)
- `category` (string, must be one of: Experiences, Dining, Travel, Wellness, Sports, Family, Art, Retail, Services, Other)
- `image_filename` (string, must match `external_id` with `.png`, e.g., `demo-001.png`)
- `image_prompt` (string, concise, describes the image that matches the item)
- `image_filenames` (array of strings, when multiple images are required; same base name with `_N` suffix)
- `image_prompts` (array of strings, when multiple images are required)

**Fields (optional but include):**
- `buy_it_now` (number or null)
- `quantity` (integer, default 1)
- `donor_name` (string, realistic but fictional)
- `tags` (string, comma-separated)
- `restrictions` (string, 1 sentence)
- `fulfillment_notes` (string, 1 sentence)
- `is_featured` (boolean)
- `sort_order` (integer, 1..40)

**Content constraints:**
- No real brand names, trademarks, or real people.
- Descriptions must match the category and image_prompt.
- Vary categories with at least 4 items per category, and include exactly 2 items with category "Other".
- Use realistic pricing: starting_bid ~ 30–60% of fair_market_value.
- `buy_it_now` should be about 120–150% of fair_market_value or null for ~25% of items.
- Include **10–15 live auction items** (`auction_type = "live"`) that are premium, high-value, and rarer.
- Live auction items must have **starting_bid between $5,000 and $20,000**.
- The remaining items should be **silent auction items** with lower, more accessible starting bids.
- For **6 items**, generate **2–3 images** each. Use `image_filenames` and `image_prompts` for these items and omit `image_filename`/`image_prompt` for those rows. The filenames must share the same base name and add `_1`, `_2`, `_3` before the file extension (e.g., `demo-010_1.png`, `demo-010_2.png`).
- For all other items, provide a single `image_filename` and `image_prompt`.

**Image constraints:**
- Images should be plausible stock-style photos (no text in image).
- Prefer well-lit, high-quality, lifestyle-oriented scenes.
- Avoid logos, trademarks, or recognizable landmarks.
- Live auction images should feel premium and exclusive (e.g., luxury experiences, rare packages, VIP access), without showing brands.

Return only the JSON array.

---

## Notes for internal pipeline
- Convert the JSON to `auction_items.xlsx` with columns: external_id, title, description, auction_type, fair_market_value, starting_bid, category, image_filename, buy_it_now, quantity, donor_name, tags, restrictions, fulfillment_notes, is_featured, sort_order.
- If `image_filenames` is provided, choose the first filename for `image_filename` and generate the rest as additional images in the ZIP.
- Use `image_prompt` to generate each image and save as the specified `image_filename` in `images/`.
- Zip as:
  - `auction_items.xlsx` at root
  - `images/` folder with PNG files

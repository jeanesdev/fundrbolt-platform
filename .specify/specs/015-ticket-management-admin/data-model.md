# Data Model: Ticket Package Management

**Date**: 2026-01-06 | **Feature**: 015-ticket-management-admin

## Entity-Relationship Overview

```
Events (existing)
  ├── TicketPackage (1:N)
  │     ├── CustomTicketOption (1:N)
  │     ├── TicketPurchase (1:N)
  │     └── AuditLog (1:N)
  ├── PromoCode (1:N)
  │     ├── PromoCodeApplication (1:N)
  │     └── AuditLog (1:N)
  └── TicketPurchase (1:N)
        ├── AssignedTicket (1:N)
        ├── OptionResponse (1:N)
        └── PromoCodeApplication (1:1 optional)

Users (existing)
  ├── TicketPurchase (1:N)
  ├── AssignedTicket (1:N)
  └── AuditLog (1:N)
```

## Database Tables

### 1. ticket_packages

Stores ticket package definitions created by event coordinators.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `event_id` | UUID | FOREIGN KEY (events.id), NOT NULL, INDEX | Associated event |
| `name` | VARCHAR(100) | NOT NULL | Package name (e.g., "VIP Table") |
| `description` | TEXT | NULLABLE | Detailed description for donors |
| `price` | DECIMAL(10,2) | NOT NULL, CHECK (price >= 0) | Price per package in USD |
| `seats_per_package` | INTEGER | NOT NULL, CHECK (seats_per_package >= 1 AND seats_per_package <= 100) | Number of tickets/seats included in package |
| `quantity_limit` | INTEGER | NULLABLE, CHECK (quantity_limit >= 0) | Max packages available (NULL = unlimited) |
| `sold_count` | INTEGER | NOT NULL, DEFAULT 0, CHECK (sold_count >= 0) | Number of packages sold |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Order for display (drag-and-drop sets this) |
| `image_url` | VARCHAR(500) | NULLABLE | Azure Blob Storage URL for package image |
| `is_enabled` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether package is available for purchase |
| `created_by` | UUID | FOREIGN KEY (users.id), NOT NULL | Coordinator who created package |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `version` | INTEGER | NOT NULL, DEFAULT 1 | Optimistic locking version |

**Indexes**:

- `idx_ticket_packages_event_id` on `event_id`
- `idx_ticket_packages_display_order` on `event_id, display_order`

**Constraints**:

- `CHECK (quantity_limit IS NULL OR quantity_limit >= sold_count)` - Prevents reducing limit below current sales
- `UNIQUE (event_id, display_order)` - Ensures unique ordering per event

**Notes**:

- `version` column used for optimistic locking (SQLAlchemy version_id_col)
- `display_order` determines sort order in admin UI (0 = first, 1 = second, etc.)
- `is_enabled = FALSE` hides package from donors but preserves data (FR-007)

### 2. custom_ticket_options

Stores custom registration options for ticket packages (up to 4 per package).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `package_id` | UUID | FOREIGN KEY (ticket_packages.id) ON DELETE CASCADE, NOT NULL, INDEX | Associated ticket package |
| `label` | VARCHAR(200) | NOT NULL | Question text (e.g., "Meal preference?") |
| `option_type` | VARCHAR(20) | NOT NULL, CHECK (option_type IN ('boolean', 'multi_select', 'text_input')) | Type of option |
| `choices` | JSONB | NULLABLE | Array of choices for multi_select (e.g., ["Chicken", "Beef", "Vegan"]) |
| `is_required` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether response is mandatory |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Order within package (0-3) |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes**:

- `idx_custom_options_package_id` on `package_id`
- `idx_custom_options_display_order` on `package_id, display_order`

**Constraints**:

- `CHECK (option_type = 'multi_select' OR choices IS NULL)` - Choices only for multi_select
- `UNIQUE (package_id, display_order)` - Ensures unique ordering per package
- **Application-Level**: Max 4 options per package (enforced in service layer, FR-024)

**Notes**:

- `choices` is JSONB array for multi_select options (e.g., `["Option A", "Option B"]`)
- `boolean` type renders as checkbox (true/false response)
- `text_input` type renders as text field (free-form response)
- `is_required = FALSE` allows donors to skip optional fields (FR-027, FR-032)

### 3. option_responses

Stores donor responses to custom ticket options during purchase.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `purchase_id` | UUID | FOREIGN KEY (ticket_purchases.id) ON DELETE CASCADE, NOT NULL, INDEX | Associated purchase |
| `option_id` | UUID | FOREIGN KEY (custom_ticket_options.id), NOT NULL, INDEX | Associated custom option |
| `response_value` | TEXT | NULLABLE | Donor's response (boolean: "true"/"false", multi_select: choice, text_input: free text, or NULL for skipped optional options) |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Response timestamp |

**Indexes**:

- `idx_option_responses_purchase_id` on `purchase_id`
- `idx_option_responses_option_id` on `option_id`

**Constraints**:

- `UNIQUE (purchase_id, option_id)` - One response per option per purchase

**Notes**:

- `response_value` stores all types as TEXT for simplicity (boolean: "true"/"false", multi_select: selected choice, text_input: raw text)
- NULL `response_value` indicates skipped optional option (FR-032)
- For required options, service layer enforces non-NULL before allowing purchase (FR-031)

### 4. promo_codes

Stores promotional discount codes for events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `event_id` | UUID | FOREIGN KEY (events.id), NOT NULL, INDEX | Associated event |
| `code` | VARCHAR(50) | NOT NULL | Unique code (e.g., "EARLYBIRD2026") |
| `discount_type` | VARCHAR(20) | NOT NULL, CHECK (discount_type IN ('percentage', 'fixed_amount')) | Type of discount |
| `discount_value` | DECIMAL(10,2) | NOT NULL, CHECK (discount_value > 0) | Discount amount (percentage: 0-100, fixed: USD) |
| `max_total_uses` | INTEGER | NULLABLE, CHECK (max_total_uses > 0) | Max total redemptions (NULL = unlimited) |
| `current_uses` | INTEGER | NOT NULL, DEFAULT 0, CHECK (current_uses >= 0) | Number of times redeemed |
| `max_uses_per_donor` | INTEGER | NULLABLE, CHECK (max_uses_per_donor > 0) | Max redemptions per donor (NULL = unlimited) |
| `expires_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | Expiration date/time (NULL = no expiration) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether code is currently usable |
| `created_by` | UUID | FOREIGN KEY (users.id), NOT NULL | Coordinator who created code |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `version` | INTEGER | NOT NULL, DEFAULT 1 | Optimistic locking version |

**Indexes**:

- `idx_promo_codes_event_id_code` on `event_id, code` (UNIQUE)
- `idx_promo_codes_expires_at` on `expires_at`

**Constraints**:

- `UNIQUE (event_id, code)` - Codes unique within event (case-sensitive)
- `CHECK (discount_type = 'percentage' OR discount_value <= 99999.99)` - Reasonable limit for fixed discounts
- `CHECK (discount_type = 'fixed_amount' OR (discount_value >= 0 AND discount_value <= 100))` - Percentage: 0-100

**Notes**:

- `version` column used for optimistic locking (prevents over-redemption, FR-046)
- `code` is case-sensitive (e.g., "EARLYBIRD" ≠ "earlybird")
- `discount_type = 'percentage'`: discount_value = 10 means 10% off
- `discount_type = 'fixed_amount'`: discount_value = 25.00 means $25 off
- `max_total_uses = NULL` means unlimited redemptions (FR-041)
- `max_uses_per_donor = NULL` means no per-donor limit (FR-042)
- `expires_at = NULL` means no expiration (FR-044)

### 5. promo_code_applications

Stores which promo codes were applied to which purchases.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `promo_code_id` | UUID | FOREIGN KEY (promo_codes.id), NOT NULL, INDEX | Associated promo code |
| `purchase_id` | UUID | FOREIGN KEY (ticket_purchases.id) ON DELETE CASCADE, NOT NULL, INDEX | Associated purchase |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL, INDEX | Donor who used code |
| `discount_applied` | DECIMAL(10,2) | NOT NULL, CHECK (discount_applied >= 0) | Actual discount amount in USD |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Application timestamp |

**Indexes**:

- `idx_promo_applications_promo_code_id` on `promo_code_id`
- `idx_promo_applications_purchase_id` on `purchase_id` (UNIQUE)
- `idx_promo_applications_user_id` on `user_id`

**Constraints**:

- `UNIQUE (purchase_id)` - One promo code per purchase (FR-039)

**Notes**:

- `discount_applied` stores actual USD amount deducted (calculated from promo code rules)
- Single promo code per purchase (clarification #1)
- Used to enforce per-donor usage limits (FR-043)

### 6. ticket_purchases

Stores completed ticket purchases by donors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `event_id` | UUID | FOREIGN KEY (events.id), NOT NULL, INDEX | Associated event |
| `package_id` | UUID | FOREIGN KEY (ticket_packages.id), NOT NULL, INDEX | Purchased package |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL, INDEX | Donor who purchased |
| `quantity` | INTEGER | NOT NULL, CHECK (quantity > 0) | Number of packages purchased |
| `base_price` | DECIMAL(10,2) | NOT NULL, CHECK (base_price >= 0) | Price before discount |
| `discount_amount` | DECIMAL(10,2) | NOT NULL, DEFAULT 0, CHECK (discount_amount >= 0) | Discount applied (if promo code used) |
| `total_price` | DECIMAL(10,2) | NOT NULL, CHECK (total_price >= 0) | Final price paid (base - discount) |
| `payment_status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) | Payment status |
| `payment_intent_id` | VARCHAR(100) | NULLABLE | Stripe PaymentIntent ID |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Purchase timestamp |

**Indexes**:

- `idx_ticket_purchases_event_id` on `event_id`
- `idx_ticket_purchases_package_id` on `package_id`
- `idx_ticket_purchases_user_id` on `user_id`
- `idx_ticket_purchases_payment_status` on `payment_status`

**Constraints**:

- `CHECK (total_price = base_price - discount_amount)` - Ensures pricing consistency
- `CHECK (total_price >= 0)` - Prevents negative total (floor at $0)

**Notes**:

- `quantity` is number of packages purchased (1 package = N seats depends on package definition)
- `base_price` is package.price * quantity (before discount)
- `discount_amount` is calculated from promo code (0 if no promo code)
- `total_price` is final amount charged (base_price - discount_amount, min $0)
- `payment_intent_id` links to Stripe payment (for refunds/disputes)

### 7. assigned_tickets

Stores individual tickets assigned to specific donors (1 package purchase → N assigned tickets).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `purchase_id` | UUID | FOREIGN KEY (ticket_purchases.id) ON DELETE CASCADE, NOT NULL, INDEX | Associated purchase |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL, INDEX | Donor assigned to this ticket |
| `ticket_number` | VARCHAR(20) | NOT NULL | Unique ticket number for event (e.g., "T-0001") |
| `qr_code` | TEXT | NOT NULL | QR code data for check-in |
| `checked_in` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether ticket has been checked in |
| `checked_in_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | Check-in timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Assignment timestamp |

**Indexes**:

- `idx_assigned_tickets_purchase_id` on `purchase_id`
- `idx_assigned_tickets_user_id` on `user_id`
- `idx_assigned_tickets_ticket_number` on `ticket_number` (UNIQUE)

**Constraints**:

- `UNIQUE (ticket_number)` - Globally unique ticket numbers per event

**Notes**:

- One assigned_ticket per seat in ticket purchase (e.g., purchase quantity=2 → 2 assigned_tickets)
- `qr_code` contains JSON with ticket_id, event_id, user_id for check-in scanning
- `ticket_number` format: "T-{sequential_number}" (e.g., "T-0001", "T-0002")

### 8. audit_logs (extended)

Stores immutable audit trail for ticket package and promo code changes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `entity_type` | VARCHAR(50) | NOT NULL, INDEX | Entity type (e.g., "ticket_package", "promo_code") |
| `entity_id` | UUID | NOT NULL, INDEX | ID of modified entity |
| `action` | VARCHAR(20) | NOT NULL | Action performed ("created", "updated", "deleted", "enabled", "disabled") |
| `user_id` | UUID | FOREIGN KEY (users.id), NOT NULL, INDEX | Coordinator who made change |
| `timestamp` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW(), INDEX | When change occurred |
| `field_name` | VARCHAR(50) | NULLABLE | Field that changed (NULL for create/delete) |
| `old_value` | TEXT | NULLABLE | Previous value (NULL for create) |
| `new_value` | TEXT | NULLABLE | New value (NULL for delete) |
| `metadata` | JSONB | NULLABLE | Additional context (e.g., {"reason": "sold out", "event_id": "..."}) |

**Indexes**:

- `idx_audit_logs_entity` on `entity_type, entity_id`
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_timestamp` on `timestamp`

**Trigger**:

```sql
-- Immutability trigger (prevents UPDATE/DELETE)
CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

**Notes**:

- Logs all changes to ticket_packages and promo_codes after first sale (FR-002, FR-064-068)
- `old_value` and `new_value` stored as TEXT (handles any data type)
- 7-year retention for compliance (constitution requirement)
- Display in admin UI with filtering by entity and date range (FR-066)

## State Transitions

### Ticket Package Lifecycle

```
[Created] → [Enabled (default)]
    ↓
[First Sale] → [Locked for Audit] (can edit with audit trail)
    ↓
[Disabled] → [Hidden from Donors] (sold_count preserved)
    ↓
[Re-Enabled] → [Visible to Donors] (if quantity_limit allows)
```

**States**:

- **Created**: Package defined but not yet visible to donors
- **Enabled**: Available for purchase (`is_enabled = TRUE`)
- **Locked for Audit**: Has sold tickets, all changes logged (`sold_count > 0`)
- **Disabled**: Hidden from purchase flow (`is_enabled = FALSE`, data preserved)
- **Sold Out**: `quantity_limit` reached, cannot purchase more

**Validation Rules**:

- Cannot delete package with sold tickets (FR-022)
- Cannot reduce `quantity_limit` below `sold_count` (database CHECK constraint)
- All changes after first sale logged to audit_logs (FR-064-068)
- Disabling preserves all data (soft delete, FR-007)

### Promo Code Lifecycle

```
[Created] → [Active (default)]
    ↓
[First Redemption] → [Usage Tracking]
    ↓
[Expires] → [Inactive] (expires_at reached)
    ↓
[Max Uses] → [Inactive] (current_uses >= max_total_uses)
```

**States**:

- **Active**: Available for use (`is_active = TRUE`, not expired, under usage limits)
- **Inactive**: Manually deactivated (`is_active = FALSE`)
- **Expired**: Past expiration date (`expires_at < NOW()`)
- **Max Uses Reached**: Total redemptions reached (`current_uses >= max_total_uses`)

**Validation Rules**:

- Cannot delete promo code with redemptions (FK constraint on promo_code_applications)
- Cannot use code if expired (FR-044)
- Cannot use code if total usage limit reached (FR-041)
- Cannot use code if per-donor limit reached (FR-042-043)
- Optimistic locking prevents over-redemption (FR-046)

## Validation Rules

### Ticket Package Validation

| Rule | Implementation | Error Message |
|------|----------------|---------------|
| Name required | NOT NULL constraint | "Package name is required" |
| Name max 100 chars | VARCHAR(100) | "Package name too long (max 100 characters)" |
| Price non-negative | CHECK (price >= 0) | "Price must be 0 or greater" |
| Quantity limit non-negative | CHECK (quantity_limit >= 0 OR quantity_limit IS NULL) | "Quantity limit must be 0 or greater" |
| Max 4 custom options | Service layer count | "Maximum 4 custom options per package" |
| Sold count ≤ quantity limit | CHECK (quantity_limit IS NULL OR quantity_limit >= sold_count) | "Cannot reduce quantity limit below current sales" |
| Image max 5MB | FastAPI validation | "Image must be under 5MB" |
| Image format JPG/PNG/WebP | MIME type validation | "Image must be JPG, PNG, or WebP" |

### Custom Option Validation

| Rule | Implementation | Error Message |
|------|----------------|---------------|
| Label required | NOT NULL constraint | "Option label is required" |
| Label max 200 chars | VARCHAR(200) | "Option label too long (max 200 characters)" |
| Type is valid | CHECK (option_type IN (...)) | "Invalid option type" |
| Choices required for multi_select | CHECK constraint | "Multi-select options require choices" |
| Choices not allowed for boolean/text | CHECK constraint | "Choices only valid for multi-select options" |
| Cannot delete with sold tickets | FK constraint + service layer | "Cannot delete option with sold tickets" |

### Promo Code Validation

| Rule | Implementation | Error Message |
|------|----------------|---------------|
| Code required | NOT NULL constraint | "Promo code is required" |
| Code max 50 chars | VARCHAR(50) | "Promo code too long (max 50 characters)" |
| Code unique per event | UNIQUE (event_id, code) | "Promo code already exists for this event" |
| Discount value > 0 | CHECK (discount_value > 0) | "Discount must be greater than 0" |
| Percentage 0-100 | CHECK (discount_type = 'fixed_amount' OR discount_value <= 100) | "Percentage discount must be 0-100" |
| Code not expired | Service layer datetime check | "Promo code has expired" |
| Total uses under limit | Service layer count | "Promo code usage limit reached" |
| Per-donor uses under limit | Service layer count | "You have already used this promo code" |

### Ticket Purchase Validation

| Rule | Implementation | Error Message |
|------|----------------|---------------|
| Quantity > 0 | CHECK (quantity > 0) | "Quantity must be at least 1" |
| Quantity ≤ available | Service layer + optimistic locking | "Not enough tickets available" |
| Required options answered | Service layer validation | "Please answer all required questions: {field_names}" |
| Promo code valid | Service layer validation | "Invalid or expired promo code" |
| Total price ≥ 0 | CHECK (total_price >= 0) | "Price calculation error" |

## Performance Considerations

### Indexing Strategy

**High-Traffic Queries**:

1. **Get ticket packages for event**: `SELECT * FROM ticket_packages WHERE event_id = ? ORDER BY display_order`
   - Index: `idx_ticket_packages_event_id`
2. **Check promo code validity**: `SELECT * FROM promo_codes WHERE event_id = ? AND code = ?`
   - Index: `idx_promo_codes_event_id_code` (UNIQUE)
3. **Get sales counts**: `SELECT package_id, COUNT(*) FROM ticket_purchases WHERE event_id = ? GROUP BY package_id`
   - Index: `idx_ticket_purchases_package_id`
4. **Check per-donor promo usage**: `SELECT COUNT(*) FROM promo_code_applications WHERE promo_code_id = ? AND user_id = ?`
   - Index: `idx_promo_applications_user_id`

### Caching Strategy

| Data | Cache | TTL | Invalidation |
|------|-------|-----|--------------|
| Sales counts | Redis | 5 seconds | On purchase, ticket_purchases INSERT |
| Promo code metadata | Redis | 60 seconds | On promo_codes UPDATE |
| Ticket package list | Redis | 60 seconds | On ticket_packages INSERT/UPDATE/DELETE |
| Custom options | Redis | 300 seconds | On custom_ticket_options INSERT/UPDATE/DELETE |

### Query Optimization

- **N+1 Prevention**: Use `selectinload()` for ticket_packages → custom_ticket_options
- **Batch Inserts**: Insert multiple assigned_tickets in single transaction
- **Streaming Exports**: Use pandas + StreamingResponse for CSV exports (handles 10k+ rows)
- **Optimistic Locking**: Prevents long-running transactions, improves concurrency

## Data Integrity

### Foreign Key Constraints

- `ticket_packages.event_id` → `events.id` (CASCADE on event delete)
- `ticket_packages.created_by` → `users.id` (RESTRICT, preserve creator)
- `custom_ticket_options.package_id` → `ticket_packages.id` (CASCADE on package delete)
- `promo_codes.event_id` → `events.id` (CASCADE on event delete)
- `promo_codes.created_by` → `users.id` (RESTRICT, preserve creator)
- `ticket_purchases.package_id` → `ticket_packages.id` (RESTRICT, preserve purchase history)
- `ticket_purchases.user_id` → `users.id` (RESTRICT, preserve purchaser)
- `assigned_tickets.purchase_id` → `ticket_purchases.id` (CASCADE on purchase refund)
- `audit_logs.user_id` → `users.id` (RESTRICT, preserve auditor identity)

### Immutability Guarantees

- **audit_logs**: PostgreSQL trigger prevents UPDATE/DELETE
- **Soft Deletes**: ticket_packages.is_enabled = FALSE (never hard delete after sales)
- **Versioning**: ticket_packages.version and promo_codes.version for concurrency control

## Migration Strategy

**Alembic Migration**:

```python
# alembic/versions/xxx_add_ticket_management.py
def upgrade():
    # Create ticket_packages
    op.create_table(
        'ticket_packages',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('event_id', postgresql.UUID(), nullable=False),
        # ... all columns ...
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_ticket_packages_event_id', 'ticket_packages', ['event_id'])

    # Create custom_ticket_options
    # Create promo_codes
    # Create promo_code_applications
    # Create ticket_purchases
    # Create assigned_tickets
    # Create option_responses

    # Create immutability trigger for audit_logs
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit logs are immutable';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER audit_log_immutable
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    """)

def downgrade():
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS audit_log_immutable ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification")

    # Drop tables in reverse order
    op.drop_table('option_responses')
    op.drop_table('assigned_tickets')
    op.drop_table('ticket_purchases')
    op.drop_table('promo_code_applications')
    op.drop_table('promo_codes')
    op.drop_table('custom_ticket_options')
    op.drop_table('ticket_packages')
```

## Summary

**8 database tables**:

1. `ticket_packages` - Package definitions
2. `custom_ticket_options` - Custom registration questions (up to 4 per package)
3. `option_responses` - Donor answers to custom questions
4. `promo_codes` - Discount codes with usage limits and expiration
5. `promo_code_applications` - Redemption records
6. `ticket_purchases` - Completed purchases
7. `assigned_tickets` - Individual tickets with QR codes
8. `audit_logs` - Immutable change tracking (extended existing table)

**Key Design Decisions**:

- Optimistic locking with version columns (prevents race conditions)
- Soft deletes with is_enabled flag (preserves sold package data)
- Immutable audit logs with PostgreSQL trigger (compliance)
- Redis caching for sales counts (reduces DB load)
- JSONB for multi_select choices (flexible, queryable)
- Separate assigned_tickets table (supports multi-seat packages)

Ready to proceed to API contract generation (Phase 1).

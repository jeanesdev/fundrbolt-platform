"""Verify all ticket management tables were created correctly."""

import asyncio
import sys

from sqlalchemy import text

from app.core.database import async_engine


async def verify_ticket_schema():
    """Verify all 8 ticket management tables exist with correct structure."""

    # Expected tables and their key columns
    expected_schema = {
        "ticket_packages": [
            "id",
            "event_id",
            "name",
            "description",
            "price",
            "seats_per_package",
            "quantity_limit",
            "sold_count",
            "display_order",
            "image_url",
            "is_enabled",
            "created_by",
            "created_at",
            "updated_at",
            "version",
        ],
        "custom_ticket_options": [
            "id",
            "ticket_package_id",
            "option_label",
            "option_type",
            "choices",
            "is_required",
            "display_order",
            "created_at",
        ],
        "option_responses": [
            "id",
            "ticket_purchase_id",
            "custom_option_id",
            "response_value",
            "created_at",
        ],
        "promo_codes": [
            "id",
            "event_id",
            "code",
            "discount_type",
            "discount_value",
            "max_uses",
            "used_count",
            "valid_from",
            "valid_until",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
            "version",
        ],
        "promo_code_applications": [
            "id",
            "promo_code_id",
            "ticket_purchase_id",
            "discount_amount",
            "applied_at",
        ],
        "ticket_purchases": [
            "id",
            "event_id",
            "ticket_package_id",
            "user_id",
            "quantity",
            "total_price",
            "payment_status",
            "purchased_at",
        ],
        "assigned_tickets": ["id", "ticket_purchase_id", "ticket_number", "qr_code", "assigned_at"],
        "ticket_audit_logs": [
            "id",
            "entity_type",
            "entity_id",
            "coordinator_id",
            "field_name",
            "old_value",
            "new_value",
            "changed_at",
        ],
    }

    # Expected indexes
    expected_indexes = {
        "ticket_packages": ["idx_ticket_packages_event_id", "idx_ticket_packages_display_order"],
        "custom_ticket_options": [
            "idx_custom_ticket_options_package_id",
            "idx_custom_ticket_options_display_order",
        ],
        "option_responses": ["idx_option_responses_purchase_id", "idx_option_responses_option_id"],
        "promo_codes": ["idx_promo_codes_event_id", "idx_promo_codes_code"],
        "promo_code_applications": [
            "idx_promo_applications_promo_id",
            "idx_promo_applications_purchase_id",
        ],
        "ticket_purchases": [
            "idx_ticket_purchases_event_id",
            "idx_ticket_purchases_package_id",
            "idx_ticket_purchases_user_id",
        ],
        "assigned_tickets": ["idx_assigned_tickets_purchase_id", "idx_assigned_tickets_qr_code"],
        "ticket_audit_logs": [
            "idx_ticket_audit_logs_entity",
            "idx_ticket_audit_logs_coordinator_id",
            "idx_ticket_audit_logs_changed_at",
        ],
    }

    all_passed = True

    async with async_engine.connect() as conn:
        # Check tables exist
        print("Checking table existence...")
        result = await conn.execute(
            text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('ticket_packages', 'custom_ticket_options', 'option_responses',
                              'promo_codes', 'promo_code_applications', 'ticket_purchases',
                              'assigned_tickets', 'ticket_audit_logs')
            ORDER BY table_name
        """)
        )
        existing_tables = {row[0] for row in result}

        for table_name in expected_schema.keys():
            if table_name in existing_tables:
                print(f"✓ {table_name} exists")
            else:
                print(f"✗ {table_name} MISSING")
                all_passed = False

        # Check columns for each table
        print("\nChecking table columns...")
        for table_name, expected_columns in expected_schema.items():
            if table_name not in existing_tables:
                continue

            result = await conn.execute(
                text(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = '{table_name}'
                ORDER BY ordinal_position
            """)
            )
            actual_columns = {row[0] for row in result}

            missing = set(expected_columns) - actual_columns
            if missing:
                print(f"✗ {table_name} missing columns: {', '.join(missing)}")
                all_passed = False
            else:
                print(f"✓ {table_name} has all {len(expected_columns)} required columns")

        # Check indexes
        print("\nChecking indexes...")
        for table_name, expected_idx in expected_indexes.items():
            if table_name not in existing_tables:
                continue

            result = await conn.execute(
                text(f"""
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = '{table_name}'
                AND indexname LIKE 'idx_%'
            """)
            )
            actual_indexes = {row[0] for row in result}

            missing_idx = set(expected_idx) - actual_indexes
            if missing_idx:
                print(f"✗ {table_name} missing indexes: {', '.join(missing_idx)}")
                all_passed = False
            else:
                print(f"✓ {table_name} has all {len(expected_idx)} required indexes")

        # Check audit log trigger
        print("\nChecking audit log trigger...")
        result = await conn.execute(
            text("""
            SELECT trigger_name
            FROM information_schema.triggers
            WHERE event_object_table = 'ticket_audit_logs'
            AND trigger_name = 'prevent_ticket_audit_log_update'
        """)
        )
        trigger_rows = list(result)
        if len(trigger_rows) > 0:
            print("✓ ticket_audit_logs immutability trigger exists")
        else:
            print("✗ ticket_audit_logs immutability trigger MISSING")
            all_passed = False

        # Check enum types
        print("\nChecking enum types...")
        result = await conn.execute(
            text("""
            SELECT typname
            FROM pg_type
            WHERE typname IN ('option_type_enum', 'discount_type_enum', 'payment_status_enum')
        """)
        )
        enum_types = {row[0] for row in result}

        expected_enums = ["option_type_enum", "discount_type_enum", "payment_status_enum"]
        for enum_name in expected_enums:
            if enum_name in enum_types:
                print(f"✓ {enum_name} exists")
            else:
                print(f"✗ {enum_name} MISSING")
                all_passed = False

    await async_engine.dispose()

    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL CHECKS PASSED - Schema verification successful!")
        return 0
    else:
        print("✗ SOME CHECKS FAILED - Schema has issues")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(verify_ticket_schema()))

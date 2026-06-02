"""Add attendee profile survey tables and donor label metadata.

Revision ID: survey_001_add_survey_tables
Revises: 053_paddle_raise_level_notes
Create Date: 2026-06-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "survey_001_add_survey_tables"
down_revision: str | Sequence[str] | None = "053_paddle_raise_level_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE checkout_item_source_type_enum ADD VALUE IF NOT EXISTS 'survey_discount'"
    )

    op.add_column(
        "donor_labels",
        sa.Column(
            "is_system_default", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "donor_label_assignments",
        sa.Column("is_suggested", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "donor_label_assignments",
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.create_check_constraint(
        "ck_donor_label_assignments_source",
        "donor_label_assignments",
        "source IN ('manual', 'survey_auto')",
    )

    op.create_table(
        "event_survey_configs",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "modal_prompt_title",
            sa.String(length=200),
            nullable=False,
            server_default="Tell us about yourself",
        ),
        sa.Column(
            "modal_prompt_body",
            sa.String(length=500),
            nullable=False,
            server_default="Help us understand what matters to you most tonight",
        ),
        sa.Column("discount_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("discount_cents >= 0", name="ck_event_survey_configs_discount_cents"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index("ix_event_survey_configs_event_id", "event_survey_configs", ["event_id"])

    op.create_table(
        "survey_questions",
        sa.Column("survey_config_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["survey_config_id"], ["event_survey_configs.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_survey_questions_survey_config_id", "survey_questions", ["survey_config_id"]
    )
    op.create_index(
        "ix_survey_questions_config_order",
        "survey_questions",
        ["survey_config_id", "display_order"],
    )

    op.create_table(
        "survey_question_options",
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.String(length=300), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["survey_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_survey_question_options_question_id", "survey_question_options", ["question_id"]
    )
    op.create_index(
        "ix_survey_question_options_question_order",
        "survey_question_options",
        ["question_id", "display_order"],
    )

    op.create_table(
        "survey_responses",
        sa.Column("registration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("survey_config_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("discount_cents_applied", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint("status IN ('completed', 'skipped')", name="ck_survey_responses_status"),
        sa.CheckConstraint(
            "discount_cents_applied >= 0",
            name="ck_survey_responses_discount_cents_applied",
        ),
        sa.ForeignKeyConstraint(
            ["registration_id"], ["event_registrations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["survey_config_id"], ["event_survey_configs.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("registration_id"),
    )
    op.create_index("ix_survey_responses_registration_id", "survey_responses", ["registration_id"])
    op.create_index(
        "ix_survey_responses_survey_config_id", "survey_responses", ["survey_config_id"]
    )

    op.create_table(
        "survey_answers",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("selected_option_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("question_text_snapshot", sa.String(length=500), nullable=False),
        sa.Column("option_text_snapshot", sa.String(length=300), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["response_id"], ["survey_responses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["survey_questions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["selected_option_id"],
            ["survey_question_options.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_survey_answers_response_id", "survey_answers", ["response_id"])
    op.create_index("ix_survey_answers_question_id", "survey_answers", ["question_id"])
    op.create_index(
        "ix_survey_answers_selected_option_id", "survey_answers", ["selected_option_id"]
    )

    op.execute(
        """
        INSERT INTO donor_labels (id, npo_id, name, color, is_system_default, created_at, updated_at)
        SELECT gen_random_uuid(), n.id, label_data.name, label_data.color, true, NOW(), NOW()
        FROM npos n
        CROSS JOIN (VALUES
            ('Impact Driven', '#2563EB'),
            ('Heart Driven', '#DC2626'),
            ('Community Driven', '#16A34A'),
            ('Participation Driven', '#D97706')
        ) AS label_data(name, color)
        WHERE NOT EXISTS (
            SELECT 1 FROM donor_labels dl WHERE dl.npo_id = n.id AND dl.name = label_data.name
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_survey_answers_selected_option_id", table_name="survey_answers")
    op.drop_index("ix_survey_answers_question_id", table_name="survey_answers")
    op.drop_index("ix_survey_answers_response_id", table_name="survey_answers")
    op.drop_table("survey_answers")

    op.drop_index("ix_survey_responses_survey_config_id", table_name="survey_responses")
    op.drop_index("ix_survey_responses_registration_id", table_name="survey_responses")
    op.drop_table("survey_responses")

    op.drop_index(
        "ix_survey_question_options_question_order",
        table_name="survey_question_options",
    )
    op.drop_index("ix_survey_question_options_question_id", table_name="survey_question_options")
    op.drop_table("survey_question_options")

    op.drop_index("ix_survey_questions_config_order", table_name="survey_questions")
    op.drop_index("ix_survey_questions_survey_config_id", table_name="survey_questions")
    op.drop_table("survey_questions")

    op.drop_index("ix_event_survey_configs_event_id", table_name="event_survey_configs")
    op.drop_table("event_survey_configs")

    op.drop_constraint("ck_donor_label_assignments_source", "donor_label_assignments")
    op.drop_column("donor_label_assignments", "source")
    op.drop_column("donor_label_assignments", "is_suggested")
    op.drop_column("donor_labels", "is_system_default")

    # PostgreSQL does not support removing enum values in place. The
    # checkout_item_source_type_enum value 'survey_discount' is intentionally left in place.

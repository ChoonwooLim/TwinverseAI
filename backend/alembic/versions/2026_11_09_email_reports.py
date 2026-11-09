"""add metadata-only email reports

Revision ID: 2026_11_09_email_reports
Revises: 2026_05_17_design_md
Create Date: 2026-11-09 07:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "2026_11_09_email_reports"
down_revision: Union[str, Sequence[str], None] = "2026_05_17_design_md"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("report_key", sa.String(length=80), nullable=False),
        sa.Column("total_counts", sa.JSON(), nullable=False),
        sa.Column("account_summaries", sa.JSON(), nullable=False),
        sa.Column("important_items", sa.JSON(), nullable=False),
        sa.Column("action_required_items", sa.JSON(), nullable=False),
        sa.Column("cleanup_results", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("report_date", "report_key", name="uq_email_reports_date_key"),
    )
    op.create_index("ix_email_reports_report_date", "email_reports", ["report_date"])
    op.create_index("ix_email_reports_report_key", "email_reports", ["report_key"])
    op.create_index("ix_email_reports_updated_at", "email_reports", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_email_reports_updated_at", table_name="email_reports")
    op.drop_index("ix_email_reports_report_key", table_name="email_reports")
    op.drop_index("ix_email_reports_report_date", table_name="email_reports")
    op.drop_table("email_reports")

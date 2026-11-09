"""email_report_decisions: admin triage judgements

Revision ID: 20261110_email_report_decisions
Revises: 2026_11_09_email_reports
Create Date: 2026-11-10 00:00:00.000000

Stores admin triage decisions (keep / trash / auto-rule / defer) against the
individual mail summaries ingested into ``email_reports``. This table holds
*intent* only — the backend never reaches out to a mailbox to execute the
chosen action. Message bodies, attachments, credentials, and other sensitive
mail data are explicitly excluded by the ingestion schema and therefore never
reach this table either.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261110_email_report_decisions"
down_revision: Union[str, Sequence[str], None] = "2026_11_09_email_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_report_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("email_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_id", sa.String(length=120), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column(
            "decided_by",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "decided_by_username",
            sa.String(length=120),
            nullable=False,
            server_default="",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "report_id", "item_id", name="uq_email_report_decisions_report_item"
        ),
    )
    op.create_index(
        "ix_email_report_decisions_report_id",
        "email_report_decisions",
        ["report_id"],
    )
    op.create_index(
        "ix_email_report_decisions_decided_by",
        "email_report_decisions",
        ["decided_by"],
    )
    op.create_index(
        "ix_email_report_decisions_updated_at",
        "email_report_decisions",
        ["updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_report_decisions_updated_at", table_name="email_report_decisions"
    )
    op.drop_index(
        "ix_email_report_decisions_decided_by", table_name="email_report_decisions"
    )
    op.drop_index(
        "ix_email_report_decisions_report_id", table_name="email_report_decisions"
    )
    op.drop_table("email_report_decisions")

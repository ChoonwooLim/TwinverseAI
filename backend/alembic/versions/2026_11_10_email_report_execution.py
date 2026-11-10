"""email_report_decisions: add execution lifecycle fields

Revision ID: 20261110_email_report_execution
Revises: 20261110_email_report_decisions
Create Date: 2026-11-10 12:00:00.000000

Admin decisions must be executed against the real mailbox by an external
trusted worker (OpenClaw). This migration adds the execution lifecycle
columns (action, status, attempts, lease, error, executed_at,
last_attempt_at) required to safely hand each decision to the worker,
retry on failure, and recover expired leases.

Existing rows are upgraded so the worker can start executing historic
decisions:

- ``decide_later`` rows become ``not_applicable`` (no mailbox op is needed).
- ``trash`` / ``auto_trash_similar`` rows become ``pending`` with action
  ``trash`` so the worker will move those messages to Trash (recoverable
  — never a permanent delete).
- ``keep`` / ``always_keep_similar`` / ``auto_archive`` rows become
  ``pending`` with action ``archive``; the worker decides the safe no-op
  path if the message is already out of the inbox.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261110_email_report_execution"
down_revision: Union[str, Sequence[str], None] = "20261110_email_report_decisions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_report_decisions",
        sa.Column("action", sa.String(length=16), nullable=False, server_default="noop"),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("lease_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("error_code", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("error_message", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "email_report_decisions",
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_email_report_decisions_status",
        "email_report_decisions",
        ["status"],
    )
    op.create_index(
        "ix_email_report_decisions_lease_token",
        "email_report_decisions",
        ["lease_token"],
    )

    # Backfill existing decisions into the correct lifecycle bucket so the
    # worker can start executing them. SQL is dialect-agnostic.
    op.execute(
        """
        UPDATE email_report_decisions
        SET action = 'trash', status = 'pending'
        WHERE decision IN ('trash', 'auto_trash_similar')
        """
    )
    op.execute(
        """
        UPDATE email_report_decisions
        SET action = 'archive', status = 'pending'
        WHERE decision IN ('keep', 'always_keep_similar', 'auto_archive')
        """
    )
    op.execute(
        """
        UPDATE email_report_decisions
        SET action = 'noop', status = 'not_applicable'
        WHERE decision = 'decide_later'
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_report_decisions_lease_token",
        table_name="email_report_decisions",
    )
    op.drop_index(
        "ix_email_report_decisions_status",
        table_name="email_report_decisions",
    )
    op.drop_column("email_report_decisions", "last_attempt_at")
    op.drop_column("email_report_decisions", "executed_at")
    op.drop_column("email_report_decisions", "error_message")
    op.drop_column("email_report_decisions", "error_code")
    op.drop_column("email_report_decisions", "lease_expires_at")
    op.drop_column("email_report_decisions", "lease_token")
    op.drop_column("email_report_decisions", "attempts")
    op.drop_column("email_report_decisions", "status")
    op.drop_column("email_report_decisions", "action")

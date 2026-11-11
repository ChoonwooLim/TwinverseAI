"""auth_devices: remembered devices for automatic sign-in

Revision ID: 20261112_auth_devices
Revises: 20261110_email_report_execution
Create Date: 2026-11-12 00:00:00.000000

Holds one row per device a user chose to keep signed in. Only the SHA-256
hash of the device token is stored; the raw value lives in the browser's
HttpOnly ``tv_device`` cookie. Access tokens (JWT) are unchanged.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261112_auth_devices"
down_revision: Union[str, Sequence[str], None] = "20261110_email_report_execution"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("user_agent", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("ip_address", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_auth_devices_user_id", "auth_devices", ["user_id"])
    op.create_index("ix_auth_devices_expires_at", "auth_devices", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_devices_expires_at", table_name="auth_devices")
    op.drop_index("ix_auth_devices_user_id", table_name="auth_devices")
    op.drop_table("auth_devices")

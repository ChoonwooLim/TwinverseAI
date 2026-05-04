"""news apply tracking (apply_status, apply_action, applied_at, requires_approval)

Revision ID: f1a2b3c4d5e6
Revises: e6ddef2e455e
Create Date: 2026-05-05 12:00:00.000000

Adds tracking columns to claudenews so the news-watch automation
can record which items were auto-applied vs await approval.

Existing rows (the 5 hardcoded seeds from main.py) are backfilled to
apply_status='info_only' since they were never tied to an apply action.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e6ddef2e455e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add columns with safe defaults so existing rows fill in cleanly.
    op.add_column(
        'claudenews',
        sa.Column('apply_status', sa.String(), nullable=False, server_default='pending'),
    )
    op.add_column(
        'claudenews',
        sa.Column('apply_action', sa.String(), nullable=True),
    )
    op.add_column(
        'claudenews',
        sa.Column('applied_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'claudenews',
        sa.Column('requires_approval', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # 2. Index source_url and apply_status for crawler de-dup + admin filtering.
    op.create_index(op.f('ix_claudenews_source_url'), 'claudenews', ['source_url'], unique=False)
    op.create_index(op.f('ix_claudenews_apply_status'), 'claudenews', ['apply_status'], unique=False)

    # 3. Backfill existing seed rows: they are informational, no apply action.
    op.execute("UPDATE claudenews SET apply_status = 'info_only' WHERE apply_status = 'pending'")

    # 4. Drop server_default on apply_status now that backfill is done — model owns the default.
    op.alter_column('claudenews', 'apply_status', server_default=None)
    op.alter_column('claudenews', 'requires_approval', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_claudenews_apply_status'), table_name='claudenews')
    op.drop_index(op.f('ix_claudenews_source_url'), table_name='claudenews')
    op.drop_column('claudenews', 'requires_approval')
    op.drop_column('claudenews', 'applied_at')
    op.drop_column('claudenews', 'apply_action')
    op.drop_column('claudenews', 'apply_status')

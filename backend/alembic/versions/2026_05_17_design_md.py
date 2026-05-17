"""design_md and design_md_sync_meta tables

Revision ID: 2026_05_17_design_md
Revises: f1a2b3c4d5e6
Create Date: 2026-05-17 00:00:00.000000

voltagent/awesome-design-md 캐시 + sync 메타.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_05_17_design_md'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'design_md',
        sa.Column('slug', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default=''),
        sa.Column('tagline', sa.String(), nullable=False, server_default=''),
        sa.Column('design_md', sa.Text(), nullable=False),
        sa.Column('getdesign_url', sa.String(), nullable=False),
        sa.Column('github_url', sa.String(), nullable=False),
        sa.Column('color_tokens', sa.JSON(), nullable=True),
        sa.Column('font_tokens', sa.JSON(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index('ix_design_md_category', 'design_md', ['category'])

    op.create_table(
        'design_md_sync_meta',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('last_sync_started', sa.DateTime(), nullable=True),
        sa.Column('last_sync_finished', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(), nullable=False, server_default='never'),
        sa.Column('last_sync_error', sa.String(), nullable=True),
        sa.Column('samples_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('design_md_sync_meta')
    op.drop_index('ix_design_md_category', table_name='design_md')
    op.drop_table('design_md')

"""Add prediction_cache table

Revision ID: a9f3b81c2d44
Revises: 3c68a2e6fcd8
Create Date: 2026-07-27 14:24:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9f3b81c2d44'
down_revision: Union[str, None] = '3c68a2e6fcd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use checkfirst=True because SQLAlchemy create_all() may have already created
    # this table when the server auto-reloaded after db_models.py was updated.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'prediction_cache' not in inspector.get_table_names():
        op.create_table(
            'prediction_cache',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('predictions', sa.JSON(), nullable=False),
            sa.Column('skill_radar', sa.JSON(), nullable=True),
            sa.Column('top_insight', sa.String(), nullable=True),
            sa.Column('cgpa', sa.Float(), nullable=True),
            sa.Column('computed_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_prediction_cache_id'), 'prediction_cache', ['id'], unique=False)
        op.create_index(op.f('ix_prediction_cache_user_id'), 'prediction_cache', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_prediction_cache_user_id'), table_name='prediction_cache')
    op.drop_index(op.f('ix_prediction_cache_id'), table_name='prediction_cache')
    op.drop_table('prediction_cache')

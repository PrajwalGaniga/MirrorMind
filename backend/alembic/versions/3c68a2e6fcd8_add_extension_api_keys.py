"""Add extension_api_keys

Revision ID: 3c68a2e6fcd8
Revises: 4b1b752a9411
Create Date: 2026-07-27 12:37:44.818445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c68a2e6fcd8'
down_revision: Union[str, None] = '4b1b752a9411'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('extension_api_keys',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('key_prefix', sa.String(), nullable=False),
    sa.Column('key_hash', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('revoked', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_extension_api_keys_id'), 'extension_api_keys', ['id'], unique=False)
    op.create_index(op.f('ix_extension_api_keys_user_id'), 'extension_api_keys', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_extension_api_keys_user_id'), table_name='extension_api_keys')
    op.drop_index(op.f('ix_extension_api_keys_id'), table_name='extension_api_keys')
    op.drop_table('extension_api_keys')

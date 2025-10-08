"""Add type field to trucks table

Revision ID: 001_add_truck_type
Revises:
Create Date: 2025-10-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_truck_type'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for truck_type
    truck_type_enum = postgresql.ENUM('truck', 'trailer', name='trucktype')
    truck_type_enum.create(op.get_bind(), checkfirst=True)

    # Add type column to trucks table with default value 'truck'
    op.add_column('trucks', sa.Column('type', truck_type_enum, nullable=False, server_default='truck'))


def downgrade() -> None:
    # Remove type column
    op.drop_column('trucks', 'type')

    # Drop enum type
    truck_type_enum = postgresql.ENUM('truck', 'trailer', name='trucktype')
    truck_type_enum.drop(op.get_bind(), checkfirst=True)

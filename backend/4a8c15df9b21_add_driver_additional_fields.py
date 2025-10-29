"""add driver additional fields

Revision ID: 4a8c15df9b21
Revises: 3f4b24be8ae3
Create Date: 2025-10-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4a8c15df9b21'
down_revision = '3f4b24be8ae3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to drivers table
    op.add_column('drivers', sa.Column('date_hired', sa.Date(), nullable=True))
    op.add_column('drivers', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('drivers', sa.Column('experience', sa.String(), nullable=True))
    op.add_column('drivers', sa.Column('mvr_expiry', sa.Date(), nullable=True))
    op.add_column('drivers', sa.Column('medical_card_expiry', sa.Date(), nullable=True))


def downgrade() -> None:
    # Remove the columns if rolling back
    op.drop_column('drivers', 'medical_card_expiry')
    op.drop_column('drivers', 'mvr_expiry')
    op.drop_column('drivers', 'experience')
    op.drop_column('drivers', 'date_of_birth')
    op.drop_column('drivers', 'date_hired')

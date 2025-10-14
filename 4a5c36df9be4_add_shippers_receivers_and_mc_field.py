"""add shippers receivers and mc field

Revision ID: 4a5c36df9be4
Revises: 3f4b24be8ae3
Create Date: 2025-10-11 03:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4a5c36df9be4'
down_revision = '3f4b24be8ae3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add MC field to customers table
    op.add_column('customers', sa.Column('mc', sa.String(), nullable=True))

    # Create shippers table
    op.create_table('shippers',
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('zip_code', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('contact_person', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('product_type', sa.String(), nullable=True),
        sa.Column('average_wait_time', sa.String(), nullable=True),
        sa.Column('appointment_type', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shippers_id'), 'shippers', ['id'], unique=False)

    # Create receivers table
    op.create_table('receivers',
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('zip_code', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('contact_person', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('product_type', sa.String(), nullable=True),
        sa.Column('average_wait_time', sa.String(), nullable=True),
        sa.Column('appointment_type', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_receivers_id'), 'receivers', ['id'], unique=False)


def downgrade() -> None:
    # Drop receivers table
    op.drop_index(op.f('ix_receivers_id'), table_name='receivers')
    op.drop_table('receivers')

    # Drop shippers table
    op.drop_index(op.f('ix_shippers_id'), table_name='shippers')
    op.drop_table('shippers')

    # Remove MC field from customers
    op.drop_column('customers', 'mc')

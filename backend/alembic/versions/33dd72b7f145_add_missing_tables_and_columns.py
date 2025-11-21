"""add_missing_tables_and_columns

Revision ID: 33dd72b7f145
Revises: 3f4b24be8ae3
Create Date: 2025-11-21 03:31:33.023815

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision = '33dd72b7f145'
down_revision = '3f4b24be8ae3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add mc column to customers table
    op.execute("""
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS mc VARCHAR;
    """)

    # Create shippers table
    op.execute("""
        CREATE TABLE IF NOT EXISTS shippers (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            address TEXT,
            city VARCHAR,
            state VARCHAR,
            zip_code VARCHAR,
            phone VARCHAR,
            contact_person VARCHAR,
            email VARCHAR,
            product_type VARCHAR,
            average_wait_time VARCHAR,
            appointment_type VARCHAR,
            notes TEXT,
            company_id INTEGER NOT NULL REFERENCES companies(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_shippers_company ON shippers(company_id);
    """)

    # Create receivers table
    op.execute("""
        CREATE TABLE IF NOT EXISTS receivers (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            address TEXT,
            city VARCHAR,
            state VARCHAR,
            zip_code VARCHAR,
            phone VARCHAR,
            contact_person VARCHAR,
            email VARCHAR,
            product_type VARCHAR,
            average_wait_time VARCHAR,
            appointment_type VARCHAR,
            notes TEXT,
            company_id INTEGER NOT NULL REFERENCES companies(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_receivers_company ON receivers(company_id);
    """)


def downgrade() -> None:
    # Drop tables and column in reverse order
    op.execute("DROP INDEX IF EXISTS idx_receivers_company;")
    op.execute("DROP TABLE IF EXISTS receivers;")

    op.execute("DROP INDEX IF EXISTS idx_shippers_company;")
    op.execute("DROP TABLE IF EXISTS shippers;")

    op.execute("ALTER TABLE customers DROP COLUMN IF EXISTS mc;")
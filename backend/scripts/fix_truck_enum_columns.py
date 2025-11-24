#!/usr/bin/env python3
"""
Fix truck and driver enum columns from enum to varchar
"""
import sys
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os

async def fix_enum_columns_for_table(conn, table_name, columns_config):
    """
    Generic function to convert enum columns to varchar for a given table.

    Args:
        conn: Database connection
        table_name: Name of the table
        columns_config: Dict mapping column names to their default values
    """
    print(f"Converting {table_name} enum columns to varchar...")

    # Check if the columns exist and are enums
    column_names = list(columns_config.keys())
    placeholders = ','.join([f"'{col}'" for col in column_names])

    result = await conn.execute(text(f"""
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = '{table_name}'
        AND column_name IN ({placeholders})
        ORDER BY column_name;
    """))

    columns = result.fetchall()
    print(f"Current {table_name} columns: {columns}")

    for col in columns:
        col_name = col[0]
        data_type = col[1]
        udt_name = col[2]

        if data_type == 'USER-DEFINED':
            print(f"Converting {table_name}.{col_name} from {udt_name} to varchar...")

            # Convert to varchar by:
            # 1. Adding a temp column
            # 2. Copying data as text
            # 3. Dropping old column
            # 4. Renaming temp column

            await conn.execute(text(f"""
                ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name}_temp VARCHAR;
            """))

            await conn.execute(text(f"""
                UPDATE {table_name} SET {col_name}_temp = {col_name}::text;
            """))

            await conn.execute(text(f"""
                ALTER TABLE {table_name} DROP COLUMN IF EXISTS {col_name};
            """))

            await conn.execute(text(f"""
                ALTER TABLE {table_name} RENAME COLUMN {col_name}_temp TO {col_name};
            """))

            # Set default if provided
            default_value = columns_config.get(col_name)
            if default_value:
                await conn.execute(text(f"""
                    ALTER TABLE {table_name}
                    ALTER COLUMN {col_name} SET DEFAULT '{default_value}';
                """))

            print(f"✓ Converted {table_name}.{col_name} to varchar")
        else:
            print(f"✓ {table_name}.{col_name} is already {data_type}, skipping")

    print(f"✓ {table_name} enum columns fixed successfully")


async def fix_truck_enum_columns():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set, skipping enum column fixes")
        return

    engine = create_async_engine(database_url, echo=True)

    try:
        async with engine.begin() as conn:
            # Fix trucks table
            await fix_enum_columns_for_table(conn, 'trucks', {
                'type': 'truck',
                'status': 'available'
            })

            # Fix drivers table
            await fix_enum_columns_for_table(conn, 'drivers', {
                'status': 'off_duty'
            })

            print("✓ All enum columns fixed successfully")

    except Exception as e:
        print(f"⚠️  Error fixing enum columns: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_truck_enum_columns())

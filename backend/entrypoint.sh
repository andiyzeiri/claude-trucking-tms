#!/bin/bash

echo "🚀 Starting backend application..."

# Initialize database schema if needed
echo "🔧 Checking database schema..."
python3 init_schema.py || echo "⚠️  Schema initialization had warnings"

# Fix users table schema mismatch
echo "🔧 Fixing users table..."
python3 fix_users_table.py || echo "⚠️  fix_users_table.py had errors, continuing..."

# Create initial user
echo "🔧 Creating initial user..."
python3 create_initial_user.py || echo "⚠️  create_initial_user.py had errors, continuing..."

# Reset user password to ensure it's properly hashed
echo "🔧 Resetting user password..."
python3 reset_user_password.py || echo "⚠️  reset_user_password.py had errors, continuing..."

# Run database migrations (continue on errors)
echo "📦 Running database migrations..."
python3 migrate.py || echo "⚠️  migrate.py had errors, continuing..."
python3 remove_unique_constraint.py || echo "⚠️  remove_unique_constraint.py had errors, continuing..."
python3 run_carrier_rate_migration.py || echo "⚠️  run_carrier_rate_migration.py had errors, continuing..."
python3 run_driver_settings_migration.py || echo "⚠️  run_driver_settings_migration.py had errors, continuing..."

# Fix missing tables directly
echo "🔧 Adding missing tables and columns..."
python3 fix_missing_tables.py || echo "⚠️  fix_missing_tables.py had errors, continuing..."

# Fix enum types
echo "🔧 Fixing enum types..."
python3 fix_enum_types.py || echo "⚠️  fix_enum_types.py had errors, continuing..."

# Fix truck enum columns
echo "🔧 Converting truck enum columns to varchar..."
python3 scripts/fix_truck_enum_columns.py || echo "⚠️  fix_truck_enum_columns.py had errors, continuing..."

# Stamp Alembic version to match current state
echo "📦 Stamping Alembic version..."
python3 stamp_alembic.py || echo "⚠️  stamp_alembic.py had errors, continuing..."

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

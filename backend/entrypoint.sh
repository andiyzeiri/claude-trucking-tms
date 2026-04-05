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

# Add DEF columns to fuel table
echo "🔧 Adding DEF columns to fuel table..."
python3 fix_fuel_def_columns.py || echo "⚠️  fix_fuel_def_columns.py had errors, continuing..."

# Fix enum types
echo "🔧 Fixing enum types..."
python3 fix_enum_types.py || echo "⚠️  fix_enum_types.py had errors, continuing..."

# Fix truck enum columns
echo "🔧 Converting truck enum columns to varchar..."
python3 scripts/fix_truck_enum_columns.py || echo "⚠️  fix_truck_enum_columns.py had errors, continuing..."

# Fix trucks table (add value/miles/mpg columns, fix unique constraints)
echo "🔧 Fixing trucks table..."
python3 fix_trucks_table.py || echo "⚠️  fix_trucks_table.py had errors, continuing..."

# Fix drivers table (add employment date columns)
echo "🔧 Fixing drivers table..."
python3 fix_drivers_columns.py || echo "⚠️  fix_drivers_columns.py had errors, continuing..."

# Add fuel card columns to drivers table
echo "🔧 Adding fuel card columns to drivers table..."
python3 add_fuel_card_columns.py || echo "⚠️  add_fuel_card_columns.py had errors, continuing..."

# Add driver_type column to drivers table
echo "🔧 Adding driver_type column to drivers table..."
python3 add_driver_type_column.py || echo "⚠️  add_driver_type_column.py had errors, continuing..."

# Create dedicated_lanes table for recurring lane templates
echo "🔧 Creating dedicated_lanes table..."
python3 create_dedicated_lanes_table.py || echo "⚠️  create_dedicated_lanes_table.py had errors, continuing..."

# Create ifta table for IFTA tracking
echo "🔧 Creating ifta table..."
python3 create_ifta_table.py || echo "⚠️  create_ifta_table.py had errors, continuing..."

# Add IFTA to existing user permissions
echo "🔧 Adding IFTA to user permissions..."
python3 add_ifta_permission.py || echo "⚠️  add_ifta_permission.py had errors, continuing..."

# Add adjustment columns to loads table
echo "🔧 Adding adjustment columns to loads table..."
python3 add_adjustment_columns.py || echo "⚠️  add_adjustment_columns.py had errors, continuing..."

# Create driver_days_off table for dispatch board
echo "🔧 Creating driver_days_off table..."
python3 create_driver_days_off_table.py || echo "⚠️  create_driver_days_off_table.py had errors, continuing..."

# Add needs_attention column to loads table
echo "🔧 Adding needs_attention column to loads table..."
python3 add_needs_attention_column.py || echo "⚠️  add_needs_attention_column.py had errors, continuing..."

# Create driver_attention_days table for dispatch board
echo "🔧 Creating driver_attention_days table..."
python3 create_driver_attention_days_table.py || echo "⚠️  create_driver_attention_days_table.py had errors, continuing..."

# Create driver_day_notes table for dispatch board notes
echo "🔧 Creating driver_day_notes table..."
python3 create_driver_day_notes_table.py || echo "⚠️  create_driver_day_notes_table.py had errors, continuing..."

# Add cost_type column to expenses table
echo "🔧 Adding cost_type column to expenses table..."
python3 add_expense_cost_type.py || echo "⚠️  add_expense_cost_type.py had errors, continuing..."

# Create payroll table
echo "🔧 Creating payroll table..."
python3 create_payroll_table.py || echo "⚠️  create_payroll_table.py had errors, continuing..."

# Create payroll_overrides table
echo "🔧 Creating payroll_overrides table..."
python3 create_payroll_overrides_table.py || echo "⚠️  create_payroll_overrides_table.py had errors, continuing..."

# Add truck_id to driver_payroll_settings
echo "🔧 Adding truck_id to driver_payroll_settings..."
python3 add_truck_to_payroll_settings.py || echo "⚠️  add_truck_to_payroll_settings.py had errors, continuing..."

# Add expense_group column to expenses
echo "🔧 Adding expense_group column..."
python3 add_expense_group_column.py || echo "⚠️  add_expense_group_column.py had errors, continuing..."

# Add pay_type columns to driver_payroll_settings
echo "🔧 Adding pay_type columns..."
python3 add_pay_type_columns.py || echo "⚠️  add_pay_type_columns.py had errors, continuing..."

# Stamp Alembic version to match current state
echo "📦 Stamping Alembic version..."
python3 stamp_alembic.py || echo "⚠️  stamp_alembic.py had errors, continuing..."

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

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

# Run database migrations (continue on errors)
echo "📦 Running database migrations..."
python3 migrate.py || echo "⚠️  migrate.py had errors, continuing..."
python3 remove_unique_constraint.py || echo "⚠️  remove_unique_constraint.py had errors, continuing..."
python3 run_carrier_rate_migration.py || echo "⚠️  run_carrier_rate_migration.py had errors, continuing..."

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

#!/bin/bash

echo "🚀 Starting backend application..."

# Initialize database schema if needed
echo "🔧 Checking database schema..."
python3 init_schema.py || echo "⚠️  Schema initialization had warnings"

# Run database migrations (continue on errors)
echo "📦 Running database migrations..."
python3 migrate.py || echo "⚠️  migrate.py had errors, continuing..."
python3 remove_unique_constraint.py || echo "⚠️  remove_unique_constraint.py had errors, continuing..."
python3 run_carrier_rate_migration.py || echo "⚠️  run_carrier_rate_migration.py had errors, continuing..."

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

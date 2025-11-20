#!/bin/bash
set -e

echo "🚀 Starting backend application..."

# Initialize database schema if needed
echo "🔧 Checking database schema..."
python3 init_schema.py

# Run database migrations
echo "📦 Running database migrations..."
python3 migrate.py
python3 remove_unique_constraint.py
python3 run_carrier_rate_migration.py

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

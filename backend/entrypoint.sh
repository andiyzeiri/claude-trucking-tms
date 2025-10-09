#!/bin/bash
set -e

echo "🚀 Starting backend application..."

# Run database migrations
echo "📦 Running database migrations..."
python3 migrate.py

# Start the application
echo "✅ Migrations complete. Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

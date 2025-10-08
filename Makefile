.PHONY: help up down restart logs build clean migrate db-shell api-shell test health

# Default target
help:
	@echo "Andi's Trucking TMS - Development Commands"
	@echo ""
	@echo "Quick Start:"
	@echo "  make up          - Start all services"
	@echo "  make migrate     - Run database migrations"
	@echo "  make health      - Check API health"
	@echo "  make logs        - View logs"
	@echo ""
	@echo "Service Management:"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make build       - Rebuild containers"
	@echo "  make clean       - Stop and remove all data"
	@echo ""
	@echo "Development:"
	@echo "  make db-shell    - Open PostgreSQL shell"
	@echo "  make api-shell   - Open backend Python shell"
	@echo "  make migrate     - Run Alembic migrations"
	@echo "  make test        - Run backend tests"
	@echo ""
	@echo "Logs:"
	@echo "  make logs        - View all logs"
	@echo "  make logs-api    - View API logs"
	@echo "  make logs-web    - View frontend logs"
	@echo "  make logs-db     - View database logs"

# Start all services
up:
	@echo "Starting all services..."
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "Services started!"
	@echo "API: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "API Docs: http://localhost:8000/docs"

# Stop all services
down:
	@echo "Stopping all services..."
	docker-compose down

# Restart all services
restart:
	@echo "Restarting all services..."
	docker-compose restart

# Build containers
build:
	@echo "Building containers..."
	docker-compose build

# Clean everything (removes volumes)
clean:
	@echo "⚠️  WARNING: This will delete all data!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	docker-compose down -v
	@echo "Cleaned up!"

# View all logs
logs:
	docker-compose logs -f

# View API logs
logs-api:
	docker-compose logs -f api

# View frontend logs
logs-web:
	docker-compose logs -f web

# View database logs
logs-db:
	docker-compose logs -f db

# Run database migrations
migrate:
	@echo "Running database migrations..."
	docker-compose exec api alembic upgrade head
	@echo "Enabling PostGIS extension..."
	docker-compose exec db psql -U postgres -d anditms -c "CREATE EXTENSION IF NOT EXISTS postgis;"
	docker-compose exec db psql -U postgres -d anditms -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
	@echo "Migrations complete!"

# Create new migration
migration:
	@read -p "Enter migration name: " name; \
	docker-compose exec api alembic revision --autogenerate -m "$$name"

# PostgreSQL shell
db-shell:
	docker-compose exec db psql -U postgres -d anditms

# Python shell
api-shell:
	docker-compose exec api python

# Run tests
test:
	@echo "Running tests..."
	docker-compose exec api pytest -v

# Check API health
health:
	@echo "Checking API health..."
	@curl -s http://localhost:8000/health | jq '.'

# Check service status
status:
	@docker-compose ps

# Setup (first time)
setup: up migrate
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Your TMS is ready at:"
	@echo "  API: http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "Next steps:"
	@echo "  make health      - Check API health"
	@echo "  make logs        - View logs"
	@echo "  make db-shell    - Open database shell"

# Quick check
check: status health

# Backup database
backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	@docker-compose exec -T db pg_dump -U postgres anditms > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in backups/"

# Restore database
restore:
	@read -p "Enter backup file path: " file; \
	docker-compose exec -T db psql -U postgres -d anditms < $$file

# Production build test
build-prod:
	@echo "Building production images..."
	docker build -t andi-tms-api:latest ./backend
	docker build -t andi-tms-web:latest ./frontend
	@echo "Production images built!"

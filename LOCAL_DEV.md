# Local Development Guide - Andi's Trucking TMS

Complete guide for running the TMS locally with Docker Compose.

## Prerequisites

- Docker Engine 20.x+
- Docker Compose 2.x+
- Git

## Quick Start (5 minutes)

### 1. Clone and Setup
```bash
cd /home/andi/claude-trucking-tms
cp backend/.env.example backend/.env  # If not already done
```

### 2. Start All Services
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 15** on port 5432 (with PostGIS ready)
- **Redis 7** on port 6379
- **FastAPI backend** on port 8000
- **Next.js frontend** on port 3000

### 3. Apply Database Migrations
```bash
# Wait for database to be ready (~10 seconds)
docker-compose exec api alembic upgrade head
```

### 4. Enable PostGIS Extension
```bash
docker-compose exec db psql -U postgres -d anditms -c "CREATE EXTENSION IF NOT EXISTS postgis;"
docker-compose exec db psql -U postgres -d anditms -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
```

### 5. Verify Everything is Running
```bash
# Check all services
docker-compose ps

# Test API health
curl http://localhost:8000/health

# Test frontend
curl http://localhost:3000

# View API docs
open http://localhost:8000/docs
```

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   Next.js       │
│   Port: 3000    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Backend       │
│   FastAPI       │
│   Port: 8000    │
└────┬────────┬───┘
     │        │
     ↓        ↓
┌─────────┐ ┌──────────┐
│ Postgres│ │  Redis   │
│  :5432  │ │  :6379   │
└─────────┘ └──────────┘
```

## Service Details

### PostgreSQL Database
- **Host**: localhost:5432 (from host), db:5432 (from containers)
- **Database**: anditms
- **User**: postgres
- **Password**: dev
- **Connection String**: `postgresql://postgres:dev@localhost:5432/anditms`

### Redis Cache
- **Host**: localhost:6379 (from host), redis:6379 (from containers)
- **URL**: `redis://localhost:6379/0`

### FastAPI Backend
- **URL**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health
- **Auto-reload**: Enabled (changes to `backend/app/` reload automatically)

### Next.js Frontend
- **URL**: http://localhost:3000
- **API URL**: http://localhost:8000 (configured via NEXT_PUBLIC_API_URL)
- **Hot reload**: Enabled (changes to `frontend/src/` reload automatically)

## Common Commands

### Service Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (⚠ destroys data)
docker-compose down -v

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db

# Restart a service
docker-compose restart api

# Rebuild and restart (after Dockerfile changes)
docker-compose up -d --build api
```

### Database Operations
```bash
# Connect to PostgreSQL
docker-compose exec db psql -U postgres -d anditms

# Run SQL file
docker-compose exec -T db psql -U postgres -d anditms < schema.sql

# Create database backup
docker-compose exec db pg_dump -U postgres anditms > backup.sql

# Restore database backup
docker-compose exec -T db psql -U postgres -d anditms < backup.sql

# Reset database
docker-compose down -v
docker-compose up -d db
docker-compose exec api alembic upgrade head
```

### Migration Commands
```bash
# Create new migration
docker-compose exec api alembic revision --autogenerate -m "Add new table"

# Apply migrations
docker-compose exec api alembic upgrade head

# Rollback one migration
docker-compose exec api alembic downgrade -1

# View migration history
docker-compose exec api alembic history

# View current version
docker-compose exec api alembic current
```

### Backend Development
```bash
# Install new Python package
docker-compose exec api pip install package-name
docker-compose exec api pip freeze > backend/requirements.txt

# Run Python shell
docker-compose exec api python

# Run tests (if configured)
docker-compose exec api pytest

# Check logs
docker-compose logs -f api

# Restart API after config changes
docker-compose restart api
```

### Frontend Development
```bash
# Install new npm package
docker-compose exec web npm install package-name

# Run Next.js build
docker-compose exec web npm run build

# Check logs
docker-compose logs -f web

# Restart frontend
docker-compose restart web
```

## Development Workflow

### 1. Backend Development
```bash
# 1. Make changes to backend/app/*.py files
# 2. API auto-reloads (watch logs)
docker-compose logs -f api

# 3. Test changes
curl http://localhost:8000/health

# 4. Create migration if models changed
docker-compose exec api alembic revision --autogenerate -m "Description"
docker-compose exec api alembic upgrade head
```

### 2. Frontend Development
```bash
# 1. Make changes to frontend/src/*.tsx files
# 2. Frontend auto-reloads in browser

# 3. If you add new dependencies:
docker-compose exec web npm install package-name

# 4. Rebuild if needed:
docker-compose up -d --build web
```

### 3. Database Schema Changes
```bash
# 1. Update SQLAlchemy models in backend/app/models/
# 2. Generate migration
docker-compose exec api alembic revision --autogenerate -m "Add column"

# 3. Review migration in backend/alembic/versions/
# 4. Apply migration
docker-compose exec api alembic upgrade head

# 5. Verify in database
docker-compose exec db psql -U postgres -d anditms -c "\d table_name"
```

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:dev@db:5432/anditms

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=dev-secret-key-change-in-production
JWT_ALGORITHM=HS256

# AWS (for local dev, use localstack or mock)
AWS_REGION=us-east-1
S3_BUCKET=andi-tms-dev-documents
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Application
ENV=development
DEBUG=true
PORT=8000

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=development
```

## Testing the Health Endpoint

The `/health` endpoint is critical for AWS ALB health checks. Test it:

```bash
# Basic health check
curl http://localhost:8000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-01-05T...",
#   "service": "andi-tms-api",
#   "version": "1.0.0",
#   "python_version": "3.11.x"
# }

# Test readiness
curl http://localhost:8000/health/ready

# Test liveness
curl http://localhost:8000/health/live
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :8000
lsof -i :3000
lsof -i :5432

# Kill process
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check if database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db

# Wait for database to be ready
docker-compose exec db pg_isready -U postgres
```

### API Container Keeps Restarting
```bash
# Check logs
docker-compose logs api

# Common issues:
# 1. Database not ready - wait and restart
# 2. Missing dependencies - rebuild
docker-compose up -d --build api

# 3. Code syntax error - check logs
```

### Frontend Not Loading
```bash
# Check logs
docker-compose logs web

# Rebuild node_modules
docker-compose down
docker-compose up -d --build web

# Check if API is accessible
curl http://localhost:8000/health
```

### Cannot Connect to Database from Host
```bash
# Database is exposed on localhost:5432
psql -h localhost -U postgres -d anditms
# Password: dev

# If still fails, check port mapping
docker-compose ps
```

### PostGIS Not Working
```bash
# Enable PostGIS extension
docker-compose exec db psql -U postgres -d anditms -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify installation
docker-compose exec db psql -U postgres -d anditms -c "\dx"
```

## Performance Tips

### Speed Up Docker Build
```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker-compose build

# Use build cache
docker-compose build --no-cache  # Only when needed
```

### Reduce Log Noise
```bash
# View logs without timestamps
docker-compose logs --no-log-prefix -f api

# Filter logs
docker-compose logs -f api | grep ERROR
```

### Use Docker Compose Profiles (Optional)
Add to docker-compose.yml:
```yaml
services:
  web:
    profiles: ["frontend"]
```

Then run:
```bash
# Run only backend services
docker-compose up -d db redis api

# Run everything including frontend
docker-compose --profile frontend up -d
```

## Production Differences

| Feature | Local Dev | Production |
|---------|-----------|------------|
| Database | PostgreSQL in Docker | AWS RDS |
| Redis | Redis in Docker | AWS ElastiCache |
| Secrets | .env file | AWS Secrets Manager |
| File Storage | Local filesystem | AWS S3 |
| Container | docker-compose | AWS ECS Fargate |
| Load Balancer | None | AWS ALB |
| HTTPS | No | Yes (ACM certificate) |
| Auto-scaling | No | Yes (ECS) |

## Next Steps

### Create Demo Data
```bash
# Create demo users, trucks, loads, etc.
docker-compose exec api python -m app.scripts.seed_data
```

### Run Tests
```bash
# Unit tests
docker-compose exec api pytest tests/unit

# Integration tests
docker-compose exec api pytest tests/integration
```

### Access Database CLI
```bash
# PostgreSQL CLI
docker-compose exec db psql -U postgres -d anditms

# Common queries:
# \dt              - List tables
# \d table_name    - Describe table
# \dx              - List extensions
# SELECT version(); - PostgreSQL version
```

### Monitor Resources
```bash
# View resource usage
docker stats

# View disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Stop and Cleanup

```bash
# Stop services (keeps data)
docker-compose down

# Stop and remove volumes (⚠ destroys data)
docker-compose down -v

# Remove all images
docker-compose down --rmi all
```

---

**Happy Coding! 🚀**

For production deployment, see:
- [README_DEPLOY.md](./README_DEPLOY.md) - AWS deployment
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Fast deployment
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) - Architecture details

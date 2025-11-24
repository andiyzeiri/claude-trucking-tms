#!/bin/bash
export DATABASE_URL="postgresql+asyncpg://anditms:AndiTMS2024Pass@andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/anditms"
echo "Running Alembic migrations against production..."
alembic upgrade head

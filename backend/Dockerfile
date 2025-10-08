FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Check for Poetry or requirements.txt and install dependencies accordingly
COPY pyproject.toml poetry.loc[k] requirements.tx[t] ./

# Install Poetry if pyproject.toml exists
RUN if [ -f "pyproject.toml" ]; then \
        pip install --no-cache-dir poetry && \
        poetry config virtualenvs.create false && \
        poetry install --no-interaction --no-ansi --no-root --only main; \
    elif [ -f "requirements.txt" ]; then \
        pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy Alembic configuration
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Copy database management scripts
COPY full-db-reset.py ./
COPY check-db-state.py ./
COPY run-migration-sql.py ./
COPY migration.sql ./

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Health check for ALB
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

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
COPY migrate.py ./
COPY init_schema.py ./
COPY fix_users_table.py ./
COPY create_initial_user.py ./
COPY reset_user_password.py ./
COPY schema.sql ./
COPY remove_unique_constraint.py ./
COPY update_status_enum.py ./
COPY cleanup_old_statuses.py ./
COPY run_carrier_rate_migration.py ./
COPY create_driver_payroll_settings.sql ./
COPY run_driver_settings_migration.py ./
COPY fix_missing_tables.py ./
COPY fix_fuel_def_columns.py ./
COPY stamp_alembic.py ./
COPY fix_enum_types.py ./
COPY fix_trucks_table.py ./
COPY fix_drivers_columns.py ./
COPY add_fuel_card_columns.py ./
COPY add_driver_type_column.py ./
COPY create_dedicated_lanes_table.py ./
COPY create_ifta_table.py ./
COPY add_ifta_permission.py ./
COPY add_adjustment_columns.py ./
COPY create_driver_days_off_table.py ./
COPY add_needs_attention_column.py ./
COPY create_driver_attention_days_table.py ./
COPY create_driver_day_notes_table.py ./
COPY add_expense_cost_type.py ./
COPY create_payroll_table.py ./
COPY create_payroll_overrides_table.py ./
COPY add_truck_to_payroll_settings.py ./
COPY add_pay_type_columns.py ./
COPY add_recurring_expense_columns.py ./
COPY add_expense_group_column.py ./
COPY entrypoint.sh ./

# Copy scripts directory
COPY scripts/ ./scripts/

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Health check for ALB
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Run the application via entrypoint
CMD ["./entrypoint.sh"]

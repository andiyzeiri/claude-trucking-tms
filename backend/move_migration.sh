#!/bin/bash
# Script to move the migration file to the alembic versions directory
# Run this with sudo if needed: sudo bash move_migration.sh

mv /home/andi/claude-trucking-tms/backend/4a8c15df9b21_add_driver_additional_fields.py \
   /home/andi/claude-trucking-tms/backend/alembic/versions/4a8c15df9b21_add_driver_additional_fields.py

echo "Migration file moved successfully!"
echo "Now you can run: alembic upgrade head"

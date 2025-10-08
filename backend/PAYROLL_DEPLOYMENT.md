# Payroll Feature Deployment Guide

This guide will help you deploy the payroll feature to your remote backend server.

## What's Being Deployed

**New Features:**
- Payroll endpoints (GET, POST, PUT, DELETE)
- Added "extra" field to payroll for additional compensation
- All fields: week, driver, gross, extra, dispatch fee, insurance, fuel, parking, trailer, misc, miles, pay

**Files Updated:**
- `app/models/payroll.py` - Added "extra" field
- `app/schemas/payroll.py` - Added "extra" field to schemas
- `app/api/v1/endpoints/payroll.py` - Payroll CRUD endpoints
- `app/api/v1/api.py` - Already registered

## Deployment Steps

### Step 1: Upload Files to Server

From your local machine, upload the deployment package:

```bash
# Upload the updated files
scp -i ~/.ssh/absolute-tms-key.pem payroll-deployment.tar.gz ubuntu@18.212.79.137:/tmp/

# Or if you don't have the SSH key, use AWS Console's EC2 Instance Connect
```

### Step 2: SSH into the Server

```bash
ssh -i ~/.ssh/absolute-tms-key.pem ubuntu@18.212.79.137

# Or use AWS Console → EC2 → Connect → EC2 Instance Connect
```

### Step 3: Find Backend Directory

```bash
# Find where the backend is running
ps aux | grep uvicorn | grep -v grep

# Common locations:
cd /home/ubuntu/claude-trucking-tms/backend
# or
cd /opt/tms/backend
```

### Step 4: Backup Current Files (Recommended)

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz app/models/payroll.py app/schemas/payroll.py app/api/v1/endpoints/payroll.py
```

### Step 5: Extract and Deploy Files

```bash
# Extract the deployment package
cd /path/to/backend  # Replace with actual backend path
tar -xzf /tmp/payroll-deployment.tar.gz

# Verify files were updated
ls -la app/models/payroll.py
ls -la app/schemas/payroll.py
ls -la app/api/v1/endpoints/payroll.py
```

### Step 6: Add "extra" Column to Database

```bash
# Connect to PostgreSQL and add the extra column
# First, find your database connection details
cat .env | grep DATABASE

# Then connect and run:
psql -U <db_user> -d <db_name> -h <db_host> -c "ALTER TABLE payroll ADD COLUMN IF NOT EXISTS extra DOUBLE PRECISION DEFAULT 0.0;"

# If payroll table doesn't exist, create it:
# (Run this from backend directory)
python3 << 'EOF'
from app.database import engine
from app.models.base import Base
from app.models.payroll import Payroll
import asyncio

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Payroll table created successfully')

asyncio.run(create_tables())
EOF
```

### Step 7: Restart Backend

```bash
# Find how backend is running and restart accordingly:

# If using systemd:
sudo systemctl restart tms-backend

# If using PM2:
pm2 restart tms-backend

# If running manually:
# Kill the process
ps aux | grep uvicorn | grep -v grep | awk '{print $2}' | xargs kill

# Start it again
cd /path/to/backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

### Step 8: Verify Deployment

Test the payroll endpoints:

```bash
# From the server:
curl http://localhost:8000/api/v1/payroll

# From your local machine:
curl http://18.212.79.137:8000/api/v1/payroll
```

You should see an empty array `[]` if no payroll entries exist, or a 401 if authentication is required (which is correct).

### Step 9: Check Application Logs

```bash
# If using systemd:
sudo journalctl -u tms-backend -f

# If using PM2:
pm2 logs tms-backend

# If running manually, check nohup.out or the terminal
```

## Troubleshooting

### Backend Won't Start

Check Python syntax errors:
```bash
cd /path/to/backend
python3 -m py_compile app/models/payroll.py
python3 -m py_compile app/schemas/payroll.py
python3 -m py_compile app/api/v1/endpoints/payroll.py
```

### Database Connection Issues

Verify database credentials in `.env` file and ensure PostgreSQL is running.

### Still Getting 404

Make sure the backend actually restarted:
```bash
ps aux | grep uvicorn
# Check the start time of the process
```

## Quick Deploy Commands (All-in-One)

If you're confident, run this on the server:

```bash
# Navigate to backend directory
cd /home/ubuntu/claude-trucking-tms/backend

# Extract files
tar -xzf /tmp/payroll-deployment.tar.gz

# Add database column
psql $DATABASE_URL -c "ALTER TABLE payroll ADD COLUMN IF NOT EXISTS extra DOUBLE PRECISION DEFAULT 0.0;"

# Restart backend (adjust command based on your setup)
sudo systemctl restart tms-backend
# OR
pm2 restart tms-backend

# Verify
curl http://localhost:8000/api/v1/payroll
```

## Success!

Once deployed, your payroll page at http://localhost:3000/payroll should work with all the fields you requested.

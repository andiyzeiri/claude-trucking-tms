# Simple Fix: How to Deploy Backend

## The Problem
Your frontend calls `/v1/auth/register` but your backend at `18.212.79.137` doesn't have this endpoint yet.

## The Simplest Solution (5 minutes)

You need to access the server at `18.212.79.137` and update the backend code. Here's how:

### Step 1: Get Access to 18.212.79.137

Go to AWS Console: https://console.aws.amazon.com/ec2/

1. Click on "Instances" in left sidebar
2. Find instance `i-0fa8ee7ff4afed4a4` (IP: 18.212.79.137)
3. Select it and click **"Connect"** button at the top
4. Choose **"EC2 Instance Connect"** tab
5. Click **"Connect"** - this opens a terminal in your browser (no SSH key needed!)

### Step 2: Find Where Backend Is Located

Once in the terminal, find the backend:

```bash
# Try common locations
ls -la /home/ubuntu/
ls -la /opt/
ls -la /var/www/

# Or search for it
sudo find / -name "main.py" -path "*/app/*" 2>/dev/null | grep -v node_modules

# Check what's running
ps aux | grep uvicorn
```

Let's say it's at `/home/ubuntu/tms/backend` (adjust path as needed)

### Step 3: Update the Code

```bash
cd /home/ubuntu/tms/backend  # or wherever you found it

# If it's a git repo, just pull:
git pull origin main

# Or manually copy the files (I'll create a script for this)
```

### Step 4: Restart the Backend

```bash
# Find how it's running:
sudo systemctl status tms*  # Check if it's a service
pm2 list  # Check if it's PM2
ps aux | grep uvicorn  # Check the process

# Restart based on what you find:
sudo systemctl restart tms-backend  # If it's a service
# OR
pm2 restart tms-backend  # If it's PM2
# OR kill and restart manually
```

### Step 5: Test It Works

```bash
# From the terminal on the server:
curl http://localhost:8000/api/v1/auth/register -X POST -H "Content-Type: application/json" -d '{}'

# Should return validation error (not 404)
```

## Alternative: Upload Files Manually

I've prepared the updated backend files. If git isn't set up on the server:

1. Download this entire folder: `/home/andi/claude-trucking-tms/backend/`
2. Use FileZilla or WinSCP to upload to the server
3. Or use the AWS Console to upload files

## Files That Need Updating

These are the NEW/MODIFIED files:

```
backend/
├── app/
│   ├── api/v1/endpoints/
│   │   ├── auth.py          ← MODIFIED (new endpoints)
│   │   ├── users.py         ← MODIFIED
│   │   └── companies.py     ← MODIFIED
│   ├── models/
│   │   ├── email_verification.py  ← NEW FILE
│   │   └── user.py          ← MODIFIED
│   ├── schemas/
│   │   └── auth.py          ← NEW FILE
│   ├── services/
│   │   └── email.py         ← NEW FILE
│   └── core/
│       └── security.py      ← MODIFIED
```

## Quick Test Commands

After deploying, test from your computer:

```bash
# Test register (should get validation error, not 404)
curl http://18.212.79.137:8000/api/v1/auth/register -X POST

# Test login (should get validation error, not 404)
curl http://18.212.79.137:8000/api/v1/auth/login-json -X POST

# Both returning 404 = not deployed yet
# Both returning 422 (validation error) = SUCCESS! ✅
```

## Need Help?

The backend code is ready at `/home/andi/claude-trucking-tms/backend/` on your local machine.

Just need to:
1. Access the server (via EC2 Instance Connect in AWS Console)
2. Find where backend lives
3. Copy the new files
4. Restart the service

That's it!

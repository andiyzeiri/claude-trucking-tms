# Commands to Run on EC2 Server

You're now connected! Run these commands one by one:

## Step 1: Find where the backend is located

```bash
# Check common locations
ls -la /home/ubuntu/ 2>/dev/null || ls -la /home/ec2-user/ || ls -la /opt/ || ls -la /var/www/

# Search for the backend
sudo find / -name "main.py" -path "*/app/*" 2>/dev/null | grep -v node_modules | head -5

# Check what process is running
ps aux | grep -E 'uvicorn|python.*main|fastapi' | grep -v grep
```

## Step 2: Check if it's a git repository

```bash
# Once you find the backend location (let's say it's /path/to/backend)
cd /path/to/backend  # Replace with actual path
git status
```

## Step 3: Update the code

**If it's a git repo:**
```bash
git pull origin main
pip install -r requirements.txt  # Install any new dependencies
```

**If it's NOT a git repo:**
You'll need to manually upload the files. For now, let's see what we're working with.

## Step 4: Restart the backend

```bash
# Try to find how it's running:
sudo systemctl list-units | grep tms
pm2 list
ps aux | grep uvicorn

# Restart based on what you find:
sudo systemctl restart tms-backend  # If it's a systemd service
# OR
pm2 restart tms-backend  # If it's PM2
# OR
# Kill and restart manually (get PID from ps aux | grep uvicorn)
sudo kill -9 <PID>
cd /path/to/backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

## Step 5: Test the endpoints

```bash
# Test that new endpoints exist (should return validation error, not 404)
curl http://localhost:8000/api/v1/auth/register -X POST -H "Content-Type: application/json" -d '{}'

curl http://localhost:8000/api/v1/auth/login-json -X POST -H "Content-Type: application/json" -d '{}'
```

---

## Start Here:

Just copy and paste this into your terminal to start:

```bash
echo "=== Finding backend location ===" && \
ps aux | grep uvicorn | grep -v grep && \
echo "" && \
echo "=== Checking home directory ===" && \
ls -la ~/ | grep -E 'backend|tms|app'
```

This will show you where the backend is running!

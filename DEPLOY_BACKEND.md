# Backend Deployment Guide

## Option 1: Manual SSH Deployment (Recommended)

### Step 1: Connect to EC2
```bash
# You'll need to use AWS Console or your terminal
ssh -i ~/.ssh/absolute-tms-key.pem ubuntu@18.212.79.137

# If the key doesn't work, you may need to:
# 1. Go to AWS EC2 Console
# 2. Find your instance (18.212.79.137)
# 3. Click "Connect" button
# 4. Use EC2 Instance Connect (browser-based SSH)
```

### Step 2: Update the Backend Code
Once connected to EC2, run these commands:

```bash
# Navigate to backend directory
cd /home/ubuntu/claude-trucking-tms/backend  # or wherever your backend is located

# Pull latest changes from git
git pull origin main

# Or if backend isn't in git on the server, you'll need to copy files
# (see Option 2 below)

# Install any new dependencies
pip install -r requirements.txt

# Check if there are any new database migrations needed
# (If you're using Alembic)
# alembic upgrade head
```

### Step 3: Restart the Backend Service

Find what's running the backend:
```bash
# Check if it's running as a systemd service
sudo systemctl status tms-backend
# If found, restart it:
sudo systemctl restart tms-backend

# OR check if it's running with PM2
pm2 list
# If found, restart it:
pm2 restart tms-backend

# OR check if it's a screen/tmux session
screen -ls
# Reattach and restart

# OR find the process and kill it
ps aux | grep uvicorn
# Kill the process ID
kill -9 <PID>
# Then start it again
cd /home/ubuntu/claude-trucking-tms/backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

### Step 4: Verify Deployment
```bash
# Test the new endpoint
curl http://localhost:8000/api/v1/auth/register -X POST -H "Content-Type: application/json" -d '{"test":"data"}'

# Should return validation error (not 404)
```

---

## Option 2: Deploy via SCP (If Git Not Set Up)

### From your local machine:

```bash
# Copy the entire backend directory to EC2
scp -i ~/.ssh/absolute-tms-key.pem -r /home/andi/claude-trucking-tms/backend ubuntu@18.212.79.137:/home/ubuntu/claude-trucking-tms/

# Then SSH in and restart (see Step 3 above)
```

---

## Option 3: Use AWS Systems Manager (No SSH Key Needed)

1. Go to AWS Console → Systems Manager → Session Manager
2. Find your EC2 instance
3. Click "Start Session"
4. Run the commands from Step 2 and Step 3 above

---

## Troubleshooting

### If you can't SSH:
- Check if the EC2 instance security group allows SSH (port 22) from your IP
- Verify the SSH key is correct in AWS EC2 Console → Key Pairs
- Try using AWS Console's "Connect" button for browser-based access

### If the backend won't start:
- Check logs: `journalctl -u tms-backend -f` (for systemd)
- Check logs: `pm2 logs tms-backend` (for PM2)
- Check Python errors: Run manually to see errors
  ```bash
  cd /home/ubuntu/claude-trucking-tms/backend
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

### Database issues:
- Make sure PostgreSQL is running: `sudo systemctl status postgresql`
- Check database connection in backend logs
- Verify DATABASE_URL in .env file

---

## Quick Test Commands

After deployment, test from your local machine:

```bash
# Test health endpoint
curl http://18.212.79.137:8000/health

# Test register endpoint exists (should return validation error, not 404)
curl http://18.212.79.137:8000/api/v1/auth/register -X POST -H "Content-Type: application/json" -d '{}'

# Test login endpoint
curl http://18.212.79.137:8000/api/v1/auth/login-json -X POST -H "Content-Type: application/json" -d '{"username_or_email":"test","password":"test"}'
```

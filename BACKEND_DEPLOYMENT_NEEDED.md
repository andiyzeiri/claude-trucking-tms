# Backend Deployment Required

## Problem
The frontend is now configured to use real authentication endpoints (`/v1/auth/register` and `/v1/auth/login-json`), but these endpoints don't exist on your production backend server yet.

## Current Status
- **Frontend**: Updated and deployed ✅
- **Backend Code**: Updated locally ✅
- **Backend Deployment**: NOT deployed to production ❌

## Production Backend Location
- **Server**: `18.212.79.137` (us-east-1)
- **Instance ID**: `i-0fa8ee7ff4afed4a4`
- **SSH Key**: `key-0a44e1f7deb8b16f9` (you don't have this key locally)

## What Needs to be Deployed
The following backend files need to be updated on the production server:

### New/Modified Files:
1. `/backend/app/api/v1/endpoints/auth.py` - Contains new endpoints:
   - `POST /api/v1/auth/register` - Company registration with email verification
   - `POST /api/v1/auth/login-json` - JSON login endpoint
   - `POST /api/v1/auth/verify-email` - Email verification
   - `POST /api/v1/auth/resend-verification` - Resend verification email

2. `/backend/app/models/email_verification.py` - NEW FILE for email tokens

3. `/backend/app/schemas/auth.py` - NEW FILE with auth request/response schemas

4. `/backend/app/services/email.py` - NEW FILE for sending emails

5. `/backend/app/core/security.py` - Updated to support username OR email login

6. `/backend/app/api/v1/endpoints/users.py` - Updated user management endpoints

7. `/backend/app/api/v1/endpoints/companies.py` - Updated company management

## How to Deploy (3 Options)

### Option 1: AWS Console (Easiest - No SSH Key Needed)
1. Go to AWS EC2 Console: https://console.aws.amazon.com/ec2/
2. Find instance `i-0fa8ee7ff4afed4a4` (18.212.79.137)
3. Click "Connect" → "EC2 Instance Connect" (browser-based terminal)
4. Once connected, run:
```bash
cd /path/to/backend  # Find where backend is deployed
git pull origin main  # Pull latest code (if backend is in git)
# OR manually upload files
pip install -r requirements.txt  # Install any new dependencies
sudo systemctl restart tms-backend  # Restart the service
```

### Option 2: Download the Correct SSH Key
1. Go to AWS EC2 Console → Key Pairs
2. You'll see you can't download `key-0a44e1f7deb8b16f9` (AWS doesn't allow re-downloading)
3. You have two options:
   a. Create a new key pair and update the instance to use it
   b. Use AWS Systems Manager Session Manager (no SSH key required)

### Option 3: Use Session Manager (No SSH Key Needed)
1. Make sure SSM Agent is installed on the instance
2. Enable Session Manager in IAM for the instance
3. Use AWS CLI:
```bash
aws ssm start-session --target i-0fa8ee7ff4afed4a4 --region us-east-1
```

## Quick Fix: Upload via SCP from Accessible Server
Since you CAN access `3.21.76.120` (us-east-2), you could:
1. Upload backend files there (already done ✅)
2. From that server, SCP to `18.212.79.137` if networking allows
3. Or just run the new backend on `3.21.76.120` and update frontend to use it

## Testing After Deployment
Once deployed, test that endpoints work:

```bash
# Test registration endpoint (should return validation error, not 404)
curl -X POST http://18.212.79.137:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{}'

# Test login endpoint (should return validation error, not 404)
curl -X POST http://18.212.79.137:8000/api/v1/auth/login-json \
  -H "Content-Type: application/json" \
  -d '{"username_or_email":"test","password":"test"}'
```

Both should return validation errors (400) instead of 404 Not Found.

## Alternative Solution
If you can't deploy to `18.212.79.137`, we can:
1. Set up the backend on `3.21.76.120` (us-east-2) instead
2. Update frontend `.env.local` to use `http://3.21.76.120:8000/api`
3. Update security group on `3.21.76.120` to allow port 8000 from internet
4. Deploy and use that server as your production backend

## Next Steps
1. Choose one of the deployment options above
2. Deploy the updated backend code
3. Restart the backend service
4. Test the endpoints
5. Try registering a new account on the frontend

---

**Files are ready in `/home/andi/claude-trucking-tms/backend/` - just need to copy them to production!**

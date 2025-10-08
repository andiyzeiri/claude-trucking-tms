#!/bin/bash

# Simple Backend Deployment Script
# This uploads the backend to the EC2 server you have access to

set -e

echo "🚀 Deploying Claude TMS Backend..."

# Create a tarball of the backend
cd /home/andi/claude-trucking-tms
tar -czf backend-deploy.tar.gz backend/

echo "📦 Created deployment package"

# Upload to the EC2 server you have access to
scp -i ~/.ssh/absolute-tms-key.pem backend-deploy.tar.gz ec2-user@ec2-3-21-76-120.us-east-2.compute.amazonaws.com:/home/ec2-user/

echo "📤 Uploaded to EC2"

# Instructions for manual deployment
echo ""
echo "✅ Backend code uploaded successfully!"
echo ""
echo "⚠️  IMPORTANT: The backend is running on a DIFFERENT server (18.212.79.137)"
echo "You need to either:"
echo "1. Find the SSH key for that server and deploy there"
echo "2. Or update your frontend .env.local to point to: http://3.21.76.120:8000/api"
echo "   and deploy the backend on the server you have access to"
echo ""
echo "For now, let's deploy to the server you CAN access (3.21.76.120):"
echo ""
echo "Run these commands to complete deployment on 3.21.76.120:"
echo ""
echo "ssh -i ~/.ssh/absolute-tms-key.pem ec2-user@ec2-3-21-76-120.us-east-2.compute.amazonaws.com"
echo "tar -xzf backend-deploy.tar.gz"
echo "cd backend"
echo "# Install dependencies (if not already installed):"
echo "python3 -m pip install -r requirements.txt"
echo "# Run the backend:"
echo "nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &"

rm backend-deploy.tar.gz

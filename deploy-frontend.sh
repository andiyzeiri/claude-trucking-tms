#!/bin/bash
set -e

echo "=== Deploying Frontend with Favicon Fix ==="

# Set paths and AWS credentials
export AWS_CONFIG_FILE=/home/andi/.aws/config
export AWS_SHARED_CREDENTIALS_FILE=/home/andi/.aws/credentials
export PATH=$PATH:/home/andi/.local/bin
DOCKER=/usr/bin/docker
AWS=/home/andi/.local/bin/aws
ECR_REPO="337756366856.dkr.ecr.us-east-1.amazonaws.com/trucking-tms-frontend"

cd /home/andi/claude-trucking-tms/frontend

echo "Step 1: Authenticating to ECR..."
$AWS ecr get-login-password --region us-east-1 | $DOCKER login --username AWS --password-stdin 337756366856.dkr.ecr.us-east-1.amazonaws.com

echo "Step 2: Building Docker image..."
$DOCKER build -t trucking-tms-frontend:latest .

echo "Step 3: Tagging image..."
$DOCKER tag trucking-tms-frontend:latest $ECR_REPO:latest

echo "Step 4: Pushing to ECR..."
$DOCKER push $ECR_REPO:latest

echo "Step 5: Forcing ECS service update..."
$AWS ecs update-service \
  --cluster trucking-tms-cluster \
  --service trucking-tms-frontend-service \
  --force-new-deployment \
  --region us-east-1

echo ""
echo "=== Deployment Complete! ==="
echo "The frontend will be updated in ~2-3 minutes."
echo "Check status: $AWS ecs describe-services --cluster trucking-tms-cluster --services trucking-tms-frontend-service --region us-east-1"

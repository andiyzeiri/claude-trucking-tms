#!/bin/bash

# Trucking TMS - Complete Remaining AWS Deployment
# This script completes the deployment after RDS, S3, and ECR are set up

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AWS Deployment - Remaining Steps${NC}"

# Environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=337756366856
export PROJECT_NAME=trucking-tms
export VPC_ID=vpc-066bbbda6d37d369b
export DB_ENDPOINT=trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com
export DB_PASSWORD="VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM="
export S3_BUCKET=trucking-tms-uploads-1759878269
export ECR_REPO=337756366856.dkr.ecr.us-east-1.amazonaws.com/trucking-tms-backend
export SUBNET_IDS="subnet-0b9872bc21a6cbc22,subnet-045821ceb6cce40c6,subnet-0fd8a478f6c162cbc,subnet-0b8712e6689d7369e,subnet-0e0520042e0dd6f83,subnet-0474942b14c4fd213"

echo -e "${YELLOW}Step 1: Creating ECS Cluster${NC}"
aws ecs create-cluster \
  --cluster-name $PROJECT_NAME-cluster \
  --region $AWS_REGION || echo "Cluster may already exist"

echo -e "${YELLOW}Step 2: Creating Task Execution Role${NC}"
cat > /tmp/task-execution-role-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ${PROJECT_NAME}-task-execution-role \
  --assume-role-policy-document file:///tmp/task-execution-role-trust-policy.json || echo "Role may already exist"

aws iam attach-role-policy \
  --role-name ${PROJECT_NAME}-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || true

aws iam attach-role-policy \
  --role-name ${PROJECT_NAME}-task-execution-role \
  --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/trucking-tms-s3-policy || true

export TASK_ROLE_ARN=$(aws iam get-role \
  --role-name ${PROJECT_NAME}-task-execution-role \
  --query "Role.Arn" --output text)

echo "Task Role ARN: $TASK_ROLE_ARN"

echo -e "${YELLOW}Step 3: Creating Security Groups${NC}"
# Security group for ALB
aws ec2 create-security-group \
  --group-name $PROJECT_NAME-alb-sg \
  --description "Security group for ALB" \
  --vpc-id $VPC_ID || echo "ALB SG may already exist"

export ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$PROJECT_NAME-alb-sg" \
  --query "SecurityGroups[0].GroupId" --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 || true

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 || true

# Security group for ECS tasks
aws ec2 create-security-group \
  --group-name $PROJECT_NAME-ecs-sg \
  --description "Security group for ECS tasks" \
  --vpc-id $VPC_ID || echo "ECS SG may already exist"

export ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$PROJECT_NAME-ecs-sg" \
  --query "SecurityGroups[0].GroupId" --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp \
  --port 8000 \
  --source-group $ALB_SG_ID || true

# Update DB security group
export DB_SG_ID=sg-078108dc9a9dfcd9e
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG_ID || true

echo -e "${YELLOW}Step 4: Creating Application Load Balancer${NC}"
aws elbv2 create-load-balancer \
  --name $PROJECT_NAME-alb \
  --subnets $(echo $SUBNET_IDS | tr ',' ' ') \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing \
  --type application || echo "ALB may already exist"

export ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names $PROJECT_NAME-alb \
  --query "LoadBalancers[0].LoadBalancerArn" --output text)

export ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names $PROJECT_NAME-alb \
  --query "LoadBalancers[0].DNSName" --output text)

echo "ALB DNS: $ALB_DNS"

echo -e "${YELLOW}Step 5: Creating Target Group${NC}"
aws elbv2 create-target-group \
  --name $PROJECT_NAME-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 || echo "Target group may already exist"

export TG_ARN=$(aws elbv2 describe-target-groups \
  --names $PROJECT_NAME-tg \
  --query "TargetGroups[0].TargetGroupArn" --output text)

echo -e "${YELLOW}Step 6: Creating ALB Listener${NC}"
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN || echo "Listener may already exist"

echo -e "${YELLOW}Step 7: Creating ECS Task Definition${NC}"
export SECRET_KEY=$(openssl rand -hex 32)

cat > /tmp/task-definition.json <<EOF
{
  "family": "$PROJECT_NAME-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$TASK_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "$ECR_REPO:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql+asyncpg://tmsadmin:$DB_PASSWORD@$DB_ENDPOINT:5432/trucking_tms"
        },
        {
          "name": "AWS_REGION",
          "value": "$AWS_REGION"
        },
        {
          "name": "S3_BUCKET",
          "value": "$S3_BUCKET"
        },
        {
          "name": "USE_S3",
          "value": "true"
        },
        {
          "name": "SECRET_KEY",
          "value": "$SECRET_KEY"
        },
        {
          "name": "ENV",
          "value": "production"
        },
        {
          "name": "CORS_ORIGINS",
          "value": "http://$ALB_DNS,https://$ALB_DNS"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$PROJECT_NAME-backend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
EOF

aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-definition.json

echo -e "${YELLOW}Step 8: Creating ECS Service${NC}"
aws ecs create-service \
  --cluster $PROJECT_NAME-cluster \
  --service-name $PROJECT_NAME-backend-service \
  --task-definition $PROJECT_NAME-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=backend,containerPort=8000" || echo "Service may already exist"

echo -e "${YELLOW}Step 9: Waiting for service to stabilize (this may take 5-10 minutes)${NC}"
aws ecs wait services-stable \
  --cluster $PROJECT_NAME-cluster \
  --services $PROJECT_NAME-backend-service

echo -e "${GREEN}Backend deployment complete!${NC}"
echo -e "${GREEN}Backend URL: http://$ALB_DNS/api${NC}"
echo -e "${GREEN}Health Check: http://$ALB_DNS/health${NC}"

# Save deployment info
cat > /tmp/deployment-info.txt <<EOF
Backend Deployment Complete!

Backend API URL: http://$ALB_DNS/api
Health Check: http://$ALB_DNS/health

Database: $DB_ENDPOINT
S3 Bucket: $S3_BUCKET
ECR Repository: $ECR_REPO

Next Steps:
1. Run database migrations
2. Deploy frontend
3. Test the application

To run migrations:
aws ecs run-task \\
  --cluster $PROJECT_NAME-cluster \\
  --task-definition $PROJECT_NAME-backend \\
  --launch-type FARGATE \\
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \\
  --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}'
EOF

cat /tmp/deployment-info.txt

echo -e "${GREEN}Deployment script completed!${NC}"

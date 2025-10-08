#!/bin/bash
# This script creates a task definition with CloudWatch logs enabled

echo "Registering task definition with CloudWatch logs..."

aws ecs register-task-definition --region us-east-1 --cli-input-json '{
  "family": "trucking-tms-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::337756366856:role/trucking-tms-task-execution-role",
  "taskRoleArn": "arn:aws:iam::337756366856:role/trucking-tms-task-execution-role",
  "containerDefinitions": [{
    "name": "backend",
    "image": "337756366856.dkr.ecr.us-east-1.amazonaws.com/trucking-tms-backend:latest",
    "essential": true,
    "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
    "environment": [
      {"name": "DATABASE_URL", "value": "postgresql+asyncpg://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"},
      {"name": "AWS_REGION", "value": "us-east-1"},
      {"name": "S3_BUCKET", "value": "trucking-tms-uploads-1759878269"},
      {"name": "USE_S3", "value": "true"},
      {"name": "SECRET_KEY", "value": "8bc0e7dd5c22420472d2f12a4cb890c9117ca97fc6eedc0645c1821f0eb29be6"},
      {"name": "ENV", "value": "production"},
      {"name": "CORS_ORIGINS", "value": "http://trucking-tms-alb-1848896522.us-east-1.elb.amazonaws.com,https://trucking-tms-alb-1848896522.us-east-1.elb.amazonaws.com,http://localhost:3000"},
      {"name": "REDIS_URL", "value": "redis://localhost:6379/0"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/trucking-tms-backend",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}'

echo "Updating ECS service..."
aws ecs update-service --region us-east-1 --cluster trucking-tms-cluster --service trucking-tms-backend-service --task-definition trucking-tms-backend --force-new-deployment

echo "Waiting 90 seconds for task to start..."
sleep 90

echo "Getting task ARN..."
TASK_ARN=$(aws ecs list-tasks --region us-east-1 --cluster trucking-tms-cluster --service-name trucking-tms-backend-service --desired-status RUNNING --query "taskArns[0]" --output text)

if [ "$TASK_ARN" != "None" ] && [ ! -z "$TASK_ARN" ]; then
    echo "Task ARN: $TASK_ARN"
    echo "Checking CloudWatch logs..."
    aws logs tail /ecs/trucking-tms-backend --region us-east-1 --follow
else
    echo "No running task found. Checking stopped tasks..."
    TASK_ARN=$(aws ecs list-tasks --region us-east-1 --cluster trucking-tms-cluster --desired-status STOPPED --query "taskArns[0]" --output text)
    if [ "$TASK_ARN" != "None" ] && [ ! -z "$TASK_ARN" ]; then
        echo "Stopped task ARN: $TASK_ARN"
        echo "Getting logs from stopped task..."
        aws logs tail /ecs/trucking-tms-backend --region us-east-1 --since 5m
    else
        echo "No tasks found at all."
    fi
fi

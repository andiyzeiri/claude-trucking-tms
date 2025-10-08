#!/bin/bash
echo "Enabling PostGIS extension..."

TASK_ARN=$(aws ecs run-task --region us-east-1 \
  --cluster trucking-tms-cluster \
  --task-definition trucking-tms-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0a05d8c91c4ed00f3],securityGroups=[sg-0d41cba35c3ea31b9],assignPublicIp=ENABLED}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"sh\",\"-c\",\"python -c 'import asyncio; import asyncpg; asyncio.run(asyncpg.connect(\\\"postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms\\\").execute(\\\"CREATE EXTENSION IF NOT EXISTS postgis\\\"))'\"]}]}" \
  --launch-type FARGATE \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Task ARN: $TASK_ARN"
echo "Waiting for task to complete..."
sleep 20

echo "Running migrations..."
TASK_ARN=$(aws ecs run-task --region us-east-1 \
  --cluster trucking-tms-cluster \
  --task-definition trucking-tms-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0a05d8c91c4ed00f3],securityGroups=[sg-0d41cba35c3ea31b9],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}' \
  --launch-type FARGATE \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Migration task ARN: $TASK_ARN"
echo "Waiting for migrations to complete..."
sleep 30

echo "Checking logs..."
aws logs tail /ecs/trucking-tms-backend --region us-east-1 --since 2m

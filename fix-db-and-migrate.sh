#!/bin/bash
set -e

echo "=== Step 1: Enable PostGIS Extension ==="
aws ecs run-task --region us-east-1 \
  --cluster trucking-tms-cluster \
  --task-definition trucking-tms-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0b9872bc21a6cbc22],securityGroups=[sg-0d41cba35c3ea31b9],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["psql","postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms","-c","CREATE EXTENSION IF NOT EXISTS postgis;"]}]}' \
  --launch-type FARGATE

echo "Waiting for PostGIS enablement task to complete..."
sleep 25

echo ""
echo "=== Step 2: Run Database Migrations ==="
TASK_ARN=$(aws ecs run-task --region us-east-1 \
  --cluster trucking-tms-cluster \
  --task-definition trucking-tms-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0b9872bc21a6cbc22],securityGroups=[sg-0d41cba35c3ea31b9],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}' \
  --launch-type FARGATE \
  --query 'tasks[0].taskArn' \
  --output text)

TASK_ID=$(echo $TASK_ARN | cut -d'/' -f3)
echo "Migration task ID: $TASK_ID"
echo "Waiting for migrations to complete..."
sleep 40

echo ""
echo "=== Step 3: Check Migration Logs ==="
aws logs tail /ecs/trucking-tms-backend --region us-east-1 --since 3m --format short | grep -E "(alembic|CREATE TABLE|ERROR|Traceback)" | tail -50

echo ""
echo "=== Step 4: Verify Database Tables ==="
aws ecs run-task --region us-east-1 \
  --cluster trucking-tms-cluster \
  --task-definition trucking-tms-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0b9872bc21a6cbc22],securityGroups=[sg-0d41cba35c3ea31b9],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["psql","postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms","-c","\\dt"]}]}' \
  --launch-type FARGATE

sleep 20
echo "Checking table list..."
aws logs tail /ecs/trucking-tms-backend --region us-east-1 --since 1m

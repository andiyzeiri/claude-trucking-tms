#!/bin/bash

# Database Migration Script for Claude TMS
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
AWS_REGION="us-east-1"
PROJECT_NAME="claude-tms"

echo -e "${GREEN}🗄️  Running database migrations for Claude TMS${NC}"

# Check prerequisites
if ! command -v aws >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get infrastructure outputs
echo -e "${YELLOW}Getting infrastructure information...${NC}"

cd infrastructure

if [ ! -f "terraform.tfstate" ]; then
    echo -e "${RED}❌ Terraform state not found. Please deploy infrastructure first.${NC}"
    exit 1
fi

ECS_CLUSTER=$(~/bin/terraform output -raw ecs_cluster_name 2>/dev/null || echo "")
ECS_SERVICE=$(~/bin/terraform output -raw ecs_service_name 2>/dev/null || echo "")
PRIVATE_SUBNET_IDS=$(~/bin/terraform output -raw private_subnet_ids 2>/dev/null || echo "")

cd ..

if [ -z "$ECS_CLUSTER" ] || [ -z "$ECS_SERVICE" ]; then
    echo -e "${RED}❌ Could not get ECS information from Terraform outputs${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found ECS cluster: ${ECS_CLUSTER}${NC}"
echo -e "${GREEN}✅ Found ECS service: ${ECS_SERVICE}${NC}"

# Get task definition ARN
echo -e "${YELLOW}Getting task definition...${NC}"
TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster "${ECS_CLUSTER}" \
    --services "${ECS_SERVICE}" \
    --query 'services[0].taskDefinition' \
    --output text \
    --region "${AWS_REGION}")

if [ -z "$TASK_DEF_ARN" ] || [ "$TASK_DEF_ARN" = "None" ]; then
    echo -e "${RED}❌ Could not get task definition ARN${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found task definition: ${TASK_DEF_ARN}${NC}"

# Get security group for ECS tasks
echo -e "${YELLOW}Getting security group...${NC}"
SECURITY_GROUP=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-ecs-tasks-*" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region "${AWS_REGION}")

if [ -z "$SECURITY_GROUP" ] || [ "$SECURITY_GROUP" = "None" ]; then
    echo -e "${RED}❌ Could not find ECS tasks security group${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found security group: ${SECURITY_GROUP}${NC}"

# Parse subnet IDs
SUBNETS=$(echo "$PRIVATE_SUBNET_IDS" | tr -d '[]" ' | tr ',' ' ')
if [ -z "$SUBNETS" ]; then
    echo -e "${RED}❌ Could not get subnet IDs${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found subnets: ${SUBNETS}${NC}"

# Run migration task
echo -e "${YELLOW}Starting migration task...${NC}"
TASK_ARN=$(aws ecs run-task \
    --cluster "${ECS_CLUSTER}" \
    --task-definition "${TASK_DEF_ARN}" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS// /,}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=ENABLED}" \
    --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}' \
    --query 'tasks[0].taskArn' \
    --output text \
    --region "${AWS_REGION}")

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
    echo -e "${RED}❌ Failed to start migration task${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration task started: ${TASK_ARN}${NC}"

# Wait for task to complete
echo -e "${YELLOW}Waiting for migration to complete...${NC}"
aws ecs wait tasks-stopped \
    --cluster "${ECS_CLUSTER}" \
    --tasks "${TASK_ARN}" \
    --region "${AWS_REGION}"

# Check task exit code
TASK_DETAILS=$(aws ecs describe-tasks \
    --cluster "${ECS_CLUSTER}" \
    --tasks "${TASK_ARN}" \
    --query 'tasks[0]' \
    --region "${AWS_REGION}")

EXIT_CODE=$(echo "$TASK_DETAILS" | jq -r '.containers[0].exitCode // empty')
LAST_STATUS=$(echo "$TASK_DETAILS" | jq -r '.lastStatus')

echo -e "${YELLOW}Task status: ${LAST_STATUS}${NC}"

if [ "$EXIT_CODE" = "0" ]; then
    echo -e "${GREEN}🎉 Database migration completed successfully!${NC}"
elif [ -n "$EXIT_CODE" ]; then
    echo -e "${RED}❌ Migration failed with exit code: ${EXIT_CODE}${NC}"

    # Get logs for debugging
    echo -e "${YELLOW}Fetching logs for debugging...${NC}"
    LOG_GROUP="/ecs/${PROJECT_NAME}-backend"

    # Get log stream name
    LOG_STREAM=$(aws logs describe-log-streams \
        --log-group-name "${LOG_GROUP}" \
        --order-by LastEventTime \
        --descending \
        --max-items 1 \
        --query 'logStreams[0].logStreamName' \
        --output text \
        --region "${AWS_REGION}" 2>/dev/null || echo "")

    if [ -n "$LOG_STREAM" ] && [ "$LOG_STREAM" != "None" ]; then
        echo -e "${YELLOW}Recent logs:${NC}"
        aws logs get-log-events \
            --log-group-name "${LOG_GROUP}" \
            --log-stream-name "${LOG_STREAM}" \
            --start-time $(($(date +%s) * 1000 - 300000)) \
            --query 'events[].message' \
            --output text \
            --region "${AWS_REGION}" 2>/dev/null | tail -20 || echo "Could not fetch logs"
    fi

    exit 1
else
    echo -e "${RED}❌ Migration task failed - unknown exit code${NC}"
    exit 1
fi
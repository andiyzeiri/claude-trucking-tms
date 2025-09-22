#!/bin/bash

# Claude TMS Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="claude-tms"
AWS_REGION="us-east-1"
TERRAFORM_DIR="infrastructure"

echo -e "${GREEN}🚀 Starting Claude TMS Deployment${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    if ! command_exists terraform; then
        echo -e "${RED}❌ Terraform not found. Please install Terraform first.${NC}"
        exit 1
    fi

    if ! command_exists docker; then
        echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
        exit 1
    fi

    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Prerequisites checked${NC}"
}

# Build and tag Docker images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"

    # Backend image
    echo "Building backend image..."
    docker build -t ${PROJECT_NAME}-backend:latest ./backend/

    echo -e "${GREEN}✅ Images built successfully${NC}"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}Deploying infrastructure...${NC}"

    cd ${TERRAFORM_DIR}

    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        echo -e "${RED}❌ terraform.tfvars not found. Please copy from terraform.tfvars.example and configure.${NC}"
        exit 1
    fi

    # Initialize Terraform
    echo "Initializing Terraform..."
    ~/bin/terraform init

    # Plan deployment
    echo "Planning deployment..."
    ~/bin/terraform plan -out=tfplan

    # Apply deployment
    echo "Applying deployment..."
    ~/bin/terraform apply tfplan

    # Get outputs
    ECR_REPO=$(~/bin/terraform output -raw ecr_backend_repository_url)
    ECS_CLUSTER=$(~/bin/terraform output -raw ecs_cluster_name)
    ECS_SERVICE=$(~/bin/terraform output -raw ecs_service_name)
    S3_FRONTEND_BUCKET=$(~/bin/terraform output -raw s3_frontend_bucket)

    echo -e "${GREEN}✅ Infrastructure deployed${NC}"

    cd ..
}

# Push images to ECR
push_images() {
    echo -e "${YELLOW}Pushing images to ECR...${NC}"

    # Get ECR login token
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

    # Tag and push backend image
    docker tag ${PROJECT_NAME}-backend:latest ${ECR_REPO}:latest
    docker push ${ECR_REPO}:latest

    echo -e "${GREEN}✅ Images pushed to ECR${NC}"
}

# Update ECS service
update_ecs_service() {
    echo -e "${YELLOW}Updating ECS service...${NC}"

    # Force new deployment
    aws ecs update-service \
        --cluster ${ECS_CLUSTER} \
        --service ${ECS_SERVICE} \
        --force-new-deployment \
        --region ${AWS_REGION}

    # Wait for deployment to complete
    echo "Waiting for service to stabilize..."
    aws ecs wait services-stable \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION}

    echo -e "${GREEN}✅ ECS service updated${NC}"
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"

    # Get database connection info from Terraform outputs
    cd ${TERRAFORM_DIR}
    DB_ENDPOINT=$(~/bin/terraform output -raw database_endpoint)
    cd ..

    # Run migrations in ECS task
    TASK_DEF_ARN=$(aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --query 'services[0].taskDefinition' \
        --output text \
        --region ${AWS_REGION})

    echo "Running migration task..."
    aws ecs run-task \
        --cluster ${ECS_CLUSTER} \
        --task-definition ${TASK_DEF_ARN} \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(~/bin/terraform output -raw private_subnet_ids | tr -d '[]" ' | tr ',' ' ')],securityGroups=[$(aws ec2 describe-security-groups --filters 'Name=group-name,Values=*ecs-tasks*' --query 'SecurityGroups[0].GroupId' --output text --region ${AWS_REGION})]}" \
        --overrides '{"containerOverrides":[{"name":"backend","command":["alembic","upgrade","head"]}]}' \
        --region ${AWS_REGION}

    echo -e "${GREEN}✅ Database migrations completed${NC}"
}

# Deploy frontend
deploy_frontend() {
    echo -e "${YELLOW}Deploying frontend...${NC}"

    cd frontend

    # Install dependencies and build
    npm install
    npm run build

    # Upload to S3
    aws s3 sync ./out/ s3://${S3_FRONTEND_BUCKET}/ --delete --region ${AWS_REGION}

    # Get CloudFront distribution ID
    CLOUDFRONT_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Comment=='${PROJECT_NAME}-frontend-cdn'].Id" \
        --output text --region ${AWS_REGION})

    # Invalidate CloudFront cache
    if [ ! -z "$CLOUDFRONT_ID" ]; then
        echo "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
            --distribution-id ${CLOUDFRONT_ID} \
            --paths "/*" \
            --region ${AWS_REGION}
    fi

    cd ..
    echo -e "${GREEN}✅ Frontend deployed${NC}"
}

# Show deployment info
show_deployment_info() {
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo "Deployment Information:"
    echo "======================"

    cd ${TERRAFORM_DIR}

    echo "Frontend URL: https://$(~/bin/terraform output -raw cloudfront_domain_name)"
    echo "Backend API: https://$(~/bin/terraform output -raw alb_hostname)"
    echo "ECS Cluster: $(~/bin/terraform output -raw ecs_cluster_name)"
    echo "RDS Endpoint: $(~/bin/terraform output -raw database_endpoint)"

    cd ..
}

# Main deployment flow
main() {
    case "${1:-all}" in
        "infra")
            check_prerequisites
            deploy_infrastructure
            ;;
        "app")
            check_prerequisites
            build_images
            push_images
            update_ecs_service
            run_migrations
            deploy_frontend
            ;;
        "all")
            check_prerequisites
            deploy_infrastructure
            build_images
            push_images
            update_ecs_service
            run_migrations
            deploy_frontend
            show_deployment_info
            ;;
        *)
            echo "Usage: $0 [all|infra|app]"
            echo "  all   - Deploy infrastructure and application (default)"
            echo "  infra - Deploy only infrastructure"
            echo "  app   - Deploy only application"
            exit 1
            ;;
    esac
}

main "$@"
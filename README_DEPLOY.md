# Andi's Trucking TMS - AWS Deployment Guide

Complete deployment guide for production infrastructure on AWS.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Terraform >= 1.5.0 installed
- Docker installed
- GitHub account with repository access

## AWS Setup

### 1. Create IAM User for Deployment

Create an IAM user with programmatic access and attach these policies:
- `AmazonEC2ContainerRegistryFullAccess`
- `AmazonECS_FullAccess`
- `AmazonRDSFullAccess`
- `AmazonVPCFullAccess`
- `IAMFullAccess`
- `AmazonS3FullAccess` (for Terraform state)
- `SecretsManagerReadWrite`
- `CloudWatchFullAccess`

Save the Access Key ID and Secret Access Key.

### 2. Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

Verify configuration:
```bash
aws sts get-caller-identity
```

### 3. Create S3 Bucket for Terraform State (Optional but Recommended)

```bash
aws s3api create-bucket \
  --bucket andi-tms-terraform-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket andi-tms-terraform-state \
  --versioning-configuration Status=Enabled
```

## GitHub Repository Secrets

Add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

Required secrets:
- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key

## Initial Deployment

### Step 1: Create ECR Repository and Push Initial Image

```bash
# Navigate to project root
cd /home/andi/claude-trucking-tms

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository (if not exists)
aws ecr create-repository \
  --repository-name andi-tms/prod/api \
  --region us-east-1 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Build and push initial Docker image
cd backend
docker build -t andi-tms-api .

# Tag and push
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/andi-tms/prod/api"

docker tag andi-tms-api:latest $ECR_URL:latest
docker push $ECR_URL:latest

cd ..
```

### Step 2: Initialize Terraform

```bash
cd infra

# Initialize Terraform (without remote state)
terraform init

# Or with S3 backend:
terraform init \
  -backend-config="bucket=andi-tms-terraform-state" \
  -backend-config="key=prod/terraform.tfstate" \
  -backend-config="region=us-east-1"
```

### Step 3: Review and Apply Infrastructure

```bash
# Review the plan
terraform plan

# Apply the infrastructure
terraform apply

# Type 'yes' when prompted
```

This will create:
- VPC with public/private subnets across 2 AZs
- ECR repository
- RDS PostgreSQL database
- ECS Fargate cluster and service
- Application Load Balancer
- CloudWatch logs and alarms
- Secrets Manager for database credentials

**Initial apply takes ~15-20 minutes** (mostly RDS provisioning).

### Step 4: Get Important Outputs

```bash
# Get all outputs
terraform output

# Get specific outputs
terraform output alb_dns_name
terraform output api_url
terraform output rds_secret_arn
```

Save the `api_url` output - you'll need it for Amplify.

### Step 5: Enable PostGIS Extension

Your TMS uses PostGIS for geospatial features. After RDS is provisioned, enable the extension:

```bash
# Get RDS credentials from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id andi-tms-prod/rds/credentials \
  --region us-east-1 \
  --query SecretString \
  --output text)

# Extract connection details
DB_HOST=$(echo $SECRET_JSON | jq -r '.host')
DB_USER=$(echo $SECRET_JSON | jq -r '.username')
DB_PASS=$(echo $SECRET_JSON | jq -r '.password')
DB_NAME=$(echo $SECRET_JSON | jq -r '.dbname')

# Connect to RDS and enable PostGIS (requires psql client)
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

# Verify extensions
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dx"
```

If you don't have `psql` installed locally, you can run this from an ECS task (see Step 6 for running migrations).

### Step 6: Run Database Migrations

Run Alembic migrations using ECS one-off task:

```bash
# Get cluster and task definition details
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
TASK_DEFINITION=$(terraform output -raw ecs_task_definition_arn)
PRIVATE_SUBNETS=$(terraform output -json private_subnets | jq -r '.[]' | tr '\n' ',' | sed 's/,$//')
SECURITY_GROUP=$(aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=andi-tms-prod-ecs-tasks-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

# Run migration task
aws ecs run-task \
  --cluster $CLUSTER_NAME \
  --task-definition $TASK_DEFINITION \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "api",
      "command": ["alembic", "upgrade", "head"]
    }]
  }' \
  --region us-east-1
```

Monitor task:
```bash
# Get task ARN from previous command output, then:
TASK_ARN="<task-arn>"
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASK_ARN \
  --region us-east-1
```

### Step 7: Verify API is Running

```bash
API_URL=$(terraform output -raw api_url)
curl $API_URL/health

# Should return: {"status":"healthy"} or similar
```

## Frontend Deployment with AWS Amplify

### Option 1: AWS Console (Recommended)

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect to GitHub and select your repository
4. Choose the `main` branch
5. Build settings - use the provided `amplify.yml` (see below)
6. Add environment variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `<your-api-url>` (from terraform output)
7. Deploy

### Option 2: AWS CLI

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure

# Initialize Amplify in your project
cd frontend
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

### Amplify Environment Variables

Add this to Amplify Console → App Settings → Environment variables:

```
NEXT_PUBLIC_API_URL=<your-api-url-from-terraform-output>
```

## Amplify Build Spec

Create `amplify.yml` in the root directory:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy-api.yml`) automatically:
1. Builds and pushes Docker image to ECR on push to `main`
2. Runs Terraform apply
3. Forces new ECS deployment
4. Waits for service to stabilize

**Manual trigger:**
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

## Useful Commands

### ECR Login
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com
```

### View ECS Logs
```bash
aws logs tail /ecs/andi-tms-prod-api --follow --region us-east-1
```

### Update ECS Service
```bash
aws ecs update-service \
  --cluster andi-tms-prod-cluster \
  --service andi-tms-prod-api-service \
  --force-new-deployment \
  --region us-east-1
```

### Connect to RDS
```bash
# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id andi-tms-prod/rds/credentials \
  --region us-east-1 \
  --query SecretString \
  --output text | jq -r
```

### Scale ECS Service
```bash
aws ecs update-service \
  --cluster andi-tms-prod-cluster \
  --service andi-tms-prod-api-service \
  --desired-count 2 \
  --region us-east-1
```

### View CloudWatch Alarms
```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "andi-tms-prod" \
  --region us-east-1
```

## Enable HTTPS (Optional)

### 1. Request ACM Certificate

```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Complete DNS Validation

Follow the AWS console instructions to add DNS records.

### 3. Update Terraform Variables

Edit `infra/terraform.tfvars`:
```hcl
enable_https         = true
acm_certificate_arn  = "arn:aws:acm:us-east-1:xxxx:certificate/xxxxx"
```

### 4. Apply Changes

```bash
cd infra
terraform apply
```

### 5. Update Route53 (if using custom domain)

```bash
# Create alias record pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://route53-change.json
```

## Troubleshooting

### ECS Task Fails to Start

1. Check CloudWatch logs:
```bash
aws logs tail /ecs/andi-tms-prod-api --follow
```

2. Check ECS events:
```bash
aws ecs describe-services \
  --cluster andi-tms-prod-cluster \
  --services andi-tms-prod-api-service \
  --query 'services[0].events[:5]'
```

### Database Connection Issues

1. Verify security group rules allow ECS → RDS on port 5432
2. Check RDS is in available state
3. Verify secret is properly injected to container

### Health Check Failures

1. Ensure `/health` endpoint exists in your FastAPI app
2. Check container port (8000) matches configuration
3. Verify health check path in ALB target group

## Cost Optimization

Current configuration costs approximately:
- **ECS Fargate**: ~$15/month (1 task, 0.25 vCPU, 512MB)
- **RDS db.t4g.micro**: ~$12/month
- **ElastiCache Redis cache.t4g.micro**: ~$11/month
- **ALB**: ~$16/month
- **NAT Gateway**: ~$32/month
- **S3**: ~$1-5/month (depending on storage/transfer)
- **Data Transfer**: Variable
- **Total**: ~$87-95/month

To reduce costs:
- Use RDS snapshots and stop RDS when not in use
- Remove NAT Gateway and use public subnets (less secure)
- Scale down to 0 tasks during off-hours

## Cleanup

To destroy all infrastructure:

```bash
cd infra
terraform destroy

# Type 'yes' when prompted
```

**Note**: This will delete everything including the database. Ensure you have backups if needed.

## Support

- AWS Documentation: https://docs.aws.amazon.com/
- Terraform AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- FastAPI: https://fastapi.tiangolo.com/
- Next.js: https://nextjs.org/docs

---

**Generated for Andi's Trucking TMS** | Production-ready infrastructure as code

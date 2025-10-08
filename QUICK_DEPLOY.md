# Quick Deploy Guide - Andi's Trucking TMS

Fast-track deployment for experienced AWS users.

## Prerequisites
```bash
# Install required tools
brew install awscli terraform docker  # macOS
# OR
apt install awscli terraform docker.io  # Ubuntu

aws --version  # 2.x+
terraform --version  # 1.5+
docker --version  # 20.x+
```

## AWS Setup (5 minutes)
```bash
# Configure AWS CLI
aws configure
# Region: us-east-1

# Create Terraform state bucket (optional)
aws s3api create-bucket \
  --bucket andi-tms-terraform-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket andi-tms-terraform-state \
  --versioning-configuration Status=Enabled
```

## Initial Deploy (20 minutes)

### 1. Build & Push Docker Image
```bash
cd /home/andi/claude-trucking-tms

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

# Create ECR repo
aws ecr create-repository \
  --repository-name andi-tms/prod/api \
  --region us-east-1

# Build and push
cd backend
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
docker build -t andi-tms-api .
docker tag andi-tms-api:latest $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/andi-tms/prod/api:latest
docker push $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/andi-tms/prod/api:latest
cd ..
```

### 2. Deploy Infrastructure
```bash
cd infra
terraform init
terraform apply -auto-approve
# Wait ~15-20 minutes
```

### 3. Enable PostGIS
```bash
# Get DB credentials
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id andi-tms-prod/rds/credentials \
  --region us-east-1 \
  --query SecretString --output text)

DB_HOST=$(echo $SECRET | jq -r '.host')
DB_USER=$(echo $SECRET | jq -r '.username')
DB_PASS=$(echo $SECRET | jq -r '.password')
DB_NAME=$(echo $SECRET | jq -r '.dbname')

# Enable PostGIS
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS postgis_topology;"
```

### 4. Run Migrations
```bash
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
TASK_DEF=$(terraform output -raw ecs_task_definition_arn)
SUBNETS=$(terraform output -json private_subnets | jq -r '.[]' | tr '\n' ',' | sed 's/,$//')
SG=$(aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=andi-tms-prod-ecs-tasks-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

aws ecs run-task \
  --cluster $CLUSTER_NAME \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["alembic","upgrade","head"]}]}' \
  --region us-east-1
```

### 5. Verify & Get URL
```bash
API_URL=$(terraform output -raw api_url)
echo "API URL: $API_URL"
curl $API_URL/health
```

## GitHub Actions Setup (2 minutes)

Add to GitHub repo secrets:
```
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

Push to main branch:
```bash
git add .
git commit -m "Deploy infrastructure"
git push origin main
```

## Frontend Deploy (5 minutes)

### AWS Amplify Console
1. Go to AWS Amplify Console
2. Connect GitHub repo
3. Select `main` branch
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=<api_url_from_terraform>
   ```
5. Deploy

## Essential Commands

### View Logs
```bash
aws logs tail /ecs/andi-tms-prod-api --follow
```

### Redeploy API
```bash
aws ecs update-service \
  --cluster andi-tms-prod-cluster \
  --service andi-tms-prod-api-service \
  --force-new-deployment \
  --region us-east-1
```

### Scale Up
```bash
aws ecs update-service \
  --cluster andi-tms-prod-cluster \
  --service andi-tms-prod-api-service \
  --desired-count 2 \
  --region us-east-1
```

### Get All Outputs
```bash
cd infra
terraform output
```

## Troubleshooting

### ECS Task Won't Start
```bash
# Check logs
aws logs tail /ecs/andi-tms-prod-api --follow

# Check ECS events
aws ecs describe-services \
  --cluster andi-tms-prod-cluster \
  --services andi-tms-prod-api-service \
  --query 'services[0].events[:5]'
```

### Can't Connect to RDS
```bash
# Test from ECS task
aws ecs execute-command \
  --cluster andi-tms-prod-cluster \
  --task <task-id> \
  --container api \
  --command "psql -h $DB_HOST -U $DB_USER -d $DB_NAME" \
  --interactive
```

### Health Check Failing
```bash
# Test locally
curl -v http://<alb-dns>/health

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <tg-arn>
```

## Cleanup

```bash
cd infra
terraform destroy -auto-approve
```

## Cost

**~$92-101/month** for complete production stack

## Stack

- ✅ FastAPI + PostgreSQL (PostGIS) + Redis + S3
- ✅ ECS Fargate + ALB + RDS + ElastiCache
- ✅ CloudWatch logs + alarms
- ✅ Secrets Manager
- ✅ CI/CD with GitHub Actions

---

**Total Deploy Time**: ~30-35 minutes

For detailed documentation, see:
- [README_DEPLOY.md](./README_DEPLOY.md) - Complete guide
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) - Architecture details

# AWS Deployment Guide - TMS Application

Complete step-by-step guide to deploy your Trucking TMS to AWS.

---

## Prerequisites

- AWS Account (with payment method)
- AWS CLI installed locally
- Docker installed locally
- Domain name (optional but recommended)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Users → Route53 (DNS) → CloudFront (CDN)         │
│                              ↓                      │
│                          S3 (Frontend)             │
│                                                     │
│  Users → Route53 → ALB → ECS Fargate (Backend)    │
│                            ↓                        │
│                        RDS PostgreSQL               │
│                            ↓                        │
│                        S3 (File Uploads)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Estimated Monthly Cost: $60-80**
- RDS (db.t3.micro): ~$15
- ECS Fargate: ~$25
- S3 + CloudFront: ~$5
- ALB: ~$16
- Data Transfer: ~$5

---

## Phase 1: Set Up AWS CLI and Authentication

### Step 1.1: Install AWS CLI (if not already installed)

```bash
# On Linux/WSL
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### Step 1.2: Create IAM User with Admin Access

1. Go to AWS Console → IAM → Users
2. Click "Add User"
3. Username: `tms-deploy`
4. Access type: Check "Programmatic access"
5. Click "Next: Permissions"
6. Select "Attach existing policies directly"
7. Search and select: `AdministratorAccess`
8. Click through to create
9. **Save the Access Key ID and Secret Access Key** (you won't see them again!)

### Step 1.3: Configure AWS CLI

```bash
aws configure

# Enter when prompted:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region name: us-east-1
# Default output format: json
```

---

## Phase 2: Set Up RDS PostgreSQL Database

### Step 2.1: Create Database Security Group

```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name tms-db-sg \
  --description "Security group for TMS database" \
  --vpc-id $(aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text)

# Get the security group ID
DB_SG_ID=$(aws ec2 describe-security-groups \
  --group-names tms-db-sg \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

echo "Database Security Group ID: $DB_SG_ID"
```

### Step 2.2: Create RDS Subnet Group

```bash
# Get default subnets
SUBNET_IDS=$(aws ec2 describe-subnets \
  --query 'Subnets[*].SubnetId' \
  --output text | tr '\t' ' ')

# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name tms-db-subnet-group \
  --db-subnet-group-description "Subnet group for TMS database" \
  --subnet-ids $SUBNET_IDS
```

### Step 2.3: Create RDS PostgreSQL Instance

```bash
# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32)
echo "Database Password (SAVE THIS): $DB_PASSWORD"

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier tms-database \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username tmsadmin \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids $DB_SG_ID \
  --db-subnet-group-name tms-db-subnet-group \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --publicly-accessible \
  --enable-cloudwatch-logs-exports '["postgresql"]'

echo "Creating database... This will take 5-10 minutes"
```

### Step 2.4: Wait for Database to be Ready

```bash
# Check status (repeat until status is 'available')
aws rds describe-db-instances \
  --db-instance-identifier tms-database \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text

# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier tms-database \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "Database Endpoint: $DB_ENDPOINT"
```

### Step 2.5: Configure Database Security Group Rules

```bash
# Get your current IP
MY_IP=$(curl -s https://ifconfig.me)

# Allow PostgreSQL access from your IP (for initial setup)
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32
```

---

## Phase 3: Set Up S3 for File Uploads

### Step 3.1: Create S3 Bucket

```bash
# Create unique bucket name
BUCKET_NAME="tms-uploads-$(date +%s)"

# Create bucket
aws s3 mb s3://$BUCKET_NAME

echo "S3 Bucket: $BUCKET_NAME"
```

### Step 3.2: Configure Bucket CORS

```bash
cat > cors-config.json << 'CORSEOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
CORSEOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://cors-config.json
```

### Step 3.3: Create IAM Policy for S3 Access

```bash
cat > s3-policy.json << EOFS3
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOFS3

aws iam create-policy \
  --policy-name tms-s3-upload-policy \
  --policy-document file://s3-policy.json
```

---

## Phase 4: Prepare Backend for Deployment

### Step 4.1: Update Backend Code for S3 Uploads

Edit `/home/andi/claude-trucking-tms/backend/app/api/v1/endpoints/uploads.py`:

```python
import boto3
from botocore.exceptions import ClientError
import os

s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

S3_BUCKET = os.getenv('S3_BUCKET')

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"

    try:
        contents = await file.read()
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=f"uploads/{unique_filename}",
            Body=contents,
            ContentType='application/pdf'
        )
        
        # Generate presigned URL (valid for 7 days)
        file_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': f"uploads/{unique_filename}"},
            ExpiresIn=604800  # 7 days
        )
        
        return {
            "filename": file.filename,
            "url": file_url,
            "size": len(contents)
        }
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")
```

### Step 4.2: Update requirements.txt

```bash
cd /home/andi/claude-trucking-tms/backend

# Add boto3 if not already there
echo "boto3==1.34.0" >> requirements.txt
```

### Step 4.3: Create Production Environment Template

```bash
cat > .env.production << ENVEOF
# Database
DATABASE_URL=postgresql+asyncpg://tmsadmin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/postgres

# JWT Security
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key-here
AWS_SECRET_ACCESS_KEY=your-secret-here
S3_BUCKET=$BUCKET_NAME

# API Config
API_V1_STR=/api/v1
PROJECT_NAME=TMS Production

# Environment
ENVIRONMENT=production
DEBUG=false

# CORS
BACKEND_CORS_ORIGINS=["*"]
ENVEOF

echo "Created .env.production - UPDATE AWS CREDENTIALS!"
```

---

## Phase 5: Set Up ECR (Container Registry)

### Step 5.1: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name tms-backend \
  --region us-east-1

# Get repository URI
ECR_URI=$(aws ecr describe-repositories \
  --repository-names tms-backend \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR Repository: $ECR_URI"
```

### Step 5.2: Authenticate Docker to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI
```

### Step 5.3: Build and Push Docker Image

```bash
cd /home/andi/claude-trucking-tms/backend

# Build image
docker build -t tms-backend .

# Tag image
docker tag tms-backend:latest $ECR_URI:latest

# Push to ECR
docker push $ECR_URI:latest

echo "Image pushed to ECR!"
```

---

## Phase 6: Set Up ECS (Container Service)

### Step 6.1: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name tms-cluster \
  --region us-east-1
```

### Step 6.2: Create Task Execution Role

```bash
cat > trust-policy.json << 'EOFTRUST'
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
EOFTRUST

aws iam create-role \
  --role-name tmsEcsTaskExecutionRole \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name tmsEcsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Step 6.3: Create Security Group for ECS

```bash
# Create security group
aws ec2 create-security-group \
  --group-name tms-ecs-sg \
  --description "Security group for TMS ECS tasks"

ECS_SG_ID=$(aws ec2 describe-security-groups \
  --group-names tms-ecs-sg \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

# Allow HTTP/HTTPS from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0
```

### Step 6.4: Update Database Security Group

```bash
# Allow ECS to connect to RDS
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG_ID
```

### Step 6.5: Create Task Definition

```bash
# Get task execution role ARN
TASK_ROLE_ARN=$(aws iam get-role \
  --role-name tmsEcsTaskExecutionRole \
  --query 'Role.Arn' \
  --output text)

cat > task-definition.json << EOFTASK
{
  "family": "tms-backend-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "tms-backend",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "DATABASE_URL", "value": "postgresql+asyncpg://tmsadmin:$DB_PASSWORD@$DB_ENDPOINT:5432/postgres"},
        {"name": "SECRET_KEY", "value": "$(openssl rand -hex 32)"},
        {"name": "S3_BUCKET", "value": "$BUCKET_NAME"},
        {"name": "AWS_REGION", "value": "us-east-1"},
        {"name": "ENVIRONMENT", "value": "production"},
        {"name": "DEBUG", "value": "false"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/tms-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOFTASK

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/tms-backend

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

### Step 6.6: Create Application Load Balancer

```bash
# Get subnet IDs
SUBNET_IDS=$(aws ec2 describe-subnets \
  --query 'Subnets[*].SubnetId' \
  --output text)

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name tms-alb \
  --subnets $SUBNET_IDS \
  --security-groups $ECS_SG_ID \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "Load Balancer DNS: $ALB_DNS"

# Create target group
TG_ARN=$(aws elbv2 create-target-group \
  --name tms-backend-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $(aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text) \
  --target-type ip \
  --health-check-path /health \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

### Step 6.7: Create ECS Service

```bash
# Get subnet IDs (comma-separated for ECS service)
SUBNET_LIST=$(aws ec2 describe-subnets \
  --query 'Subnets[*].SubnetId' \
  --output text | sed 's/\t/,/g')

aws ecs create-service \
  --cluster tms-cluster \
  --service-name tms-backend-service \
  --task-definition tms-backend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=tms-backend,containerPort=8000"

echo "ECS Service created! Backend will be available at: http://$ALB_DNS"
```

---

## Phase 7: Deploy Frontend to S3 + CloudFront

### Step 7.1: Create S3 Bucket for Frontend

```bash
FRONTEND_BUCKET="tms-frontend-$(date +%s)"

aws s3 mb s3://$FRONTEND_BUCKET

# Configure as static website
aws s3 website s3://$FRONTEND_BUCKET \
  --index-document index.html \
  --error-document index.html
```

### Step 7.2: Build Frontend

```bash
cd /home/andi/claude-trucking-tms/frontend

# Update API URL
cat > .env.production.local << ENVFRONTEND
NEXT_PUBLIC_API_URL=http://$ALB_DNS
ENVFRONTEND

# Build
npm run build
```

### Step 7.3: Deploy to S3

```bash
# Export as static site
npm run build
cd out

# Upload to S3
aws s3 sync . s3://$FRONTEND_BUCKET --delete

echo "Frontend uploaded to S3!"
```

### Step 7.4: Create CloudFront Distribution

```bash
cat > cloudfront-config.json << EOFCF
{
  "CallerReference": "tms-$(date +%s)",
  "Comment": "TMS Frontend",
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$FRONTEND_BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0
  },
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-$FRONTEND_BUCKET",
      "DomainName": "$FRONTEND_BUCKET.s3.amazonaws.com",
      "S3OriginConfig": {
        "OriginAccessIdentity": ""
      }
    }]
  },
  "Enabled": true
}
EOFCF

CF_DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --query 'Distribution.Id' \
  --output text)

CF_DOMAIN=$(aws cloudfront get-distribution \
  --id $CF_DIST_ID \
  --query 'Distribution.DomainName' \
  --output text)

echo "CloudFront URL: https://$CF_DOMAIN"
```

---

## Phase 8: Run Database Migrations

### Step 8.1: Connect to Database

```bash
# Install PostgreSQL client if needed
sudo apt-get install postgresql-client

# Connect to database
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_ENDPOINT \
  -U tmsadmin \
  -d postgres
```

### Step 8.2: Run Migrations

```sql
-- Create expenses table if not exists
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    vendor VARCHAR,
    payment_method VARCHAR,
    receipt_number VARCHAR,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    driver_id INTEGER REFERENCES drivers(id),
    truck_id INTEGER REFERENCES trucks(id),
    load_id INTEGER REFERENCES loads(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_expenses_id ON expenses(id);
```

---

## Phase 9: Configure Custom Domain (Optional)

### Step 9.1: Request SSL Certificate

```bash
# Request certificate in ACM
aws acm request-certificate \
  --domain-name yourtms.com \
  --subject-alternative-names www.yourtms.com api.yourtms.com \
  --validation-method DNS \
  --region us-east-1

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --query 'CertificateSummaryList[0].CertificateArn' \
  --output text)
```

### Step 9.2: Validate Certificate

```bash
# Get DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
  --output table

# Add these DNS records to your domain registrar
# Wait for validation (can take 5-30 minutes)
```

### Step 9.3: Update CloudFront with SSL

```bash
# Update CloudFront distribution to use custom domain and SSL
# (This requires more complex CLI commands - easier via console)

echo "Go to CloudFront Console → Distributions → Edit"
echo "1. Add Alternate Domain Names: yourtms.com, www.yourtms.com"
echo "2. Select SSL Certificate: $CERT_ARN"
echo "3. Save changes"
```

### Step 9.4: Configure Route53

```bash
# Create hosted zone
HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
  --name yourtms.com \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' \
  --output text)

# Create DNS records pointing to CloudFront
cat > dns-records.json << EOFDNS
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "yourtms.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "$CF_DOMAIN",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOFDNS

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-records.json
```

---

## Phase 10: Final Testing and Monitoring

### Step 10.1: Test Application

```bash
# Test backend health
curl http://$ALB_DNS/health

# Test frontend
curl https://$CF_DOMAIN
```

### Step 10.2: Set Up CloudWatch Alarms

```bash
# Create alarm for ECS service
aws cloudwatch put-metric-alarm \
  --alarm-name tms-backend-cpu-high \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Step 10.3: Enable Backup

```bash
# RDS automated backups are already enabled (7 days retention)
# Verify:
aws rds describe-db-instances \
  --db-instance-identifier tms-database \
  --query 'DBInstances[0].BackupRetentionPeriod'
```

---

## Summary of URLs

```bash
echo "=================================="
echo "TMS Deployment Complete!"
echo "=================================="
echo ""
echo "Backend API: http://$ALB_DNS"
echo "Frontend: https://$CF_DOMAIN"
echo "Database: $DB_ENDPOINT"
echo "S3 Uploads: $BUCKET_NAME"
echo ""
echo "Save these credentials:"
echo "Database Password: $DB_PASSWORD"
echo ""
echo "Next steps:"
echo "1. Test the application"
echo "2. Configure custom domain (if applicable)"
echo "3. Set up monitoring alerts"
echo "4. Create first user account"
echo "=================================="
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check ECS task logs
aws logs tail /ecs/tms-backend --follow

# Check task status
aws ecs describe-tasks \
  --cluster tms-cluster \
  --tasks $(aws ecs list-tasks --cluster tms-cluster --query 'taskArns[0]' --output text)
```

### Database Connection Issues
```bash
# Verify security group rules
aws ec2 describe-security-groups --group-ids $DB_SG_ID

# Test connection
PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U tmsadmin -d postgres -c "SELECT 1"
```

### Frontend Not Loading
```bash
# Check CloudFront distribution status
aws cloudfront get-distribution --id $CF_DIST_ID

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CF_DIST_ID \
  --paths "/*"
```

---

## Cost Optimization

1. **Use Reserved Instances** (save 30-50%) if running long-term
2. **Enable auto-scaling** for ECS during low-traffic periods
3. **Use S3 Intelligent-Tiering** for old uploads
4. **Set up CloudWatch billing alarms**

```bash
# Create billing alarm
aws cloudwatch put-metric-alarm \
  --alarm-name billing-alarm \
  --alarm-description "Alert when bill exceeds $100" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

---

## Maintenance

### Update Backend
```bash
# Build new image
cd /home/andi/claude-trucking-tms/backend
docker build -t tms-backend .
docker tag tms-backend:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force new deployment
aws ecs update-service \
  --cluster tms-cluster \
  --service tms-backend-service \
  --force-new-deployment
```

### Update Frontend
```bash
cd /home/andi/claude-trucking-tms/frontend
npm run build
aws s3 sync out/ s3://$FRONTEND_BUCKET --delete
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

---

You're now live on AWS! 🚀

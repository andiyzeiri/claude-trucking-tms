# Claude TMS Production Deployment Guide

This guide will walk you through deploying the Claude TMS to production on AWS.

## Prerequisites

Before starting, ensure you have:

1. **AWS Account** with appropriate permissions
2. **Domain name** (recommended)
3. **Docker** installed locally
4. **Terraform** installed locally
5. **AWS CLI** configured with your credentials

## Step 1: Configure AWS CLI

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Default output format (json)

## Step 2: Set Up SSL Certificate (Optional but Recommended)

If you have a domain, set up SSL certificate:

```bash
./scripts/setup-ssl.sh -d yourdomain.com -r us-east-1
```

This will:
- Create Route 53 hosted zone (if needed)
- Request SSL certificate from AWS Certificate Manager
- Set up DNS validation records
- Wait for certificate validation

**Important**: Update your domain's nameservers if a new hosted zone was created.

## Step 3: Configure Environment Variables

Copy the example terraform variables file:

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
# AWS Configuration
aws_region = "us-east-1"

# Project Configuration
project_name = "claude-tms"
environment  = "prod"

# Database Configuration (REQUIRED)
db_password = "your-secure-database-password-minimum-16-chars"
db_username = "tms_user"
db_name     = "tms_db"

# Application Configuration (REQUIRED)
jwt_secret_key = "your-super-secret-jwt-key-minimum-32-characters-long-and-random"

# Domain Configuration (Optional)
domain_name     = "yourdomain.com"
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID"

# Infrastructure Sizing (Adjust as needed)
container_cpu    = 256
container_memory = 512
desired_count    = 1

db_instance_class     = "db.t3.micro"
db_allocated_storage  = 20
```

**Security Note**: Use strong, unique passwords and keys. Generate them with:
```bash
# Database password (16+ characters)
openssl rand -base64 24

# JWT secret key (32+ characters)
openssl rand -base64 48
```

## Step 4: Deploy Infrastructure and Application

### Option A: Full Automated Deployment
```bash
./deploy.sh all
```

### Option B: Step-by-Step Deployment

1. **Deploy Infrastructure Only**:
   ```bash
   ./deploy.sh infra
   ```

2. **Deploy Application Only** (after infrastructure is ready):
   ```bash
   ./deploy.sh app
   ```

### Option C: Manual Step-by-Step

1. **Initialize and Deploy Infrastructure**:
   ```bash
   cd infrastructure
   ~/bin/terraform init
   ~/bin/terraform plan
   ~/bin/terraform apply
   ```

2. **Build and Push Docker Image**:
   ```bash
   # Get ECR repository URL
   ECR_REPO=$(cd infrastructure && ~/bin/terraform output -raw ecr_backend_repository_url)

   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

   # Build and push
   docker build -f backend/Dockerfile.prod -t claude-tms-backend:latest ./backend/
   docker tag claude-tms-backend:latest $ECR_REPO:latest
   docker push $ECR_REPO:latest
   ```

3. **Update ECS Service**:
   ```bash
   ECS_CLUSTER=$(cd infrastructure && ~/bin/terraform output -raw ecs_cluster_name)
   ECS_SERVICE=$(cd infrastructure && ~/bin/terraform output -raw ecs_service_name)

   aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment
   ```

4. **Run Database Migrations**:
   ```bash
   ./scripts/migrate-db.sh
   ```

5. **Deploy Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build

   S3_BUCKET=$(cd ../infrastructure && ~/bin/terraform output -raw s3_frontend_bucket)
   aws s3 sync ./out/ s3://$S3_BUCKET/ --delete
   ```

## Step 5: Verify Deployment

After deployment completes, check:

1. **Backend API**: Visit your ALB hostname or `api.yourdomain.com`
2. **Frontend**: Visit your CloudFront domain or `yourdomain.com`
3. **API Documentation**: Visit `/docs` on your backend URL

Get the URLs:
```bash
cd infrastructure
echo "Frontend: https://$(~/bin/terraform output -raw cloudfront_domain_name)"
echo "Backend: https://$(~/bin/terraform output -raw alb_hostname)"
```

## Step 6: Post-Deployment Configuration

### Create Initial Admin User

Connect to your RDS instance and create an admin user:

```sql
INSERT INTO users (email, hashed_password, first_name, last_name, is_active, is_superuser, created_at)
VALUES (
  'admin@yourdomain.com',
  '$2b$12$hashed_password_here',
  'Admin',
  'User',
  true,
  true,
  NOW()
);
```

Generate hashed password:
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("your-admin-password")
print(hashed)
```

### Set Up Monitoring (Recommended)

1. **Enable CloudWatch Container Insights** (already configured)
2. **Set up CloudWatch Alarms** for:
   - ECS service health
   - RDS CPU/connections
   - ALB response times
3. **Configure SNS notifications**

### Set Up Backups

1. **RDS automated backups** (already enabled - 7 days retention)
2. **Application data backup strategy**
3. **S3 versioning** (already enabled)

## Troubleshooting

### Common Issues

1. **Certificate validation fails**:
   - Check nameserver configuration
   - Wait up to 30 minutes for DNS propagation

2. **ECS tasks fail to start**:
   - Check CloudWatch logs: `/ecs/claude-tms-backend`
   - Verify environment variables
   - Check security group rules

3. **Database connection fails**:
   - Verify RDS security group allows ECS access
   - Check database endpoint in environment variables

4. **Frontend not loading**:
   - Check CloudFront distribution status
   - Verify S3 bucket policy
   - Check CloudFront invalidation

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster claude-tms --services claude-tms-backend

# View ECS service logs
aws logs describe-log-streams --log-group-name /ecs/claude-tms-backend
aws logs get-log-events --log-group-name /ecs/claude-tms-backend --log-stream-name STREAM_NAME

# Check RDS status
aws rds describe-db-instances --db-instance-identifier claude-tms-db

# Test database connectivity
aws rds describe-db-instances --db-instance-identifier claude-tms-db --query 'DBInstances[0].Endpoint'
```

## Cost Optimization

### Development Environment
For cost savings in dev/staging:
- Use `db.t3.micro` (Free tier eligible)
- Set `desired_count = 0` when not testing
- Use smaller ECS task sizes

### Production Scaling
As you scale:
- Increase `desired_count` for high availability
- Upgrade to larger RDS instance classes
- Enable Multi-AZ for RDS
- Use reserved instances for predictable workloads

## Security Best Practices

✅ **Already Implemented**:
- All traffic encrypted (HTTPS/TLS)
- Database in private subnets
- IAM roles with minimal permissions
- S3 buckets with proper access controls
- Security groups restricting access

🔄 **Additional Recommendations**:
- Enable AWS CloudTrail
- Set up AWS Config rules
- Use AWS Systems Manager for parameter storage
- Implement network ACLs
- Regular security audits

## Maintenance

### Regular Tasks
- Monitor CloudWatch metrics
- Review and rotate secrets quarterly
- Update Docker images regularly
- Monitor RDS performance insights
- Review and clean up CloudWatch logs

### Updates and Deployments
- Use the automated deployment pipeline
- Test changes in staging environment first
- Monitor deployment health after updates
- Keep Terraform state backed up

## Support

If you encounter issues:
1. Check CloudWatch logs first
2. Verify all environment variables
3. Test connectivity between components
4. Review AWS service quotas and limits

The deployment includes comprehensive logging and monitoring to help diagnose issues quickly.
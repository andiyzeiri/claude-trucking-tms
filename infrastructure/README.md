# ABSOLUTE TMS - AWS Infrastructure

Production-ready AWS infrastructure for a multi-tenant SaaS Transportation Management System.

## 🏗️ Infrastructure Components

This Terraform configuration deploys:

- **VPC**: Multi-AZ virtual private cloud with public/private/database subnets
- **RDS PostgreSQL**: Multi-AZ database with encryption and automated backups
- **ECS Fargate**: Serverless container hosting for FastAPI backend
- **Application Load Balancer**: SSL termination and health checks
- **CloudFront**: Global CDN for frontend and API caching
- **S3 Buckets**: Document storage and frontend static assets
- **Secrets Manager**: Secure credential storage
- **IAM Roles**: Least privilege access policies
- **CloudWatch**: Logging and monitoring

## 💰 Estimated Monthly Costs

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$100 |
| ECS Fargate | 2 tasks, 1 vCPU, 2GB RAM | ~$60 |
| Application Load Balancer | Standard | ~$25 |
| CloudFront | 1TB data transfer | ~$100 |
| S3 Storage | 100GB + requests | ~$10 |
| NAT Gateways | 2 AZs | ~$90 |
| Other services | Secrets, CloudWatch, etc. | ~$15 |
| **Total Estimated** | | **~$400/month** |

*Costs will scale with usage. Consider using smaller instances for development.*

## 🚀 Deployment Guide

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Terraform installed** (v1.0+)
3. **Domain name** registered and managed in AWS Route 53
4. **Stripe account** for subscription billing

### Step 1: Configure Variables

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
```hcl
aws_region = "us-east-1"
domain_name = "yourdomain.com"
db_password = "super-secure-password"
stripe_api_key = "sk_live_your_stripe_key"
jwt_secret = "your-jwt-secret"
```

### Step 2: Initialize Terraform

```bash
terraform init
```

### Step 3: Plan Deployment

```bash
terraform plan
```

Review the plan carefully. This will create ~30 AWS resources.

### Step 4: Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. Deployment takes ~15 minutes.

### Step 5: Configure DNS

After deployment, you'll need to:

1. **Point your domain to CloudFront**:
   ```
   yourdomain.com → [CloudFront Distribution Domain]
   ```

2. **Validate SSL certificate**:
   - Check AWS Certificate Manager console
   - Add required DNS records to validate domain ownership

## 📋 Post-Deployment Setup

### 1. Database Setup

```bash
# Get database endpoint from Terraform outputs
terraform output database_endpoint

# Connect and run schema
psql -h [database-endpoint] -U postgres -d absolute_tms -f ../database/schema.sql
psql -h [database-endpoint] -U postgres -d absolute_tms -f ../database/seed_data.sql
```

### 2. Build and Deploy Backend

```bash
# Get ECR repository URL
terraform output ecr_backend_repository_url

# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [account].dkr.ecr.us-east-1.amazonaws.com

docker build -t absolute-tms-backend ../backend
docker tag absolute-tms-backend:latest [ecr-repo-url]:latest
docker push [ecr-repo-url]:latest

# Update ECS service to use new image
aws ecs update-service --cluster absolute-tms-cluster --service absolute-tms-service --force-new-deployment
```

### 3. Deploy Frontend

```bash
# Build Next.js frontend
cd ../frontend
npm run build
npm run export

# Upload to S3
aws s3 sync out/ s3://[frontend-bucket-name] --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id [distribution-id] --paths "/*"
```

## 🔒 Security Features

- **Encryption**: All data encrypted at rest and in transit
- **Network isolation**: Private subnets for backend services
- **IAM roles**: Least privilege access principles
- **Security groups**: Restrictive firewall rules
- **Secrets management**: No hardcoded credentials
- **SSL/TLS**: HTTPS everywhere with AWS Certificate Manager

## 📊 Monitoring & Scaling

### CloudWatch Dashboards
- ECS service health and performance
- RDS database metrics
- Application Load Balancer metrics
- S3 usage and costs

### Auto Scaling
The ECS service can be configured for auto-scaling:

```hcl
# Add to main.tf
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
```

## 🔧 Maintenance Tasks

### Database Backups
- Automated daily backups (7-day retention)
- Manual snapshots before major changes
- Point-in-time recovery available

### Updates and Patches
- RDS maintenance windows: Sundays 4-5 AM EST
- ECS tasks automatically updated with new deployments
- Security patches applied automatically

### Cost Optimization
- Monitor unused resources with AWS Cost Explorer
- Consider Reserved Instances for RDS
- Use S3 lifecycle policies for document storage

## 🚨 Disaster Recovery

### Backup Strategy
- **RDS**: Automated backups + manual snapshots
- **S3**: Cross-region replication for critical documents
- **Application**: Container images stored in ECR

### Recovery Procedures
1. **Database**: Restore from automated backup or snapshot
2. **Application**: Deploy from latest ECR image
3. **Frontend**: Re-deploy from source code

## 📞 Support

For infrastructure issues:
1. Check AWS CloudWatch logs
2. Review Terraform state: `terraform show`
3. AWS Support (if you have a support plan)

## 🔄 Development Environment

For a cheaper development environment:
- Use `db.t3.micro` instead of `db.t3.medium`
- Single AZ deployment (remove `multi_az = true`)
- Smaller ECS task sizes
- Skip CloudFront for development

Estimated dev cost: ~$50/month
# Claude TMS Infrastructure

This directory contains Terraform configuration files for deploying the Claude TMS to AWS.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Domain name** (optional but recommended)
4. **SSL Certificate** in AWS Certificate Manager

## Quick Start

### 1. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your specific values:
- Set your domain name and certificate ARN
- Generate secure passwords for database and JWT
- Adjust resource sizes based on your needs

### 2. Initialize and Deploy

```bash
# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy infrastructure
terraform apply
```

### 3. Post-Deployment Setup

After infrastructure is deployed, you'll need to:

1. **Push Docker Images** to the created ECR repository
2. **Run Database Migrations** on the RDS instance
3. **Deploy Frontend** to the S3 bucket
4. **Configure DNS** if using custom domain

## Architecture Overview

### Backend Services
- **ECS Fargate** - Containerized FastAPI backend
- **RDS PostgreSQL** - Database with PostGIS extension
- **ElastiCache Redis** - Caching and session storage
- **Application Load Balancer** - SSL termination and routing

### Frontend Services
- **S3 + CloudFront** - Static website hosting with CDN
- **Route 53** - DNS management (if domain provided)

### Storage & Security
- **S3** - Document storage (BOL/POD files)
- **IAM** - Proper role-based access control
- **Security Groups** - Network-level security

## Environment Variables

The following environment variables are automatically configured:

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `AWS_S3_BUCKET` - S3 bucket for document storage
- `JWT_SECRET_KEY` - JWT signing key

### Frontend
- `NEXT_PUBLIC_API_URL` - Backend API endpoint

## Costs

Estimated monthly costs for minimal production setup:
- RDS db.t3.micro: ~$15/month
- ECS Fargate (1 task): ~$15/month
- ElastiCache t3.micro: ~$15/month
- ALB: ~$20/month
- CloudFront: ~$1/month (low traffic)
- S3: ~$5/month (moderate storage)

**Total**: ~$70/month (excluding data transfer)

## Scaling

To scale the application:

1. **Horizontal Scaling**: Increase `desired_count` in variables
2. **Vertical Scaling**: Increase `container_cpu` and `container_memory`
3. **Database Scaling**: Upgrade `db_instance_class`

## Security

- All traffic encrypted in transit (HTTPS/TLS)
- Database in private subnets
- S3 buckets with proper access controls
- IAM roles with minimal required permissions

## Monitoring

- CloudWatch logs for all services
- ECS Container Insights enabled
- RDS Enhanced Monitoring available

## Backup & Recovery

- RDS automated backups (7-day retention)
- S3 versioning enabled
- Database encryption at rest

## Troubleshooting

### Common Issues

1. **Certificate ARN**: Make sure certificate is in the same region
2. **Domain Setup**: Ensure Route 53 hosted zone exists
3. **ECR Push**: Login to ECR before pushing images

### Useful Commands

```bash
# Check infrastructure status
terraform show

# View outputs
terraform output

# Destroy infrastructure (careful!)
terraform destroy
```

## Next Steps

After deploying infrastructure:

1. Build and push Docker images to ECR
2. Run database migrations
3. Deploy frontend build to S3
4. Set up CI/CD pipeline
5. Configure monitoring and alerting
# Claude TMS - Quick Start Guide

Get your Claude Transportation Management System running in production in under 30 minutes.

## Prerequisites

- AWS Account with admin permissions
- Domain name (optional but recommended)
- Local machine with Docker installed

## 🚀 One-Command Deployment

1. **Clone and configure**:
   ```bash
   git clone <your-repo-url>
   cd claude-trucking-tms

   # Configure terraform variables
   cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
   # Edit with your values (see below)
   ```

2. **Deploy everything**:
   ```bash
   ./deploy.sh all
   ```

3. **Done!** Your TMS is live.

## ⚙️ Required Configuration

Edit `infrastructure/terraform.tfvars`:

```hcl
# REQUIRED - Generate secure passwords
db_password = "your-secure-db-password-16chars+"
jwt_secret_key = "your-jwt-secret-32chars+"

# OPTIONAL - For custom domain
domain_name = "yourdomain.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc-123"
```

**Generate secure values**:
```bash
# Database password
openssl rand -base64 24

# JWT secret
openssl rand -base64 48
```

## 🌐 With Custom Domain

**Option 1**: Use the SSL setup script:
```bash
./scripts/setup-ssl.sh -d yourdomain.com
# Add the output to terraform.tfvars
```

**Option 2**: Manual setup:
1. Create Route 53 hosted zone
2. Request ACM certificate
3. Update domain nameservers
4. Add domain/cert to terraform.tfvars

## 📋 What Gets Deployed

### Infrastructure
- **ECS Fargate** - Containerized backend
- **RDS PostgreSQL** - Database with PostGIS
- **ElastiCache Redis** - Caching
- **S3 + CloudFront** - Frontend hosting
- **ALB** - Load balancer with SSL

### Services
- **Backend API** - FastAPI with async PostgreSQL
- **Frontend** - Next.js with TypeScript
- **Database** - Migrations and schema setup
- **Storage** - S3 for documents (BOL/POD)

## 🔍 After Deployment

Check your endpoints:
```bash
cd infrastructure
echo "Frontend: https://$(~/bin/terraform output -raw cloudfront_domain_name)"
echo "API: https://$(~/bin/terraform output -raw alb_hostname)"
```

Create admin user:
```bash
# Connect to RDS and run SQL or use the admin creation script
```

## 💰 Cost Estimate

**Minimal Production**: ~$70/month
- RDS t3.micro: $15
- ECS Fargate: $15
- ElastiCache: $15
- ALB: $20
- CloudFront/S3: $5

## 🛠️ Customization

### Scaling Up
```hcl
# In terraform.tfvars
container_cpu = 512
container_memory = 1024
desired_count = 2
db_instance_class = "db.t3.small"
```

### Scaling Down (Dev)
```hcl
container_cpu = 256
container_memory = 512
desired_count = 1
db_instance_class = "db.t3.micro"
```

## 🔧 Common Commands

```bash
# Deploy infrastructure only
./deploy.sh infra

# Deploy application only
./deploy.sh app

# Run database migrations
./scripts/migrate-db.sh

# View deployment status
cd infrastructure && ~/bin/terraform show
```

## 🆘 Troubleshooting

**ECS tasks failing?**
```bash
aws logs describe-log-streams --log-group-name /ecs/claude-tms-backend
```

**Frontend not loading?**
- Check CloudFront distribution status
- Verify S3 bucket contents

**Database issues?**
- Check RDS endpoint in outputs
- Verify security group rules

**SSL certificate issues?**
- Ensure domain nameservers are updated
- Wait up to 30 minutes for DNS propagation

## 📚 Full Documentation

For detailed instructions, see:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [infrastructure/README.md](./infrastructure/README.md) - Infrastructure details
- Backend API docs at `/docs` endpoint

## 🔄 Updates

To update your deployment:
```bash
# Pull latest changes
git pull

# Redeploy
./deploy.sh app
```

## 🛡️ Security

The deployment includes:
- HTTPS everywhere
- Database in private subnets
- IAM roles with minimal permissions
- S3 with proper access controls
- Security groups restricting access

## 🎯 Next Steps

After deployment:
1. Create admin user account
2. Configure company settings
3. Add drivers and trucks
4. Set up monitoring alerts
5. Plan backup strategy

---

**Need help?** Check the troubleshooting section in the full deployment guide.
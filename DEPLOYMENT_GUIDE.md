# 🚀 ABSOLUTE TMS - Live Deployment Guide

This guide will get your TMS application live with:
- **Frontend**: Netlify (free tier, easy deployment)
- **Backend**: AWS ECS (scalable, production-ready)
- **Database**: AWS RDS PostgreSQL (managed, secure)

## 🎯 Architecture Overview

```
Frontend (Netlify) → API Gateway → Backend (AWS ECS) → Database (AWS RDS)
```

## ⚡ Quick Start (30 minutes)

### Phase 1: Deploy Database (5 minutes)

1. **Set up AWS credentials**:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
```

2. **Deploy minimal infrastructure** (just RDS for now):
```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
aws_region = "us-east-1"
project_name = "absolute-tms"
domain_name = "your-domain.com"  # Optional for now
db_password = "YourSecurePassword123!"
stripe_api_key = "sk_test_dummy"  # Use test key for now
jwt_secret = "your-jwt-secret-32-chars-long"
```

3. **Deploy database infrastructure**:
```bash
terraform init
terraform apply
```

4. **Set up database schema**:
```bash
# Get database endpoint
DB_ENDPOINT=$(terraform output -raw database_endpoint)

# Run schema setup
psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f ../database/schema.sql
psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f ../database/seed_data.sql
```

### Phase 2: Create FastAPI Backend (10 minutes)

1. **Create backend directory structure**:
```bash
mkdir -p backend/app/api/v1/endpoints
mkdir -p backend/app/core
mkdir -p backend/app/models
mkdir -p backend/app/schemas
```

2. **Create main FastAPI app** (`backend/app/main.py`):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Absolute TMS API", version="1.0.0")

# CORS middleware for Netlify frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-netlify-app.netlify.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Absolute TMS API is running"}

@app.get("/api/v1/loads")
async def get_loads():
    # Mock data for now
    return [
        {
            "id": 1,
            "load_number": "TMS001",
            "customer": "ACME Trucking",
            "pickup": "Los Angeles, CA",
            "delivery": "Phoenix, AZ",
            "status": "in_transit"
        }
    ]
```

3. **Create Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

4. **Create requirements.txt** (`backend/requirements.txt`):
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
alembic==1.12.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
boto3==1.34.0
```

### Phase 3: Deploy Backend to AWS ECS (10 minutes)

1. **Build and push Docker image**:
```bash
# Get ECR repository URL
ECR_URI=$(terraform output -raw ecr_backend_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI

# Build and push
cd backend
docker build -t absolute-tms-backend .
docker tag absolute-tms-backend:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

2. **Deploy ECS service**:
```bash
cd ../infrastructure
terraform apply  # This will create the full infrastructure including ECS
```

3. **Get your API URL**:
```bash
echo "Your API URL: https://$(terraform output -raw load_balancer_dns)"
```

### Phase 4: Deploy Frontend to Netlify (5 minutes)

1. **Update API configuration** in frontend:
```bash
cd ../frontend
```

Create or update `.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-alb-dns-name.us-east-1.elb.amazonaws.com
```

2. **Build for production**:
```bash
npm install
npm run build
```

3. **Deploy to Netlify**:
   - Go to [netlify.com](https://netlify.com) and sign up
   - Click "Add new site" → "Deploy manually"
   - Drag and drop your `frontend/out` folder (after running `npm run build && npm run export`)
   - Or connect your GitHub repo for automatic deployments

4. **Configure environment variables in Netlify**:
   - Go to Site settings → Environment variables
   - Add: `NEXT_PUBLIC_API_URL` = `https://your-alb-dns.us-east-1.elb.amazonaws.com`

## 📋 Production Checklist

### Security & Configuration
- [ ] Update CORS origins in FastAPI to match your Netlify URL
- [ ] Set up custom domain on Netlify
- [ ] Configure SSL certificates
- [ ] Update database password to something secure
- [ ] Set up real Stripe API keys
- [ ] Configure proper JWT secrets

### Monitoring & Maintenance
- [ ] Set up CloudWatch alerts
- [ ] Configure database backups
- [ ] Set up error tracking (Sentry)
- [ ] Monitor costs in AWS billing

## 🔧 Environment-Specific Configs

### Development
```bash
# Use local database
DATABASE_URL=postgresql://postgres:password@localhost:5432/absolute_tms

# Use local API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production
```bash
# Use AWS RDS
DATABASE_URL=postgresql://postgres:password@your-rds-endpoint:5432/absolute_tms

# Use AWS ALB
NEXT_PUBLIC_API_URL=https://your-alb-dns.us-east-1.elb.amazonaws.com
```

## 🚨 Common Issues & Solutions

### Backend Issues
1. **ECS task keeps restarting**:
   - Check CloudWatch logs: `aws logs get-log-events --log-group-name /ecs/absolute-tms`
   - Verify environment variables in ECS task definition

2. **Database connection fails**:
   - Check security groups allow connection from ECS to RDS
   - Verify database endpoint and credentials

### Frontend Issues
1. **CORS errors**:
   - Update FastAPI CORS middleware with correct Netlify URL
   - Redeploy backend after CORS changes

2. **API calls fail**:
   - Check `NEXT_PUBLIC_API_URL` environment variable
   - Verify ALB health checks are passing

### Deployment Issues
1. **Terraform fails**:
   - Check AWS credentials: `aws sts get-caller-identity`
   - Verify you have necessary IAM permissions

2. **Docker push fails**:
   - Re-run ECR login command
   - Check Docker daemon is running

## 💰 Cost Optimization

### AWS Costs (~$50-100/month)
- Use `db.t3.micro` for development
- Scale ECS tasks based on usage
- Set up billing alerts

### Free Tiers
- Netlify: 100GB bandwidth/month (free)
- AWS RDS: 750 hours/month (free tier first year)
- AWS ECS: Pay only for what you use

## 🔄 CI/CD Pipeline (Optional)

Set up GitHub Actions for automatic deployments:

1. **Frontend**: Auto-deploy to Netlify on push to `main`
2. **Backend**: Auto-build and deploy to ECS on push to `main`
3. **Database**: Run migrations automatically

## 📞 Support & Next Steps

After deployment:
1. Test all functionality
2. Set up monitoring and alerts
3. Configure backup strategies
4. Plan for scaling as you get customers
5. Set up proper domain with SSL

**Your app will be live at**:
- Frontend: `https://your-app.netlify.app`
- Backend API: `https://your-alb-dns.us-east-1.elb.amazonaws.com`

Ready to launch your TMS SaaS! 🚛✨
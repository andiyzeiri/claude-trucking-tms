#!/bin/bash

# =================================================================================
# ABSOLUTE TMS - Quick Deployment Script
# =================================================================================

set -e  # Exit on any error

echo "🚀 Starting ABSOLUTE TMS Deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# =================================================================================
# Phase 1: Deploy Infrastructure
# =================================================================================

echo "📋 Phase 1: Deploying AWS Infrastructure..."

cd infrastructure

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo "⚠️  Creating terraform.tfvars from example..."
    cp terraform.tfvars.example terraform.tfvars
    echo "✅ Please edit terraform.tfvars with your values, then run this script again"
    exit 1
fi

# Initialize and deploy Terraform
echo "🏗️  Initializing Terraform..."
terraform init

echo "📊 Planning infrastructure..."
terraform plan

read -p "🤔 Deploy infrastructure? This will create AWS resources (~$50-100/month). (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying infrastructure..."
    terraform apply -auto-approve

    # Get outputs
    DB_ENDPOINT=$(terraform output -raw database_endpoint)
    ECR_URI=$(terraform output -raw ecr_backend_repository_url)
    ALB_DNS=$(terraform output -raw load_balancer_dns)

    echo "✅ Infrastructure deployed successfully!"
    echo "📊 Database endpoint: $DB_ENDPOINT"
    echo "🐳 ECR repository: $ECR_URI"
    echo "🌐 Load balancer: $ALB_DNS"
else
    echo "❌ Deployment cancelled"
    exit 1
fi

# =================================================================================
# Phase 2: Set up Database
# =================================================================================

echo "📋 Phase 2: Setting up database..."

# Get database password from terraform.tfvars
DB_PASSWORD=$(grep db_password terraform.tfvars | cut -d'"' -f2)

echo "🗄️  Setting up database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U postgres -d absolute_tms -f ../database/schema.sql

echo "📊 Loading sample data..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U postgres -d absolute_tms -f ../database/seed_data.sql

echo "✅ Database setup complete!"

# =================================================================================
# Phase 3: Build and Deploy Backend
# =================================================================================

echo "📋 Phase 3: Building and deploying backend..."

cd ../backend

echo "🐳 Building Docker image..."
docker build -t absolute-tms-backend .

echo "🔑 Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "$ECR_URI"

echo "🏷️  Tagging image..."
docker tag absolute-tms-backend:latest "$ECR_URI:latest"

echo "📤 Pushing to ECR..."
docker push "$ECR_URI:latest"

echo "🔄 Updating ECS service..."
aws ecs update-service --cluster absolute-tms-cluster --service absolute-tms-service --force-new-deployment

echo "✅ Backend deployed successfully!"

# =================================================================================
# Phase 4: Prepare Frontend for Netlify
# =================================================================================

echo "📋 Phase 4: Preparing frontend for Netlify..."

cd ../frontend

# Create production environment file
echo "🔧 Creating production environment..."
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://$ALB_DNS
EOF

# Build frontend
echo "🏗️  Building frontend..."
npm install
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
npm run export

echo "✅ Frontend built successfully!"
echo "📁 Deploy the 'out' folder to Netlify"

# =================================================================================
# Phase 5: Final Instructions
# =================================================================================

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Next Steps:"
echo "1. 🌐 Deploy frontend to Netlify:"
echo "   - Go to https://netlify.com"
echo "   - Drag and drop the 'frontend/out' folder"
echo "   - Set environment variable: NEXT_PUBLIC_API_URL=https://$ALB_DNS"
echo ""
echo "2. 🔗 Your API endpoints:"
echo "   - Health Check: https://$ALB_DNS/health"
echo "   - Loads API: https://$ALB_DNS/api/loads"
echo "   - Drivers API: https://$ALB_DNS/api/drivers"
echo ""
echo "3. 📊 Monitor your deployment:"
echo "   - AWS CloudWatch: Check ECS service logs"
echo "   - AWS RDS: Monitor database performance"
echo ""
echo "4. 💰 Cost monitoring:"
echo "   - Set up AWS billing alerts"
echo "   - Monitor usage in AWS Console"
echo ""
echo "🚛 Your TMS is now live and ready for customers!"
# 🆓 AWS Free Tier Deployment Guide

Deploy your ABSOLUTE TMS backend to AWS using **free tier resources** to minimize costs.

## 💰 Free Tier Limits & Costs

### What's Actually Free (12 months)
- **RDS PostgreSQL**: 750 hours/month (db.t3.micro) = **$0/month**
- **EC2 Instance**: 750 hours/month (t2.micro) = **$0/month**
- **Application Load Balancer**: First year = **~$16/month** (no free tier)
- **S3 Storage**: 5GB = **$0/month**
- **Data Transfer**: 15GB out = **$0/month**

### **Total Monthly Cost: ~$16-20/month** (mostly ALB)

## 🚀 Free Tier Architecture

Instead of ECS (which requires ALB), we'll use:
```
Frontend (Netlify) → EC2 Instance (t2.micro) → RDS (db.t3.micro)
```

## 📋 Step 1: Create Free Tier Infrastructure

Create `infrastructure/free-tier.tf`:

```hcl
# =================================================================================
# ABSOLUTE TMS - AWS FREE TIER DEPLOYMENT
# =================================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "key_pair_name" {
  description = "EC2 Key Pair name"
  type        = string
}

# =================================================================================
# VPC AND NETWORKING (Free)
# =================================================================================

# Use default VPC to save costs
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# =================================================================================
# SECURITY GROUPS (Free)
# =================================================================================

resource "aws_security_group" "web_sg" {
  name        = "absolute-tms-web"
  description = "Security group for web server"
  vpc_id      = data.aws_vpc.default.id

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # FastAPI
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Restrict this in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db_sg" {
  name        = "absolute-tms-db"
  description = "Security group for database"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }
}

# =================================================================================
# RDS DATABASE (FREE TIER)
# =================================================================================

resource "aws_db_instance" "postgres" {
  identifier     = "absolute-tms-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"  # FREE TIER

  allocated_storage     = 20  # FREE TIER (up to 20GB)
  max_allocated_storage = 20
  storage_encrypted     = false  # Encryption costs extra

  db_name  = "absolute_tms"
  username = "postgres"
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.db_sg.id]

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = true  # For testing
  publicly_accessible = false

  tags = {
    Name = "absolute-tms-database"
  }
}

# =================================================================================
# EC2 INSTANCE (FREE TIER)
# =================================================================================

# Get latest Amazon Linux AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "web_server" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t2.micro"  # FREE TIER
  key_name      = var.key_pair_name

  vpc_security_group_ids = [aws_security_group.web_sg.id]

  user_data = templatefile("${path.module}/user_data.sh", {
    db_endpoint = aws_db_instance.postgres.endpoint
    db_password = var.db_password
  })

  tags = {
    Name = "absolute-tms-server"
  }
}

# =================================================================================
# OUTPUTS
# =================================================================================

output "server_public_ip" {
  value = aws_instance.web_server.public_ip
}

output "server_public_dns" {
  value = aws_instance.web_server.public_dns
}

output "database_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "api_url" {
  value = "http://${aws_instance.web_server.public_dns}:8000"
}
```

## 📋 Step 2: Create EC2 Setup Script

Create `infrastructure/user_data.sh`:

```bash
#!/bin/bash

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install PostgreSQL client
yum install -y postgresql15

# Create app directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Create Docker Compose file
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  fastapi:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:${db_password}@${db_endpoint}/absolute_tms
      - ENVIRONMENT=production
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - fastapi
    restart: unless-stopped
EOF

# Create Nginx config
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream fastapi {
        server fastapi:8000;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://fastapi;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/app
```

## 📋 Step 3: Deploy with Terraform

```bash
cd infrastructure

# Create terraform.tfvars
cat > terraform.tfvars << EOF
aws_region = "us-east-1"
db_password = "YourSecurePassword123!"
key_pair_name = "your-key-pair-name"  # Create this in AWS Console first
EOF

# Initialize and deploy
terraform init
terraform apply -var-file="terraform.tfvars" -target="aws_db_instance.postgres"
terraform apply -var-file="terraform.tfvars"
```

## 📋 Step 4: Deploy Your Application

```bash
# Get server details
SERVER_IP=$(terraform output -raw server_public_ip)
API_URL=$(terraform output -raw api_url)

# Copy your backend code to EC2
cd ../backend
tar -czf backend.tar.gz .
scp -i ~/.ssh/your-key.pem backend.tar.gz ec2-user@$SERVER_IP:/home/ec2-user/app/

# SSH into server and deploy
ssh -i ~/.ssh/your-key.pem ec2-user@$SERVER_IP

# On the server:
cd /home/ec2-user/app
tar -xzf backend.tar.gz
sudo docker-compose up -d --build
```

## 📋 Step 5: Set Up Database

```bash
# On your local machine:
DB_ENDPOINT=$(terraform output -raw database_endpoint)

# Set up database schema
PGPASSWORD="YourSecurePassword123!" psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f ../database/schema.sql
PGPASSWORD="YourSecurePassword123!" psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f ../database/seed_data.sql
```

## 🎯 Alternative: Even Cheaper Options

### Option 1: Railway (Recommended)
- **Cost**: $5/month for everything
- **Setup**: 5 minutes
- **Features**: PostgreSQL + FastAPI hosting

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
cd backend
railway login
railway new
railway add postgresql
railway up
```

### Option 2: Render.com
- **Cost**: $7/month for PostgreSQL, Free for backend
- **Setup**: Connect GitHub repo
- **Features**: Auto-deploy from GitHub

### Option 3: DigitalOcean App Platform
- **Cost**: $5/month for everything
- **Setup**: Connect GitHub repo
- **Features**: Managed database + containers

## 🔧 Complete Free Tier Setup Commands

```bash
# 1. Create EC2 Key Pair (in AWS Console)
# Go to EC2 → Key Pairs → Create Key Pair → Download .pem file

# 2. Deploy infrastructure
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
# Edit with your values
terraform init
terraform apply

# 3. Get connection details
SERVER_IP=$(terraform output -raw server_public_ip)
API_URL=$(terraform output -raw api_url)

echo "Your API will be available at: $API_URL"

# 4. Update Netlify environment variable
# NEXT_PUBLIC_API_URL = http://your-server-ip:8000/api
```

## 💡 Pro Tips

1. **Use Railway/Render for simplicity** - They're designed for this
2. **EC2 + RDS is powerful** but requires more setup
3. **Free tier expires after 12 months** - plan for $20-50/month after
4. **Set billing alerts** in AWS Console
5. **Consider Vercel/Netlify serverless functions** for backend

## 🎯 Recommended Path

For fastest deployment:
1. **Use Railway** ($5/month) for backend + database
2. **Use Netlify** (free) for frontend
3. **Total cost**: $5/month

Want to try AWS free tier? Follow the steps above, but expect more complexity for setup and management.

**Which option would you like to pursue?** 🚀
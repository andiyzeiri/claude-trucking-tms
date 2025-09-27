# 🚀 Simple Step-by-Step Deployment Guide

**Goal**: Get your TMS app live with Frontend on Netlify + Backend on AWS

## 📥 What You Need to Download/Install

### 1. Download These Programs (10 minutes)

**On Your Computer:**
- ✅ [AWS CLI](https://aws.amazon.com/cli/) - to talk to AWS
- ✅ [Terraform](https://terraform.io/downloads) - to create AWS servers
- ✅ [Git](https://git-scm.com/downloads) - to upload code to GitHub
- ✅ [Node.js](https://nodejs.org) - to build your frontend

**Quick Install Commands:**
```bash
# Windows (if you have Chocolatey)
choco install awscli terraform git nodejs

# Mac (if you have Homebrew)
brew install awscli terraform git node

# Or download from the websites above
```

## 🔐 Step 1: Set Up AWS Account (5 minutes)

1. **Sign up**: Go to [aws.amazon.com](https://aws.amazon.com) → Create account
2. **Add credit card** (required, but won't be charged on free tier)
3. **Choose Basic Support** (free)
4. **Create Access Keys**:
   - Go to [IAM Console](https://console.aws.amazon.com/iam)
   - Users → Create User → Name: "terraform-user"
   - Attach policy: "AdministratorAccess"
   - Security credentials → Create access key
   - **Save these keys!** (you'll need them)

5. **Configure AWS CLI**:
```bash
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Region: us-east-1
# Output format: json
```

## 🔑 Step 2: Create EC2 Key Pair (2 minutes)

1. Go to [EC2 Console](https://console.aws.amazon.com/ec2)
2. Left sidebar → "Key Pairs"
3. "Create key pair"
4. Name: `absolute-tms-key`
5. **Download the .pem file** (you already have this!)
6. Move it: `cp /mnt/c/Users/Andi/Downloads/absolute-tms-key.pem ~/.ssh/`
7. Fix permissions: `chmod 400 ~/.ssh/absolute-tms-key.pem`

## 🌐 Step 3: Set Up GitHub (5 minutes)

1. **Create GitHub account**: [github.com](https://github.com)
2. **Create new repository**:
   - Name: "absolute-tms"
   - Make it **Public** (required for Netlify free tier)
   - Don't initialize with README

3. **Push your code**:
```bash
cd claude-trucking-tms
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/absolute-tms.git
git push -u origin main
```

## 🎨 Step 4: Set Up Netlify (3 minutes)

1. **Sign up**: Go to [netlify.com](https://netlify.com) (use GitHub account)
2. **Create site**: "Add new site" → "Import an existing project"
3. **Connect GitHub**: Choose your `absolute-tms` repository
4. **Build settings**:
   - Base directory: `frontend`
   - Build command: `npm run build-and-export`
   - Publish directory: `frontend/out`
5. **Deploy site** (it will give you a URL like `amazing-app-123.netlify.app`)

## ☁️ Step 5: Deploy AWS Backend (10 minutes)

### Create your configuration file:
```bash
cd infrastructure
cat > free-tier.tfvars << EOF
aws_region = "us-east-1"
db_password = "MySecurePassword123!"
key_pair_name = "absolute-tms-key"
EOF
```

### Deploy to AWS:
```bash
# Initialize Terraform
terraform init

# Create your AWS infrastructure
terraform apply -var-file="free-tier.tfvars"
# Type 'yes' when prompted
```

**This creates:**
- Database server (PostgreSQL)
- Web server (EC2 instance)
- Security settings
- **Costs: $0/month** (free tier)

### Get your server details:
```bash
SERVER_IP=$(terraform output -raw server_public_ip)
echo "Your server IP: $SERVER_IP"
```

## 📦 Step 6: Deploy Your Backend Code (5 minutes)

### Package and upload your backend:
```bash
cd ../backend
tar -czf backend.tar.gz .
scp -i ~/.ssh/absolute-tms-key.pem backend.tar.gz ec2-user@$SERVER_IP:/home/ec2-user/app/
```

### SSH into your server and start the app:
```bash
ssh -i ~/.ssh/absolute-tms-key.pem ec2-user@$SERVER_IP

# On the server:
cd /home/ec2-user/app
tar -xzf backend.tar.gz
sudo docker-compose up -d --build
curl http://localhost:8000/health
```

## 🗄️ Step 7: Set Up Database (3 minutes)

**On your local computer:**
```bash
# Get database info
DB_ENDPOINT=$(terraform output -raw database_endpoint)

# Set up database tables
PGPASSWORD="MySecurePassword123!" psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f database/schema.sql

# Add sample data
PGPASSWORD="MySecurePassword123!" psql -h $DB_ENDPOINT -U postgres -d absolute_tms -f database/seed_data.sql
```

## 🔗 Step 8: Connect Frontend to Backend (2 minutes)

1. **Go to Netlify dashboard** → Your site → Site settings
2. **Environment variables** → Add variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `http://YOUR_SERVER_IP:8000/api`
3. **Deploys** → Trigger deploy

## ✅ Step 9: Test Everything (2 minutes)

**Your URLs:**
- Frontend: `https://your-netlify-url.netlify.app`
- Backend: `http://your-server-ip:8000`

**Test these URLs:**
- `http://your-server-ip:8000/health` (should return "healthy")
- `http://your-server-ip:8000/api/loads` (should return load data)

## 🎉 You're Live!

**Your TMS SaaS is now running:**
- ✅ Frontend hosted on Netlify (free)
- ✅ Backend hosted on AWS (free tier)
- ✅ Database on AWS (free tier)
- ✅ **Total cost: $0/month** for first year

## 🚨 If Something Goes Wrong

### Backend not working:
```bash
ssh -i ~/.ssh/absolute-tms-key.pem ec2-user@$SERVER_IP
sudo docker-compose logs
sudo docker-compose down
sudo docker-compose up -d
```

### Frontend not connecting:
- Check Netlify environment variable is correct
- Make sure it starts with `http://` not `https://`
- Try triggering a new deploy

### Database not connecting:
```bash
# Test database connection
PGPASSWORD="MySecurePassword123!" psql -h $DB_ENDPOINT -U postgres -d absolute_tms -c "SELECT version();"
```

## 📞 Need Help?

If you get stuck on any step, let me know exactly:
1. Which step you're on
2. What error message you see
3. What command you ran

**Total setup time: ~30 minutes**
**Monthly cost: $0** (first 12 months)

Ready to start? Begin with **Step 1: Set Up AWS Account**! 🚀
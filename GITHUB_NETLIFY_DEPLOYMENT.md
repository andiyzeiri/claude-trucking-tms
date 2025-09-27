# 🚀 GitHub → Netlify Deployment Guide

Deploy your ABSOLUTE TMS frontend to Netlify with automatic deployments from GitHub.

## 📋 Step-by-Step Process

### Step 1: Prepare Your Repository

1. **Create `.gitignore` file** (if not exists):
```bash
# Add to .gitignore
node_modules/
.next/
out/
.env.local
.env.production
.DS_Store
*.log
.terraform/
terraform.tfstate*
.terraform.lock.hcl
```

2. **Update frontend for static export**:
```bash
cd frontend
```

Update `package.json` to include export script:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "export": "next export",
    "build-and-export": "next build && next export",
    "start": "next start",
    "lint": "next lint"
  }
}
```

3. **Configure Next.js for static export**:

Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
}

module.exports = nextConfig
```

### Step 2: Set Up GitHub Repository

1. **Initialize git** (if not already done):
```bash
cd claude-trucking-tms
git init
git add .
git commit -m "Initial commit - Absolute TMS SaaS"
```

2. **Create GitHub repository**:
   - Go to [github.com](https://github.com)
   - Click "New repository"
   - Name: `absolute-tms` (or your preferred name)
   - Make it **Public** (required for Netlify free tier)
   - Don't initialize with README (we already have files)

3. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/absolute-tms.git
git branch -M main
git push -u origin main
```

### Step 3: Set Up Netlify Deployment

1. **Go to Netlify**:
   - Visit [netlify.com](https://netlify.com)
   - Sign up/login (you can use your GitHub account)

2. **Create new site**:
   - Click "Add new site" → "Import an existing project"
   - Choose "Deploy with GitHub"
   - Authorize Netlify to access your GitHub account
   - Select your `absolute-tms` repository

3. **Configure build settings**:
   ```
   Base directory: frontend
   Build command: npm run build-and-export
   Publish directory: frontend/out
   ```

4. **Set environment variables**:
   - In Netlify dashboard → Site settings → Environment variables
   - Add these variables:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend-api-url.com
   NODE_ENV = production
   ```

### Step 4: Create Netlify Configuration File

Create `netlify.toml` in your project root:

```toml
[build]
  base = "frontend"
  command = "npm run build-and-export"
  publish = "frontend/out"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-api-url.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production]
  command = "npm run build-and-export"

[context.deploy-preview]
  command = "npm run build-and-export"
```

### Step 5: Deploy AWS Backend (First Time Only)

While Netlify builds your frontend, set up your backend:

1. **Configure AWS infrastructure**:
```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
# Edit with your AWS settings
```

2. **Deploy backend**:
```bash
terraform init
terraform apply
```

3. **Get your API URL**:
```bash
# After deployment completes
terraform output load_balancer_dns
```

4. **Update Netlify environment variables**:
   - Go back to Netlify → Site settings → Environment variables
   - Update `NEXT_PUBLIC_API_URL` with your actual AWS ALB URL
   - Trigger a new deploy

### Step 6: Configure Auto-Deploy

Create GitHub Actions workflow for backend updates (optional):

Create `.github/workflows/deploy-backend.yml`:
```yaml
name: Deploy Backend to AWS

on:
  push:
    branches: [ main ]
    paths: [ 'backend/**' ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Build and push Docker image
      run: |
        cd backend
        docker build -t absolute-tms-backend .
        # Add ECR push commands here
```

## 🔄 Development Workflow

### Making Changes

1. **Frontend changes**:
```bash
# Make your changes in frontend/
git add .
git commit -m "Update dashboard UI"
git push origin main
# Netlify automatically rebuilds and deploys
```

2. **Backend changes**:
```bash
# Make your changes in backend/
# Test locally first
cd backend
uvicorn app.main:app --reload

# Push to GitHub
git add .
git commit -m "Add new API endpoint"
git push origin main

# Deploy to AWS manually for now
cd ../infrastructure
terraform apply
```

## 🌐 Your Live URLs

After deployment:
- **Frontend**: `https://your-app-name.netlify.app`
- **Backend**: `https://your-alb-dns.us-east-1.elb.amazonaws.com`
- **Custom Domain**: Configure in Netlify settings

## 🔧 Troubleshooting

### Common Issues

1. **Build fails on Netlify**:
   - Check build logs in Netlify dashboard
   - Ensure `package.json` has correct scripts
   - Verify Node.js version compatibility

2. **API calls fail**:
   - Check `NEXT_PUBLIC_API_URL` environment variable
   - Verify CORS settings in FastAPI backend
   - Test API endpoints directly

3. **Routing issues**:
   - Ensure `netlify.toml` has proper redirects
   - Check Next.js export configuration

### Debug Commands

```bash
# Test frontend build locally
cd frontend
npm run build-and-export
# Check the 'out' directory

# Test API locally
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Visit http://localhost:8000/health
```

## 📊 Monitoring & Analytics

1. **Netlify Analytics**:
   - Enable in Netlify dashboard for traffic insights

2. **AWS CloudWatch**:
   - Monitor backend performance and logs

3. **Error Tracking**:
   - Consider adding Sentry for error monitoring

## 🎉 Success Checklist

- [ ] GitHub repository created and code pushed
- [ ] Netlify connected to GitHub repository
- [ ] Build settings configured correctly
- [ ] Environment variables set
- [ ] AWS backend deployed
- [ ] API endpoints working
- [ ] Frontend successfully loads
- [ ] Authentication flow working
- [ ] Database connected and populated

## 🚀 Next Steps

1. **Custom Domain**: Set up your own domain in Netlify
2. **SSL Certificate**: Netlify provides free SSL automatically
3. **Performance**: Monitor and optimize load times
4. **SEO**: Add meta tags and optimize for search engines
5. **Analytics**: Set up Google Analytics or similar

Your TMS SaaS is now live with automatic deployments! 🚛✨
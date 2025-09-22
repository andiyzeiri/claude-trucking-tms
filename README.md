# Claude TMS - Transportation Management System

A modern, cloud-native Transportation Management System built with FastAPI, PostgreSQL with PostGIS, and Next.js.

## 🚀 Quick Start

Deploy to production in 30 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/andiyzeiri/claude-trucking-tms.git
cd claude-trucking-tms

# 2. Configure environment
cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
# Edit with your AWS credentials and secure passwords

# 3. Deploy everything
./deploy.sh all
```

## 🏗️ Architecture

### Backend Stack
- **FastAPI** (Python 3.11) - Modern, fast web framework
- **SQLAlchemy 2.x** (Async) - ORM with async support
- **PostgreSQL 15+** with **PostGIS** - Geospatial database
- **Redis** - Caching and sessions
- **JWT** - Authentication
- **AWS S3** - Document storage (BOL/POD)

### Frontend Stack
- **Next.js 14** (App Router, TypeScript) - React framework
- **shadcn/ui** - Modern UI components
- **React Query** - Data fetching and caching
- **Zod** - Schema validation
- **Tailwind CSS** - Utility-first styling

### Infrastructure
- **Docker** - Containerization
- **AWS ECS Fargate** - Container orchestration
- **AWS RDS** - Managed PostgreSQL
- **AWS S3** - Object storage
- **CloudFront** - CDN
- **Terraform** - Infrastructure as Code

## 📋 Features

### Core TMS Functionality
- **Load Management** - Create, track, and manage freight loads
- **Driver Management** - Driver profiles, licensing, and scheduling
- **Truck Management** - Vehicle tracking, maintenance, and assignments
- **Customer Management** - Client relationships and billing
- **Document Management** - BOL, POD, and invoice storage

### Advanced Features
- **Geospatial Tracking** - Real-time location and route optimization
- **Automated Invoicing** - Generate and track customer billing
- **Reporting Dashboard** - Analytics and performance metrics
- **API-First Design** - Full REST API with OpenAPI documentation
- **Multi-tenant Support** - Company-based data isolation

## 🛡️ Security

- **HTTPS Everywhere** - SSL/TLS encryption for all traffic
- **JWT Authentication** - Secure token-based authentication
- **Role-based Access** - Granular permission system
- **Database Security** - Private subnets, encrypted storage
- **AWS IAM** - Minimal permission roles
- **Input Validation** - Comprehensive request validation

## 💰 Cost

**Production Environment**: ~$70/month
- RDS PostgreSQL (t3.micro): $15/month
- ECS Fargate (1 task): $15/month
- ElastiCache Redis: $15/month
- Application Load Balancer: $20/month
- CloudFront + S3: $5/month

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 30-minute setup guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification
- **[Infrastructure README](./infrastructure/README.md)** - Technical infrastructure details

## 🚀 Deployment Options

### One-Command Deployment
```bash
./deploy.sh all
```

### Step-by-Step Deployment
```bash
# Infrastructure only
./deploy.sh infra

# Application only
./deploy.sh app
```

### With Custom Domain
```bash
# Set up SSL certificate
./scripts/setup-ssl.sh -d yourdomain.com

# Update terraform.tfvars with domain info
# Then deploy
./deploy.sh all
```

## 🛠️ Development

### Local Development
```bash
# Backend
cd backend
docker-compose up -d  # Start PostgreSQL and Redis
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Production migrations
./scripts/migrate-db.sh
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/tms
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Infrastructure Configuration

Edit `infrastructure/terraform.tfvars`:
```hcl
aws_region = "us-east-1"
project_name = "claude-tms"
db_password = "secure-password"
jwt_secret_key = "secure-jwt-key"
domain_name = "yourdomain.com"  # Optional
```

## 📊 Monitoring

- **CloudWatch Container Insights** - ECS monitoring
- **RDS Performance Insights** - Database monitoring
- **Application Logs** - Centralized logging
- **Health Checks** - Automated health monitoring
- **Alarms** - Configurable alerts

## 🔄 Updates

```bash
# Pull latest changes
git pull origin main

# Redeploy application
./deploy.sh app

# Update infrastructure (if needed)
./deploy.sh infra
```

## 🆘 Troubleshooting

### Common Issues

**ECS Tasks Failing**:
```bash
aws logs describe-log-streams --log-group-name /ecs/claude-tms-backend
```

**Database Connection Issues**:
- Check RDS security group rules
- Verify database endpoint and credentials

**Frontend Not Loading**:
- Check CloudFront distribution status
- Verify S3 bucket contents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Support

- **Documentation**: Check the docs/ directory
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions

## 🎯 Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics and reporting
- [ ] Integration with third-party logistics providers
- [ ] Machine learning route optimization
- [ ] Multi-language support

---

**Built with ❤️ using Claude AI**

## API Documentation

Once deployed, visit `/docs` on your backend URL for interactive API documentation.

## Demo

- **Live Demo**: Coming soon
- **Screenshots**: See `docs/screenshots/`
- **Video Walkthrough**: See `docs/videos/`
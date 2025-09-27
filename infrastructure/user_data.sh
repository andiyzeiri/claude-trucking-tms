#!/bin/bash

# =================================================================================
# ABSOLUTE TMS - EC2 User Data Script
# =================================================================================

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

# Install Git and other tools
yum install -y git postgresql15 htop

# Create app directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Clone your backend code (you'll update this URL)
# git clone https://github.com/yourusername/absolute-tms.git .

# For now, create the basic structure
mkdir -p backend/app

# Create Docker Compose file for your backend
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  fastapi:
    build: ./backend
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
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - fastapi
    restart: unless-stopped
EOF

# Create Nginx config for reverse proxy
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

        # API routes
        location /api/ {
            proxy_pass http://fastapi;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://fastapi;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Root redirect to API docs
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

# Create a simple deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Deploying Absolute TMS Backend..."

# Pull latest code (when you set up GitHub)
# git pull origin main

# Rebuild and restart services
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d

echo "✅ Deployment complete!"
echo "📊 Check status: sudo docker-compose ps"
echo "📋 View logs: sudo docker-compose logs -f"
EOF

chmod +x deploy.sh

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/app

# Create logs directory
mkdir -p /home/ec2-user/app/logs

# Create a simple health check script
cat > /home/ec2-user/health_check.sh << 'EOF'
#!/bin/bash

# Check if services are running
echo "=== Docker Compose Status ==="
cd /home/ec2-user/app
sudo docker-compose ps

echo "=== API Health Check ==="
curl -s http://localhost:8000/health || echo "❌ API not responding"

echo "=== System Resources ==="
free -h
df -h /
EOF

chmod +x /home/ec2-user/health_check.sh

# Add a cron job for basic monitoring (optional)
echo "*/5 * * * * /home/ec2-user/health_check.sh >> /home/ec2-user/health.log 2>&1" | crontab -u ec2-user -

# Log completion
echo "✅ EC2 setup completed at $(date)" >> /home/ec2-user/setup.log
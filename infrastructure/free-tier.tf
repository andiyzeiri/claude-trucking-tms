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
  description = "EC2 Key Pair name (create in AWS Console first)"
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

  tags = {
    Name = "absolute-tms-web-sg"
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

  tags = {
    Name = "absolute-tms-db-sg"
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
  description = "Public IP of the EC2 instance"
  value       = aws_instance.web_server.public_ip
}

output "server_public_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_instance.web_server.public_dns
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "api_url" {
  description = "Your API URL"
  value       = "http://${aws_instance.web_server.public_dns}:8000"
}

output "ssh_command" {
  description = "SSH command to connect to server"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_instance.web_server.public_ip}"
}
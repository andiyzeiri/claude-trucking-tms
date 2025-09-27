# AWS Configuration
aws_region = "us-east-1"

# Project Configuration
project_name = "claude-tms"
environment  = "prod"

# Database Configuration
db_password = "6OS4f7erMTrFqVr3yFWKY0v0Y09ESNtA"
db_username = "tms_user"
db_name     = "tms_db"

# Application Configuration
jwt_secret_key = "oN+OCZA8CT7jjo11IM9CuNNq1mw0LeqGi7zt4fSuFC3C/AwDmPqZ/JgVmtH/N6Pa"

# Domain Configuration (using ALB hostname for now)
domain_name = ""
certificate_arn = ""

# Infrastructure Sizing
container_cpu    = 256
container_memory = 512
desired_count    = 1

db_instance_class     = "db.t3.micro"
db_allocated_storage  = 20

# Network Configuration
vpc_cidr               = "10.0.0.0/16"
public_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs   = ["10.0.10.0/24", "10.0.20.0/24"]
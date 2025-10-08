# Generate random password for RDS
resource "random_password" "rds_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = local.rds_sg_name
  description = "Security group for RDS PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = local.rds_sg_name
    }
  )
}

# RDS subnet group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-db-subnet-group"
    }
  )
}

# DB Parameter Group for PostGIS
resource "aws_db_parameter_group" "postgres_postgis" {
  name        = "${local.name_prefix}-postgres-postgis"
  family      = "postgres15"
  description = "PostgreSQL parameter group with PostGIS support"

  parameter {
    name  = "shared_preload_libraries"
    value = "postgis,pg_stat_statements"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-postgres-postgis"
    }
  )
}

# RDS PostgreSQL instance with PostGIS support
resource "aws_db_instance" "main" {
  identifier     = local.rds_identifier
  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.rds_database_name
  username = var.rds_username
  password = random_password.rds_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Enable PostGIS and other extensions
  parameter_group_name = aws_db_parameter_group.postgres_postgis.name

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  skip_final_snapshot       = true
  final_snapshot_identifier = null
  deletion_protection       = false

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  performance_insights_enabled = false

  tags = merge(
    local.common_tags,
    {
      Name = local.rds_identifier
    }
  )
}

# Store RDS credentials in Secrets Manager
resource "aws_secretsmanager_secret" "rds_credentials" {
  name                    = local.rds_secret_name
  description             = "RDS credentials for ${local.name_prefix}"
  recovery_window_in_days = 0

  tags = merge(
    local.common_tags,
    {
      Name = local.rds_secret_name
    }
  )
}

resource "aws_secretsmanager_secret_version" "rds_credentials" {
  secret_id = aws_secretsmanager_secret.rds_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.main.username
    password = random_password.rds_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = aws_db_instance.main.db_name
    engine   = "postgres"
  })
}

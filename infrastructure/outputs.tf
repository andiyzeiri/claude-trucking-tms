output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "alb_hostname" {
  description = "ALB hostname"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "s3_frontend_bucket" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "s3_documents_bucket" {
  description = "S3 bucket name for documents"
  value       = aws_s3_bucket.documents.bucket
}

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

# Environment variables for deployment
output "backend_environment_variables" {
  description = "Environment variables for backend deployment"
  value = {
    DATABASE_URL = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}:5432/${var.db_name}"
    REDIS_URL    = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
    AWS_S3_BUCKET = aws_s3_bucket.documents.bucket
    AWS_REGION    = var.aws_region
  }
  sensitive = true
}

output "frontend_environment_variables" {
  description = "Environment variables for frontend deployment"
  value = {
    NEXT_PUBLIC_API_URL = var.domain_name != "" ? "https://api.${var.domain_name}" : "https://${aws_lb.main.dns_name}"
  }
}
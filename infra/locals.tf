locals {
  # Naming convention: {project}-{env}-{resource}
  name_prefix = "${var.project}-${var.env}"

  common_tags = {
    Project    = var.project
    Environment = var.env
    ManagedBy  = "terraform"
    Owner      = var.owner
  }

  # Resource names
  vpc_name             = "${local.name_prefix}-vpc"
  ecr_api_repo_name    = "${var.project}/${var.env}/api"
  ecs_cluster_name     = "${local.name_prefix}-cluster"
  ecs_service_name     = "${local.name_prefix}-api-service"
  ecs_task_family      = "${local.name_prefix}-api"
  alb_name             = "${local.name_prefix}-alb"
  alb_target_group_name = "${local.name_prefix}-api-tg"
  rds_identifier       = "${local.name_prefix}-db"
  rds_secret_name      = "${local.name_prefix}/rds/credentials"
  redis_secret_name    = "${local.name_prefix}/redis/url"
  log_group_name       = "/ecs/${local.name_prefix}-api"

  # Security group names
  alb_sg_name       = "${local.name_prefix}-alb-sg"
  ecs_tasks_sg_name = "${local.name_prefix}-ecs-tasks-sg"
  rds_sg_name       = "${local.name_prefix}-rds-sg"
}

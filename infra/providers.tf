terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    # Configure via backend config file or environment variables
    # Example: terraform init -backend-config="bucket=andi-tms-terraform-state" \
    #          -backend-config="key=prod/terraform.tfstate" \
    #          -backend-config="region=us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

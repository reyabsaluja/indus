terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.shared_account_id]

  default_tags {
    tags = local.common_tags
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

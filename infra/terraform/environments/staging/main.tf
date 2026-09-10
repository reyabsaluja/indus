terraform {
  required_version = ">= 1.10.0, < 2.0.0"
  backend "s3" { use_lockfile = true }
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
    tls = { source = "hashicorp/tls", version = "~> 4.0" }
  }
}

variable "account_id" { type = string }
variable "aws_region" {
  type    = string
  default = "ca-central-1"
}
variable "edge_region" {
  type    = string
  default = "us-east-1"
}
variable "vpc_cidr" { type = string }
variable "domain_name" { type = string }
variable "route53_zone_name" { type = string }
variable "cognito_callback_urls" { type = list(string) }
variable "cognito_logout_urls" { type = list(string) }
variable "cluster_public_access_cidrs" {
  type    = list(string)
  default = []
}
variable "shared_ecr_repository_arns" { type = map(string) }
variable "shared_ecr_repository_urls" { type = map(string) }
variable "alert_email_endpoints" {
  type    = set(string)
  default = []
}
variable "tags" {
  type    = map(string)
  default = {}
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.account_id]
  default_tags { tags = merge(var.tags, { Project = "indus", Environment = "staging", ManagedBy = "Terraform" }) }
}
provider "aws" {
  alias               = "edge"
  region              = var.edge_region
  allowed_account_ids = [var.account_id]
  default_tags { tags = merge(var.tags, { Project = "indus", Environment = "staging", ManagedBy = "Terraform" }) }
}

module "environment" {
  source    = "../../modules/environment"
  providers = { aws = aws, aws.edge = aws.edge }

  environment                 = "staging"
  aws_region                  = var.aws_region
  vpc_cidr                    = var.vpc_cidr
  single_nat_gateway          = false
  node_min_size               = 2
  node_desired_size           = 3
  node_max_size               = 8
  database_min_acu            = 1
  database_max_acu            = 8
  database_instance_count     = 2
  domain_name                 = var.domain_name
  route53_zone_name           = var.route53_zone_name
  cognito_callback_urls       = var.cognito_callback_urls
  cognito_logout_urls         = var.cognito_logout_urls
  cluster_public_access_cidrs = var.cluster_public_access_cidrs
  shared_ecr_repository_arns  = var.shared_ecr_repository_arns
  shared_ecr_repository_urls  = var.shared_ecr_repository_urls
  alert_email_endpoints       = var.alert_email_endpoints
  tags                        = var.tags
}

output "environment" { value = module.environment }

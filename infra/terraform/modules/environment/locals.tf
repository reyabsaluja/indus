data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
data "aws_partition" "current" {}
data "aws_route53_zone" "public" {
  name         = var.route53_zone_name
  private_zone = false
}

locals {
  name       = "${var.project}-${var.environment}"
  production = var.environment == "production"
  azs        = slice(data.aws_availability_zones.available.names, 0, var.availability_zone_count)

  public_subnet_cidrs   = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index)]
  private_subnet_cidrs  = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index + 4)]
  database_subnet_cidrs = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index + 8)]

  common_tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "TryIndus/indus"
  })

  secret_names = {
    database_platform  = "${local.name}/database-platform"
    database_market    = "${local.name}/database-market"
    database_migration = "${local.name}/database-migration"
    platform_api       = "${local.name}/platform-api"
    market_data        = "${local.name}/market-data"
    research_worker    = "${local.name}/research-worker"
  }

  rds_proxy_secret_keys = toset([
    "database_platform",
    "database_market",
    "database_migration",
  ])
}

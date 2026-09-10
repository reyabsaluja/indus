variable "project" {
  type        = string
  description = "Short project identifier used in names and tags."
  default     = "indus"
}

variable "environment" {
  type        = string
  description = "Deployment environment."

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region."
}

variable "vpc_cidr" {
  type        = string
  description = "Environment-exclusive RFC1918 /16 network."

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr)) && tonumber(split("/", var.vpc_cidr)[1]) <= 20
    error_message = "vpc_cidr must be a valid network with enough space for isolated subnets."
  }
}

variable "availability_zone_count" {
  type        = number
  description = "Number of availability zones. Production must use at least three."
  default     = 3

  validation {
    condition     = var.availability_zone_count >= 2 && var.availability_zone_count <= 4
    error_message = "availability_zone_count must be between two and four."
  }
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use one NAT gateway for cost-sensitive non-production environments."
  default     = false
}

variable "cluster_version" {
  type        = string
  description = "Supported EKS minor version."
  default     = "1.33"
}

variable "cluster_public_access_cidrs" {
  type        = list(string)
  description = "Explicit CIDRs allowed to use the EKS public endpoint; empty disables it."
  default     = []
}

variable "node_instance_types" {
  type        = list(string)
  description = "On-demand EKS worker instance types."
  default     = ["m7i.large"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_desired_size" {
  type    = number
  default = 3
}

variable "node_max_size" {
  type    = number
  default = 8
}

variable "database_min_acu" {
  type        = number
  description = "Aurora Serverless v2 minimum capacity."
  default     = 0.5
}

variable "database_max_acu" {
  type        = number
  description = "Aurora Serverless v2 maximum capacity."
  default     = 8
}

variable "database_instance_count" {
  type        = number
  description = "Aurora writer plus readers. Production must use at least two instances."
  default     = 2
}

variable "domain_name" {
  type        = string
  description = "Public environment hostname, for example staging.indus.example."
}

variable "route53_zone_name" {
  type        = string
  description = "Existing public Route 53 hosted-zone name."
}

variable "legacy_origin_hostname" {
  type        = string
  description = "Legacy hostname retained as a weighted DNS target during cutover; null outside the rollback window."
  default     = null
}

variable "replacement_traffic_weight" {
  type        = number
  description = "Replacement percentage expressed as a Route 53 weight from 0 through 100."
  default     = 100

  validation {
    condition     = var.replacement_traffic_weight >= 0 && var.replacement_traffic_weight <= 100
    error_message = "replacement_traffic_weight must be between 0 and 100."
  }
}

variable "cognito_callback_urls" {
  type        = list(string)
  description = "Exact OAuth callback URLs."
}

variable "cognito_logout_urls" {
  type        = list(string)
  description = "Exact OAuth logout URLs."
}

variable "alert_email_endpoints" {
  type        = set(string)
  description = "Email endpoints that confirm SNS alert subscriptions out of band."
  default     = []
}

variable "shared_ecr_repository_arns" {
  type        = map(string)
  description = "Immutable shared-services ECR repository ARNs keyed by platform-api, market-data, research-worker, and web."
}

variable "shared_ecr_repository_urls" {
  type        = map(string)
  description = "Immutable shared-services ECR repository URLs keyed by workload."
}

variable "tags" {
  type        = map(string)
  description = "Additional governance tags."
  default     = {}
}

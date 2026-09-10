variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "shared_account_id" {
  type        = string
  description = "AWS account ID that owns shared state and image repositories."
}

variable "environment_account_ids" {
  type        = map(string)
  description = "Environment account IDs keyed by development, staging, and production."

  validation {
    condition     = length(setsubtract(toset(["development", "staging", "production"]), toset(keys(var.environment_account_ids)))) == 0
    error_message = "All three environment account IDs are required."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub owner/repository bound into OIDC subject conditions."
  default     = "TryIndus/indus"
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  name = "indus-shared"
  common_tags = merge(var.tags, {
    Project     = "indus"
    Environment = "shared"
    ManagedBy   = "Terraform"
    Repository  = var.github_repository
  })
  repositories = toset(["platform-api", "market-data", "research-worker", "web"])
}

resource "aws_kms_key" "shared" {
  description             = "Indus shared state, registry, and audit encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "shared" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.shared.key_id
}

resource "aws_s3_bucket" "state" {
  bucket = "indus-terraform-state-${var.shared_account_id}"
  tags   = merge(local.common_tags, { DataClass = "terraform-state" })
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.shared.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "retain-state-history"
    status = "Enabled"
    filter {}
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_expiration { noncurrent_days = 365 }
  }
  depends_on = [aws_s3_bucket_versioning.state]
}

data "aws_iam_policy_document" "state_bucket" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_bucket.json
}

resource "aws_ecr_repository" "this" {
  for_each = local.repositories

  name                 = "indus/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.shared.arn
  }

  image_scanning_configuration { scan_on_push = true }
  tags = merge(local.common_tags, { Workload = each.key })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the most recent 100 release images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 100
        }
        action = { type = "expire" }
      }
    ]
  })
}

data "aws_iam_policy_document" "ecr_pull" {
  for_each = aws_ecr_repository.this

  statement {
    sid = "EnvironmentPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    principals {
      type        = "AWS"
      identifiers = [for account_id in values(var.environment_account_ids) : "arn:${data.aws_partition.current.partition}:iam::${account_id}:root"]
    }
  }
}

resource "aws_ecr_repository_policy" "pull" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy     = data.aws_iam_policy_document.ecr_pull[each.key].json
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
  tags            = local.common_tags
}

data "aws_iam_policy_document" "github_build_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_build" {
  name                 = "indus-github-build-publisher"
  assume_role_policy   = data.aws_iam_policy_document.github_build_assume.json
  max_session_duration = 3600
  tags                 = local.common_tags
}

data "aws_iam_policy_document" "github_build" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = values(aws_ecr_repository.this)[*].arn
  }
}

resource "aws_iam_role_policy" "github_build" {
  name   = "publish-immutable-images"
  role   = aws_iam_role.github_build.id
  policy = data.aws_iam_policy_document.github_build.json
}

data "aws_iam_policy_document" "github_promotion_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repository}:environment:development",
        "repo:${var.github_repository}:environment:staging",
        "repo:${var.github_repository}:environment:production",
      ]
    }
  }
}

resource "aws_iam_role" "github_promotion" {
  name                 = "indus-github-promotion-verifier"
  assume_role_policy   = data.aws_iam_policy_document.github_promotion_assume.json
  max_session_duration = 3600
  tags                 = local.common_tags
}

data "aws_iam_policy_document" "github_promotion" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = values(aws_ecr_repository.this)[*].arn
  }
}

resource "aws_iam_role_policy" "github_promotion" {
  name   = "verify-release-images"
  role   = aws_iam_role.github_promotion.id
  policy = data.aws_iam_policy_document.github_promotion.json
}

data "aws_iam_policy_document" "state_assume" {
  for_each = var.environment_account_ids

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${each.value}:root"]
    }
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

resource "aws_iam_role" "state" {
  for_each = var.environment_account_ids

  name               = "indus-${each.key}-terraform-state"
  assume_role_policy = data.aws_iam_policy_document.state_assume[each.key].json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "state" {
  for_each = var.environment_account_ids

  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["environments/${each.key}/*"]
    }
  }
  statement {
    actions   = ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.state.arn}/environments/${each.key}/*"]
  }
  statement {
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.shared.arn]
  }
}

resource "aws_iam_role_policy" "state" {
  for_each = var.environment_account_ids

  name   = "state-${each.key}"
  role   = aws_iam_role.state[each.key].id
  policy = data.aws_iam_policy_document.state[each.key].json
}

data "aws_iam_policy_document" "kms" {
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid = "ServiceEncryption"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]
    resources = ["*"]
    principals {
      type = "Service"
      identifiers = [
        "cloudwatch.amazonaws.com",
        "delivery.logs.amazonaws.com",
        "logs.${var.aws_region}.amazonaws.com",
        "rds.amazonaws.com",
        "secretsmanager.amazonaws.com",
        "sns.amazonaws.com",
      ]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "data" {
  description             = "${local.name} managed data encryption"
  deletion_window_in_days = local.production ? 30 : 14
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.kms.json
  tags                    = local.common_tags
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.data.key_id
}

resource "aws_kms_key" "logs" {
  description             = "${local.name} logs encryption"
  deletion_window_in_days = local.production ? 30 : 14
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.kms.json
  tags                    = local.common_tags
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${local.name}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

resource "aws_secretsmanager_secret" "workload" {
  for_each = local.secret_names

  name                    = each.value
  description             = "Operator-managed ${each.key} runtime configuration; value is not managed by Terraform"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = local.production ? 30 : 7
  tags                    = merge(local.common_tags, { Workload = each.key })
}

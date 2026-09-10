data "aws_iam_policy_document" "dr_kms" {
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
    sid = "BackupEncryption"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "dr" {
  provider = aws.edge

  description             = "${local.name} cross-region recovery copies"
  deletion_window_in_days = local.production ? 30 : 14
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.dr_kms.json
  tags                    = local.common_tags
}

resource "aws_kms_alias" "dr" {
  provider = aws.edge

  name          = "alias/${local.name}-dr"
  target_key_id = aws_kms_key.dr.key_id
}

resource "aws_backup_vault" "primary" {
  name        = local.name
  kms_key_arn = aws_kms_key.data.arn
  tags        = local.common_tags
}

resource "aws_backup_vault" "dr" {
  provider = aws.edge

  name        = "${local.name}-dr"
  kms_key_arn = aws_kms_key.dr.arn
  tags        = local.common_tags
}

resource "aws_backup_vault_lock_configuration" "primary" {
  count = local.production ? 1 : 0

  backup_vault_name   = aws_backup_vault.primary.name
  changeable_for_days = 3
  min_retention_days  = 35
  max_retention_days  = 365
}

resource "aws_backup_vault_lock_configuration" "dr" {
  provider = aws.edge
  count    = local.production ? 1 : 0

  backup_vault_name   = aws_backup_vault.dr.name
  changeable_for_days = 3
  min_retention_days  = 35
  max_retention_days  = 365
}

data "aws_iam_policy_document" "backup_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${local.name}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  for_each = toset([
    "AWSBackupServiceRolePolicyForBackup",
    "AWSBackupServiceRolePolicyForS3Backup",
    "AWSBackupServiceRolePolicyForRestores",
    "AWSBackupServiceRolePolicyForS3Restore",
  ])

  role       = aws_iam_role.backup.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/${each.value}"
}

resource "aws_backup_plan" "this" {
  name = local.name

  rule {
    rule_name                = "daily-cross-region"
    target_vault_name        = aws_backup_vault.primary.name
    schedule                 = "cron(0 7 * * ? *)"
    start_window             = 60
    completion_window        = 360
    enable_continuous_backup = true

    lifecycle {
      cold_storage_after = 30
      delete_after       = local.production ? 365 : 90
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        cold_storage_after = 30
        delete_after       = local.production ? 365 : 90
      }
    }

    recovery_point_tags = local.common_tags
  }

  tags = local.common_tags
}

resource "aws_backup_selection" "tagged" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${local.name}-tagged-resources"
  plan_id      = aws_backup_plan.this.id
  resources    = ["*"]

  condition {
    string_equals {
      key   = "aws:ResourceTag/Project"
      value = var.project
    }
    string_equals {
      key   = "aws:ResourceTag/Environment"
      value = var.environment
    }
  }

  depends_on = [aws_iam_role_policy_attachment.backup]
}

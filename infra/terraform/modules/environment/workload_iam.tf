locals {
  workload_service_accounts = {
    platform_api      = "indus/platform-api"
    sidekiq           = "indus/sidekiq"
    platform_outbox   = "indus/platform-outbox"
    reports_consumer  = "indus/reports-consumer"
    research_worker   = "indus/research-worker"
    market_data       = "indus/market-data"
    database_migrator = "indus/database-migrator"
    web_publisher     = "indus/web-publisher"
    otel_collector    = "observability/otel-collector"
    load_balancer     = "kube-system/aws-load-balancer-controller"
  }

  oidc_provider_host = replace(aws_iam_openid_connect_provider.eks.url, "https://", "")
}

data "aws_iam_policy_document" "database_migrator" {
  statement {
    sid       = "ReadMigrationDatabaseSecret"
    actions   = ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.workload["database_migration"].arn]
  }
  statement {
    sid       = "DecryptMigrationDatabaseSecret"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "database_migrator" {
  name   = "database-migration"
  role   = aws_iam_role.workload["database_migrator"].id
  policy = data.aws_iam_policy_document.database_migrator.json
}

data "aws_iam_policy_document" "workload_assume" {
  for_each = local.workload_service_accounts

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:sub"
      values   = ["system:serviceaccount:${each.value}"]
    }
  }
}

resource "aws_iam_role" "workload" {
  for_each = local.workload_service_accounts

  name                 = "${local.name}-${replace(each.key, "_", "-")}"
  assume_role_policy   = data.aws_iam_policy_document.workload_assume[each.key].json
  max_session_duration = 3600
  tags                 = merge(local.common_tags, { ServiceAccount = each.value })
}

data "aws_iam_policy_document" "platform_api" {
  statement {
    sid       = "ReadOwnRuntimeSecret"
    actions   = ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.workload["platform_api"].arn]
  }
  statement {
    sid       = "UseRuntimeKey"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [aws_kms_key.data.arn]
  }
  statement {
    sid       = "ManageReportArtifacts"
    actions   = ["s3:AbortMultipartUpload", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]
    resources = [aws_s3_bucket.this["artifacts"].arn, "${aws_s3_bucket.this["artifacts"].arn}/*"]
  }
  statement {
    sid = "PublishDomainEvents"
    actions = [
      "kafka-cluster:Connect",
      "kafka-cluster:DescribeCluster",
      "kafka-cluster:DescribeTopic",
      "kafka-cluster:WriteData",
    ]
    resources = [
      aws_msk_serverless_cluster.this.arn,
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":topic/")}/*",
    ]
  }
}

resource "aws_iam_role_policy" "platform_api" {
  for_each = toset(["platform_api", "sidekiq", "platform_outbox", "reports_consumer"])

  name   = "runtime"
  role   = aws_iam_role.workload[each.key].id
  policy = data.aws_iam_policy_document.platform_api.json
}

data "aws_iam_policy_document" "redis_connect" {
  statement {
    sid       = "ConnectAsApplicationCacheUser"
    actions   = ["elasticache:Connect"]
    resources = [aws_elasticache_serverless_cache.this.arn, aws_elasticache_user.application.arn]
  }
}

resource "aws_iam_role_policy" "redis_connect" {
  for_each = toset(["platform_api", "sidekiq"])

  name   = "redis-connect"
  role   = aws_iam_role.workload[each.key].id
  policy = data.aws_iam_policy_document.redis_connect.json
}

data "aws_iam_policy_document" "research_worker" {
  statement {
    sid       = "ReadOwnRuntimeSecret"
    actions   = ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.workload["research_worker"].arn]
  }
  statement {
    sid       = "UseRuntimeKey"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [aws_kms_key.data.arn]
  }
  statement {
    sid       = "ManageReportArtifacts"
    actions   = ["s3:AbortMultipartUpload", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]
    resources = [aws_s3_bucket.this["artifacts"].arn, "${aws_s3_bucket.this["artifacts"].arn}/*"]
  }
  statement {
    sid = "WorkflowDomainEvents"
    actions = [
      "kafka-cluster:Connect",
      "kafka-cluster:DescribeCluster",
      "kafka-cluster:DescribeGroup",
      "kafka-cluster:DescribeTopic",
      "kafka-cluster:ReadData",
      "kafka-cluster:WriteData",
    ]
    resources = [
      aws_msk_serverless_cluster.this.arn,
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":topic/")}/*",
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":group/")}/*",
    ]
  }
}

resource "aws_iam_role_policy" "research_worker" {
  name   = "runtime"
  role   = aws_iam_role.workload["research_worker"].id
  policy = data.aws_iam_policy_document.research_worker.json
}

data "aws_iam_policy_document" "market_data" {
  statement {
    sid       = "ReadOwnRuntimeSecret"
    actions   = ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.workload["market_data"].arn]
  }
  statement {
    sid       = "UseRuntimeKey"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [aws_kms_key.data.arn]
  }
  statement {
    sid       = "ArchiveRawEvents"
    actions   = ["s3:AbortMultipartUpload", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]
    resources = [aws_s3_bucket.this["raw-events"].arn, "${aws_s3_bucket.this["raw-events"].arn}/*"]
  }
  statement {
    sid = "MarketTopics"
    actions = [
      "kafka-cluster:AlterGroup",
      "kafka-cluster:AlterTransactionalId",
      "kafka-cluster:Connect",
      "kafka-cluster:DescribeCluster",
      "kafka-cluster:DescribeGroup",
      "kafka-cluster:DescribeTopic",
      "kafka-cluster:DescribeTransactionalId",
      "kafka-cluster:ReadData",
      "kafka-cluster:WriteData",
    ]
    resources = [
      aws_msk_serverless_cluster.this.arn,
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":topic/")}/*",
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":group/")}/*",
      "${replace(aws_msk_serverless_cluster.this.arn, ":cluster/", ":transactional-id/")}/*",
    ]
  }
}

resource "aws_iam_role_policy" "market_data" {
  name   = "runtime"
  role   = aws_iam_role.workload["market_data"].id
  policy = data.aws_iam_policy_document.market_data.json
}

data "aws_iam_policy_document" "web_publisher" {
  statement {
    sid       = "PublishWebRelease"
    actions   = ["s3:DeleteObject", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]
    resources = [aws_s3_bucket.this["web"].arn, "${aws_s3_bucket.this["web"].arn}/*"]
  }
  statement {
    sid       = "EncryptWebAssets"
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.data.arn]
  }
  statement {
    sid       = "InvalidateReleaseEntryPoints"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.this.arn]
  }
}

resource "aws_iam_role_policy" "web_publisher" {
  name   = "publish"
  role   = aws_iam_role.workload["web_publisher"].id
  policy = data.aws_iam_policy_document.web_publisher.json
}

data "aws_iam_policy_document" "otel" {
  statement {
    sid = "RemoteWrite"
    actions = [
      "aps:RemoteWrite",
      "aps:GetSeries",
      "aps:GetLabels",
      "aps:GetMetricMetadata",
    ]
    resources = [aws_prometheus_workspace.this.arn]
  }
  statement {
    sid = "PublishLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.application.arn}:*"]
  }
  statement {
    sid = "PublishTraces"
    actions = [
      "xray:GetSamplingRules",
      "xray:GetSamplingStatisticSummaries",
      "xray:GetSamplingTargets",
      "xray:PutTelemetryRecords",
      "xray:PutTraceSegments",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "otel" {
  name   = "publish"
  role   = aws_iam_role.workload["otel_collector"].id
  policy = data.aws_iam_policy_document.otel.json
}

data "aws_iam_policy_document" "load_balancer" {
  statement {
    sid = "ReadInfrastructure"
    actions = [
      "acm:DescribeCertificate",
      "acm:ListCertificates",
      "cognito-idp:DescribeUserPoolClient",
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeAddresses",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeCoipPools",
      "ec2:DescribeInstances",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeTags",
      "ec2:DescribeVpcPeeringConnections",
      "ec2:DescribeVpcs",
      "ec2:GetCoipPoolUsage",
      "ec2:GetSecurityGroupsForVpc",
      "elasticloadbalancing:DescribeListenerAttributes",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeSSLPolicies",
      "elasticloadbalancing:DescribeTags",
      "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTargetHealth",
      "iam:GetServerCertificate",
      "iam:ListServerCertificates",
      "shield:DescribeProtection",
      "shield:GetSubscriptionState",
      "shield:ListProtections",
      "waf-regional:GetWebACLForResource",
      "waf-regional:GetWebACL",
      "waf-regional:AssociateWebACL",
      "waf-regional:DisassociateWebACL",
      "wafv2:GetWebACLForResource",
      "wafv2:GetWebACL",
      "wafv2:AssociateWebACL",
      "wafv2:DisassociateWebACL",
    ]
    resources = ["*"]
  }
  statement {
    sid = "ManageTargetBindings"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "elasticloadbalancing:DeregisterTargets",
      "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
      "elasticloadbalancing:RegisterTargets",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = [var.project]
    }
  }
}

resource "aws_iam_role_policy" "load_balancer" {
  name   = "controller"
  role   = aws_iam_role.workload["load_balancer"].id
  policy = data.aws_iam_policy_document.load_balancer.json
}

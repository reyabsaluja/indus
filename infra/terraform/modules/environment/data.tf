resource "aws_security_group" "database" {
  name        = "${local.name}-aurora"
  description = "PostgreSQL from RDS Proxy only"
  vpc_id      = aws_vpc.this.id
  tags        = merge(local.common_tags, { Name = "${local.name}-aurora" })
}

resource "aws_security_group" "rds_proxy" {
  name        = "${local.name}-rds-proxy"
  description = "RDS Proxy from EKS workloads"
  vpc_id      = aws_vpc.this.id
  tags        = merge(local.common_tags, { Name = "${local.name}-rds-proxy" })
}

resource "aws_vpc_security_group_ingress_rule" "proxy_from_eks" {
  security_group_id            = aws_security_group.rds_proxy.id
  referenced_security_group_id = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from EKS nodes"
}

resource "aws_vpc_security_group_egress_rule" "proxy_to_database" {
  security_group_id            = aws_security_group.rds_proxy.id
  referenced_security_group_id = aws_security_group.database.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL to Aurora"
}

resource "aws_vpc_security_group_ingress_rule" "database_from_proxy" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.rds_proxy.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from RDS Proxy"
}

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = values(aws_subnet.database)[*].id
  tags       = local.common_tags
}

resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${local.name}-aurora-postgresql17"
  family      = "aurora-postgresql17"
  description = "Audited Indus Aurora PostgreSQL settings"
  tags        = local.common_tags

  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "500"
    apply_method = "immediate"
  }

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier                  = local.name
  engine                              = "aurora-postgresql"
  engine_mode                         = "provisioned"
  engine_version                      = "17.5"
  database_name                       = "indus"
  master_username                     = "indus_admin"
  manage_master_user_password         = true
  master_user_secret_kms_key_id       = aws_kms_key.data.arn
  port                                = 5432
  db_subnet_group_name                = aws_db_subnet_group.this.name
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.this.name
  vpc_security_group_ids              = [aws_security_group.database.id]
  storage_encrypted                   = true
  kms_key_id                          = aws_kms_key.data.arn
  iam_database_authentication_enabled = true
  backup_retention_period             = local.production ? 35 : 7
  preferred_backup_window             = "05:00-06:00"
  preferred_maintenance_window        = "sun:06:00-sun:07:00"
  copy_tags_to_snapshot               = true
  deletion_protection                 = local.production
  skip_final_snapshot                 = !local.production
  final_snapshot_identifier           = local.production ? "${local.name}-final" : null
  apply_immediately                   = false
  enabled_cloudwatch_logs_exports     = ["postgresql"]

  serverlessv2_scaling_configuration {
    min_capacity = var.database_min_acu
    max_capacity = var.database_max_acu
  }

  tags = local.common_tags

  lifecycle {
    precondition {
      condition     = !local.production || var.database_instance_count >= 2
      error_message = "Production Aurora must have a writer and at least one reader."
    }
    precondition {
      condition     = !local.production || var.database_min_acu >= 2
      error_message = "Production Aurora minimum capacity must be at least 2 ACU."
    }
  }
}

resource "aws_rds_cluster_instance" "this" {
  count = var.database_instance_count

  identifier                      = "${local.name}-${count.index + 1}"
  cluster_identifier              = aws_rds_cluster.this.id
  instance_class                  = "db.serverless"
  engine                          = aws_rds_cluster.this.engine
  engine_version                  = aws_rds_cluster.this.engine_version
  db_subnet_group_name            = aws_db_subnet_group.this.name
  auto_minor_version_upgrade      = true
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.data.arn
  monitoring_interval             = 0
  publicly_accessible             = false
  tags                            = local.common_tags
}

data "aws_iam_policy_document" "rds_proxy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_proxy" {
  name               = "${local.name}-rds-proxy"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "rds_proxy" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for key in local.rds_proxy_secret_keys : aws_secretsmanager_secret.workload[key].arn]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.data.arn]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "rds_proxy" {
  name   = "database-secret"
  role   = aws_iam_role.rds_proxy.id
  policy = data.aws_iam_policy_document.rds_proxy.json
}

resource "aws_db_proxy" "this" {
  name                   = local.name
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = values(aws_subnet.private)[*].id
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  require_tls            = true
  idle_client_timeout    = 1800
  debug_logging          = false

  dynamic "auth" {
    for_each = local.rds_proxy_secret_keys

    content {
      auth_scheme = "SECRETS"
      iam_auth    = "DISABLED"
      secret_arn  = aws_secretsmanager_secret.workload[auth.value].arn
    }
  }

  tags = local.common_tags
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 90
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "this" {
  db_cluster_identifier = aws_rds_cluster.this.id
  db_proxy_name         = aws_db_proxy.this.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
}

resource "aws_security_group" "redis" {
  name        = "${local.name}-redis"
  description = "Encrypted Redis from EKS workloads"
  vpc_id      = aws_vpc.this.id
  tags        = merge(local.common_tags, { Name = "${local.name}-redis" })
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_eks" {
  security_group_id            = aws_security_group.redis.id
  referenced_security_group_id = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "TLS Redis from EKS nodes"
}

resource "aws_elasticache_user" "application" {
  user_id   = "${var.project}-${var.environment}-app"
  user_name = "${var.project}-${var.environment}-app"
  access_string = join(" ", [
    "on",
    "~*",
    "+bitfield", "+bitfield_ro", "+brpop", "+client|setinfo", "+del", "+discard", "+evalsha", "+exec",
    "+exists", "+expire", "+get", "+hello", "+hdel", "+hget", "+hgetall", "+hincrby", "+hlen",
    "+hmget", "+hset", "+hsetnx", "+incr", "+incrby", "+info", "+lindex", "+llen", "+lmove",
    "+lpop", "+lpush", "+lrange", "+lrem", "+mget", "+mset", "+multi", "+ping", "+pttl",
    "+rpop", "+rpush", "+sadd", "+scard", "+script|load", "+set", "+sismember", "+smembers",
    "+srem", "+ttl", "+type", "+unlink", "+zadd", "+zcard", "+zincrby", "+zrange", "+zrem",
    "+zpopmin", "+zremrangebyrank", "+zremrangebyscore",
  ])
  engine = "valkey"

  authentication_mode {
    type = "iam"
  }

  tags = local.common_tags
}

resource "aws_elasticache_user_group" "this" {
  engine        = "valkey"
  user_group_id = "${var.project}-${var.environment}"
  user_ids      = [aws_elasticache_user.application.user_id]
  tags          = local.common_tags
}

resource "aws_elasticache_serverless_cache" "this" {
  engine                   = "valkey"
  name                     = local.name
  major_engine_version     = "8"
  kms_key_id               = aws_kms_key.data.arn
  security_group_ids       = [aws_security_group.redis.id]
  subnet_ids               = values(aws_subnet.database)[*].id
  user_group_id            = aws_elasticache_user_group.this.user_group_id
  snapshot_retention_limit = local.production ? 15 : 3
  daily_snapshot_time      = "04:00"

  cache_usage_limits {
    data_storage {
      maximum = local.production ? 100 : 20
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = local.production ? 100000 : 5000
    }
  }

  tags = local.common_tags
}

resource "aws_security_group" "msk" {
  name        = "${local.name}-msk"
  description = "MSK Serverless IAM endpoint from EKS workloads"
  vpc_id      = aws_vpc.this.id
  tags        = merge(local.common_tags, { Name = "${local.name}-msk" })
}

resource "aws_vpc_security_group_ingress_rule" "msk_from_eks" {
  security_group_id            = aws_security_group.msk.id
  referenced_security_group_id = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  from_port                    = 9098
  to_port                      = 9098
  ip_protocol                  = "tcp"
  description                  = "MSK IAM TLS from EKS nodes"
}

resource "aws_msk_serverless_cluster" "this" {
  cluster_name = local.name

  vpc_config {
    subnet_ids         = values(aws_subnet.private)[*].id
    security_group_ids = [aws_security_group.msk.id]
  }

  client_authentication {
    sasl {
      iam {
        enabled = true
      }
    }
  }

  tags = local.common_tags
}

locals {
  buckets = {
    artifacts  = { versioning = true, expiration_days = 2555 }
    audit      = { versioning = true, expiration_days = 2555 }
    raw-events = { versioning = true, expiration_days = 365 }
    web        = { versioning = true, expiration_days = 90 }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket        = "${local.name}-${each.key}-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
  tags          = merge(local.common_tags, { DataClass = each.key })
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule { object_ownership = each.key == "audit" ? "BucketOwnerPreferred" : "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_acl" "audit" {
  bucket = aws_s3_bucket.this["audit"].id
  acl    = "log-delivery-write"

  depends_on = [aws_s3_bucket_ownership_controls.this, aws_s3_bucket_public_access_block.this]
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  rule {
    id     = "retention"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = each.value.expiration_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.this]
}

data "aws_iam_policy_document" "bucket_transport" {
  for_each = aws_s3_bucket.this

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value.arn, "${each.value.arn}/*"]
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

resource "aws_s3_bucket_policy" "transport" {
  for_each = { for key, bucket in aws_s3_bucket.this : key => bucket if key != "web" }

  bucket = each.value.id
  policy = data.aws_iam_policy_document.bucket_transport[each.key].json
}

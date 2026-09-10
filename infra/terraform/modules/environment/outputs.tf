output "cluster" {
  value = {
    name                      = aws_eks_cluster.this.name
    vpc_id                    = aws_vpc.this.id
    endpoint                  = aws_eks_cluster.this.endpoint
    certificate_authority     = aws_eks_cluster.this.certificate_authority[0].data
    oidc_provider_arn         = aws_iam_openid_connect_provider.eks.arn
    cluster_security_group_id = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  }
}

output "edge" {
  value = {
    application_url            = "https://${var.domain_name}"
    cloudfront_distribution_id = aws_cloudfront_distribution.this.id
    api_target_group_arn       = aws_lb_target_group.api.arn
    stream_target_group_arn    = aws_lb_target_group.stream.arn
  }
}

output "identity" {
  value = {
    user_pool_id = aws_cognito_user_pool.this.id
    client_id    = aws_cognito_user_pool_client.web.id
    issuer       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
    hosted_ui    = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.aws_region}.amazoncognito.com"
  }
}

output "data_endpoints" {
  value = {
    rds_proxy = aws_db_proxy.this.endpoint
    redis = {
      endpoint   = aws_elasticache_serverless_cache.this.endpoint[0].address
      port       = aws_elasticache_serverless_cache.this.endpoint[0].port
      cache_name = aws_elasticache_serverless_cache.this.name
      user_name  = aws_elasticache_user.application.user_name
    }
    msk_bootstrap_brokers = aws_msk_serverless_cluster.this.bootstrap_brokers_sasl_iam
    artifact_bucket       = aws_s3_bucket.this["artifacts"].id
    raw_events_bucket     = aws_s3_bucket.this["raw-events"].id
    web_bucket            = aws_s3_bucket.this["web"].id
  }
}

output "secret_arns" {
  value = { for key, secret in aws_secretsmanager_secret.workload : key => secret.arn }
}

output "workload_role_arns" {
  value = { for key, role in aws_iam_role.workload : key => role.arn }
}

output "observability" {
  value = {
    prometheus_workspace_id     = aws_prometheus_workspace.this.id
    prometheus_remote_write_url = "${aws_prometheus_workspace.this.prometheus_endpoint}api/v1/remote_write"
    grafana_endpoint            = aws_grafana_workspace.this.endpoint
    alert_topic_arn             = aws_sns_topic.alerts.arn
  }
}

output "shared_ecr_repository_urls" {
  value = var.shared_ecr_repository_urls
}

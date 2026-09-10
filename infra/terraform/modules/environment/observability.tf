resource "aws_sns_topic" "alerts" {
  name              = "${local.name}-alerts"
  kms_master_key_id = aws_kms_key.logs.id
  tags              = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  for_each = var.alert_email_endpoints

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_prometheus_workspace" "this" {
  alias = local.name
  tags  = local.common_tags
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/eks/${local.name}/application"
  retention_in_days = local.production ? 365 : 30
  kms_key_id        = aws_kms_key.logs.arn
  tags              = local.common_tags
}

data "aws_iam_policy_document" "amp_alert_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["aps.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amp_alert" {
  name               = "${local.name}-amp-alert"
  assume_role_policy = data.aws_iam_policy_document.amp_alert_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "amp_alert" {
  name = "publish-alerts"
  role = aws_iam_role.amp_alert.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:GetTopicAttributes", "sns:Publish"]
      Resource = aws_sns_topic.alerts.arn
    }]
  })
}

resource "aws_prometheus_alert_manager_definition" "this" {
  workspace_id = aws_prometheus_workspace.this.id
  definition = yamlencode({
    alertmanager_config = {
      route = {
        receiver        = "operations"
        group_by        = ["alertname", "service", "severity"]
        group_wait      = "30s"
        group_interval  = "5m"
        repeat_interval = "4h"
      }
      receivers = [{
        name = "operations"
        sns_configs = [{
          topic_arn     = aws_sns_topic.alerts.arn
          send_resolved = true
          sigv4 = {
            region   = var.aws_region
            role_arn = aws_iam_role.amp_alert.arn
          }
        }]
      }]
    }
  })
}

resource "aws_prometheus_rule_group_namespace" "slo" {
  name         = "indus-slo"
  workspace_id = aws_prometheus_workspace.this.id
  data = yamlencode({
    groups = [
      {
        name = "api-slo"
        rules = [
          {
            alert       = "PlatformApiHighErrorRate"
            expr        = "sum(rate(http_server_requests_total{service=\"platform-api\",status=~\"5..\"}[5m])) / clamp_min(sum(rate(http_server_requests_total{service=\"platform-api\"}[5m])), 0.001) > 0.02"
            for         = "10m"
            labels      = { severity = "page", service = "platform-api" }
            annotations = { summary = "Rails API error rate exceeds 2%", runbook = "docs/runbooks/incident-response.md#platform-api" }
          },
          {
            alert       = "PlatformApiLatencyBudgetBurn"
            expr        = "histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{service=\"platform-api\"}[10m]))) > 0.3"
            for         = "15m"
            labels      = { severity = "ticket", service = "platform-api" }
            annotations = { summary = "Rails API p95 exceeds 300ms", runbook = "docs/runbooks/incident-response.md#platform-api" }
          }
        ]
      },
      {
        name = "market-slo"
        rules = [
          {
            alert       = "MarketFeedStale"
            expr        = "max(indus_market_feed_staleness_seconds) > 30"
            for         = "5m"
            labels      = { severity = "page", service = "market-data" }
            annotations = { summary = "Market feed is stale", runbook = "docs/runbooks/incident-response.md#market-data" }
          },
          {
            alert       = "KafkaAcknowledgedEventLoss"
            expr        = "increase(indus_kafka_acknowledged_events_lost_total[5m]) > 0"
            for         = "0m"
            labels      = { severity = "page", service = "market-data" }
            annotations = { summary = "A Kafka event was acknowledged then lost", runbook = "docs/runbooks/incident-response.md#event-loss" }
          }
        ]
      },
      {
        name = "workflow-slo"
        rules = [{
          alert       = "ReportWorkflowTerminalSloBurn"
          expr        = "sum(rate(indus_report_workflows_terminal_total{outcome!~\"complete|actionable_failure\"}[10m])) / clamp_min(sum(rate(indus_report_workflows_started_total[10m])), 0.001) > 0.01"
          for         = "10m"
          labels      = { severity = "page", service = "research-worker" }
          annotations = { summary = "Report workflow terminal SLO is burning", runbook = "docs/runbooks/incident-response.md#report-workflows" }
        }]
      }
    ]
  })
}

data "aws_iam_policy_document" "grafana_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["grafana.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "grafana" {
  name               = "${local.name}-grafana"
  assume_role_policy = data.aws_iam_policy_document.grafana_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "grafana" {
  name = "read-observability"
  role = aws_iam_role.grafana.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "aps:GetLabels",
          "aps:GetMetricMetadata",
          "aps:GetSeries",
          "aps:QueryMetrics",
        ]
        Resource = aws_prometheus_workspace.this.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarmsForMetric",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "logs:DescribeLogGroups",
          "logs:GetLogEvents",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:GetQueryResults",
          "xray:GetTraceSummaries",
          "xray:BatchGetTraces",
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_grafana_workspace" "this" {
  name                      = local.name
  account_access_type       = "CURRENT_ACCOUNT"
  authentication_providers  = ["AWS_SSO"]
  permission_type           = "CUSTOMER_MANAGED"
  role_arn                  = aws_iam_role.grafana.arn
  data_sources              = ["CLOUDWATCH", "PROMETHEUS", "XRAY"]
  notification_destinations = ["SNS"]
  tags                      = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_target_errors" {
  alarm_name          = "${local.name}-alb-target-5xx"
  alarm_description   = "User-visible API or stream target 5xx; see incident response runbook."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions = {
    LoadBalancer = aws_lb.edge.arn_suffix
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "${local.name}-aurora-cpu"
  alarm_description   = "Aurora CPU saturation; see capacity runbook."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "missing"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.this.id
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_dashboard" "slo" {
  dashboard_name = "${local.name}-slo"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title = "Edge requests and target errors", region = var.aws_region, view = "timeSeries", stacked = false
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.edge.arn_suffix, { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum", yAxis = "right" }],
          ]
          period = 300
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title = "Aurora capacity and connections", region = var.aws_region, view = "timeSeries"
          metrics = [
            ["AWS/RDS", "ServerlessDatabaseCapacity", "DBClusterIdentifier", aws_rds_cluster.this.id],
            [".", "DatabaseConnections", ".", ".", { yAxis = "right" }],
          ]
          period = 300
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title = "CloudFront error rate", region = "us-east-1", view = "timeSeries"
          metrics = [
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", aws_cloudfront_distribution.this.id, "Region", "Global"],
            [".", "4xxErrorRate", ".", ".", ".", "."],
          ]
          period = 300
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title   = "WAF blocked requests", region = "us-east-1", view = "timeSeries"
          metrics = [["AWS/WAFV2", "BlockedRequests", "WebACL", local.name, "Rule", "ALL", "Region", "Global"]]
          period  = 300
        }
      }
    ]
  })
}

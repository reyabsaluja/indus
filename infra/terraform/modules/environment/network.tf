resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, { Name = local.name })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = local.name })
}

resource "aws_subnet" "public" {
  for_each = { for index, az in local.azs : az => index }

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = local.public_subnet_cidrs[each.value]
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name                     = "${local.name}-public-${each.key}"
    "kubernetes.io/role/elb" = "1"
  })
}

resource "aws_subnet" "private" {
  for_each = { for index, az in local.azs : az => index }

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = local.private_subnet_cidrs[each.value]

  tags = merge(local.common_tags, {
    Name                              = "${local.name}-private-${each.key}"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

resource "aws_subnet" "database" {
  for_each = { for index, az in local.azs : az => index }

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = local.database_subnet_cidrs[each.value]

  tags = merge(local.common_tags, { Name = "${local.name}-database-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name}-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  route_table_id = aws_route_table.public.id
  subnet_id      = each.value.id
}

locals {
  nat_gateway_azs = var.single_nat_gateway ? toset([local.azs[0]]) : toset(local.azs)
}

resource "aws_eip" "nat" {
  for_each = local.nat_gateway_azs
  domain   = "vpc"

  tags = merge(local.common_tags, { Name = "${local.name}-nat-${each.key}" })
}

resource "aws_nat_gateway" "this" {
  for_each = local.nat_gateway_azs

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags       = merge(local.common_tags, { Name = "${local.name}-${each.key}" })
  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "private" {
  for_each = aws_subnet.private

  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name}-private-${each.key}" })
}

resource "aws_route" "private_internet" {
  for_each = aws_route_table.private

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id = aws_nat_gateway.this[
    var.single_nat_gateway ? local.azs[0] : each.key
  ].id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  route_table_id = aws_route_table.private[each.key].id
  subnet_id      = each.value.id
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name}-database" })
}

resource "aws_route_table_association" "database" {
  for_each = aws_subnet.database

  route_table_id = aws_route_table.database.id
  subnet_id      = each.value.id
}

resource "aws_cloudwatch_log_group" "vpc_flow" {
  name              = "/aws/vpc/${local.name}/flow"
  retention_in_days = local.production ? 365 : 30
  kms_key_id        = aws_kms_key.logs.arn
  tags              = local.common_tags
}

data "aws_iam_policy_document" "flow_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow" {
  name               = "${local.name}-vpc-flow"
  assume_role_policy = data.aws_iam_policy_document.flow_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "flow" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.vpc_flow.arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow" {
  name   = "publish"
  role   = aws_iam_role.flow.id
  policy = data.aws_iam_policy_document.flow.json
}

resource "aws_flow_log" "this" {
  iam_role_arn    = aws_iam_role.flow.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.this.id
  tags            = local.common_tags
}

resource "aws_security_group" "endpoints" {
  name        = "${local.name}-endpoints"
  description = "TLS from private workloads to VPC endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "TLS from private subnets"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.private_subnet_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name}-endpoints" })
}

locals {
  interface_endpoints = toset([
    "ecr.api",
    "ecr.dkr",
    "kms",
    "logs",
    "secretsmanager",
    "sts",
  ])
}

resource "aws_vpc_endpoint" "interface" {
  for_each = local.interface_endpoints

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = values(aws_subnet.private)[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  tags                = merge(local.common_tags, { Name = "${local.name}-${each.key}" })
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(values(aws_route_table.private)[*].id, [aws_route_table.database.id])
  tags              = merge(local.common_tags, { Name = "${local.name}-s3" })
}

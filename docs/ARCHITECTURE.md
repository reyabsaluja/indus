# Indus Architecture and Operating Model

## Purpose

Indus is a financial intelligence platform for authenticated research of public equities and cryptocurrencies. It combines live market data, company fundamentals, model-assisted analysis, and generated research reports behind explicit authorization, reliability, and operational boundaries.

This document is the durable architecture reference for the repository. It records system ownership, trust boundaries, operating constraints, and recovery expectations.

## Platform overview

| Concern | Technology and ownership |
|---|---|
| Web application | React, TypeScript, Vite, TanStack Query, TanStack Router, Tailwind CSS |
| Product API | Ruby on Rails API, REST, OpenAPI, Active Record, Pundit |
| Market data | Rust, Tokio, Axum, Serde, rustls, Alpaca provider boundary |
| Workflows | Sidekiq for ordinary jobs and Temporal for durable report workflows |
| Contracts | OpenAPI for browser APIs; Protocol Buffers and Buf for internal events |
| Data | Aurora PostgreSQL with RDS Proxy; partitioned PostgreSQL market-data tables |
| Messaging and cache | MSK Serverless with Kafka; ElastiCache for Redis |
| AI | Application-owned ModelGateway with the Google Gemini REST adapter |
| Identity | Cognito with OAuth 2.0/OIDC, JWT validation, MFA, and scoped roles |
| Storage | S3 for report artifacts, exports, raw-event samples, and audit evidence |
| Runtime | EKS, ECR, Helm, Argo CD, Terraform, GitHub Actions with AWS OIDC |
| Edge | Route 53, ACM, CloudFront, AWS WAF, and Application Load Balancer |
| Observability | OpenTelemetry, CloudWatch, Managed Prometheus, Managed Grafana, and trace export |

## System boundaries

### Web application

`apps/web` owns presentation, accessibility, navigation, and authenticated browser behavior. It calls Rails through generated OpenAPI types, uses TanStack Query for remote state, and connects to the market-data service through authenticated SSE. It contains no provider credentials, authorization decisions, or direct database access.

### Rails platform API

`apps/platform-api` owns application users, portfolios, positions, favorites, reports, permissions, quotas, idempotency records, audit events, and the transactional outbox. Rails validates Cognito tokens, applies Pundit policy decisions, and enforces persistent invariants with Active Record migrations and database constraints.

Rails owns the fundamentals-provider boundary and ModelGateway. ModelGateway accepts task-specific messages, a prompt version, allowlisted tools, bounded evidence, and a structured output schema. The Gemini adapter normalizes provider responses, usage, timeouts, safety outcomes, and errors so product code remains provider-independent.

### Market-data service

`services/market-data` maintains bounded Alpaca connections, normalizes provider payloads, publishes versioned Kafka events, persists historical data, and exposes authenticated browser SSE. It owns stream backpressure, reconnects, heartbeat monitoring, stale-feed detection, and graceful shutdown. It does not own users, portfolios, reports, or product authorization policy.

### Research workflows

Temporal owns report workflow state, retries, deadlines, cancellation, and recovery. Rails activities load authorized application context; market-data activities request bounded snapshots; ModelGateway activities use versioned prompts and schema-validated output. Report artifacts are immutable S3 objects, while lifecycle state and sources remain in Aurora PostgreSQL.

## Data and event model

Aurora PostgreSQL is the source of truth for transactional records, report metadata, audit records, idempotency keys, the transactional outbox, and historical market data. High-volume market tables are partitioned by time and indexed by symbol and interval. Rails and market-data persistence use distinct database roles and schema ownership.

Kafka topics are versioned contracts. Every event contains an event ID, schema version, producer, occurred-at timestamp, correlation ID, and idempotency key. Consumers tolerate duplicates and reject unsupported versions. The initial topics are:

- `market.bars.v1`
- `market.quotes.v1`
- `reports.lifecycle.v1`
- `portfolios.activity.v1`
- `audit.security.v1`

Redis is a cache, rate-limit, and job-queue dependency, never a source of truth. Cache entries require an owner, TTL, invalidation rule, and documented failure behavior.

## Security model

- Provider credentials are stored in AWS Secrets Manager, encrypted with KMS, and injected only into authorized workloads through IAM roles for service accounts.
- Gemini, Alpaca, and database credentials never appear in browser bundles, Terraform state, logs, tests, or committed files.
- Public APIs are versioned under `/v1`, validate bounded request bodies, use consistent error envelopes, and require idempotency keys for retried writes.
- Cognito authentication is validated at every Rails and Rust trust boundary. Pundit authorizes individual resources after authentication.
- EKS workloads run non-root with read-only root filesystems, resource limits, restricted pod security, and network policies.
- AWS WAF, application rate limits, stream limits, deadlines, and quotas protect public and provider-facing boundaries.
- Audit records retain security-sensitive actions without tokens, credentials, full prompts, or provider payloads.

## Delivery and operations

Terraform owns AWS accounts, networking, EKS, ECR, edge resources, managed data services, secrets containers, encryption, and observability resources. Secret values are supplied outside Terraform and never enter state.

GitHub Actions verifies source, builds signed immutable images, produces SBOMs, scans images, and updates GitOps references through AWS OIDC. Argo CD reconciles reviewed Helm values into EKS. The same immutable image promotes through development, staging, and production.

CloudFront is the public edge: it serves web assets and routes API and stream traffic through WAF and the Application Load Balancer. Route changes use bounded weighted traffic shifts with explicit abort thresholds. No production migration, identity change, or destructive cleanup occurs without a reviewed plan, recovery evidence, and an approved rollback path.

## Reliability objectives

- Rails read API: 99.9% monthly availability and p95 under 300 ms excluding third-party latency.
- Live market stream: 99.9% connection availability during supported market windows and p95 internal event delay under two seconds.
- Report workflows: 99% complete or reach a terminal actionable failure within ten minutes.
- Acknowledged Kafka events are never silently discarded.

Services emit structured logs, OpenTelemetry traces, RED metrics, dependency metrics, deployment metadata, and correlation IDs. Alerts represent user-visible symptoms or error-budget exhaustion and link to an operating runbook.

## Repository layout

```text
apps/
  web/                 React web application
  platform-api/        Rails API
services/
  market-data/         Rust ingestion and streaming service
  research-worker/     Temporal workflow workers
contracts/
  openapi/
  protobuf/
infra/
  terraform/
  helm/
  gitops/
docs/
  architecture/
  runbooks/
  decisions/
```

One ownership boundary belongs to each directory. Public contracts are committed and generated clients are reproducible artifacts. Language-native dependency management remains inside the owning application.

## Verification standard

Every change receives verification proportional to its boundary and blast radius: static analysis, unit and property tests, real PostgreSQL migration tests, request and policy tests, provider-fixture replay, OpenAPI and Protobuf compatibility checks, container integration tests, browser and accessibility coverage, load and failure-injection tests where relevant, Terraform validation and policy checks, and post-deployment smoke checks.

See [QUALITY.md](./QUALITY.md) for executable local and CI verification, and `docs/runbooks/` for operational recovery procedures.

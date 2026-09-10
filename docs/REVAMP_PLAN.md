# Indus Enterprise Revamp Plan

## Purpose

Rebuild Indus as a production-grade financial intelligence platform that demonstrates backend engineering, distributed systems, cloud infrastructure, security, observability, and operational discipline. Preserve working product behavior while replacing the current Next.js and Supabase architecture through small, reversible releases.

This is the target architecture, not a description of the current repository. Do not introduce a target technology until its phase is explicitly started.

## Architectural Principles

- Migrate with a strangler pattern; do not attempt a single cutover rewrite.
- Keep service boundaries justified by ownership, scaling, or failure isolation.
- Use Ruby on Rails for product and business logic.
- Use Rust only for concurrency-sensitive market-data processing and streaming.
- Keep Google Gemini as the initial model provider and access it through an application-owned `ModelGateway`.
- Keep prompts, tools, schemas, and evaluations independent of a specific model so future model changes do not require product rewrites.
- Prefer asynchronous Kafka events between services; use synchronous APIs only when the caller needs an immediate answer.
- Use PostgreSQL for transactional and historical market data until measured scale justifies another datastore.
- Treat schemas, migrations, authorization, observability, and rollback procedures as part of every feature.
- Promote the same immutable container images through development, staging, and production.
- Require measurable reliability and security outcomes instead of technology adoption alone.

## Target Stack

| Concern | Target |
|---|---|
| Web application | React, TypeScript, Vite, TanStack Query, TanStack Router, Tailwind CSS |
| Product API | Ruby on Rails in API mode, REST, OpenAPI, Active Record, Pundit |
| Background work | Sidekiq for ordinary jobs; Temporal for durable multi-step workflows |
| Real-time market data | Rust, Tokio, Axum, Serde, rustls |
| Service contracts | OpenAPI for public HTTP APIs; Protocol Buffers and Buf for internal event schemas |
| Transactional data | Amazon Aurora PostgreSQL, RDS Proxy |
| Historical market data | Partitioned PostgreSQL tables in Amazon Aurora PostgreSQL |
| Cache and job queues | Amazon ElastiCache for Redis |
| Event backbone | Amazon MSK Serverless with Apache Kafka |
| Financial data | Alpaca for live and historical market data; a provider boundary for fundamentals with temporary Yahoo Finance compatibility |
| Models | Application-owned `ModelGateway` with a Google Gemini adapter using the official Gemini REST API |
| Object storage | Amazon S3 for generated reports, exports, raw events, and audit artifacts |
| Identity | Amazon Cognito using OAuth 2.0/OIDC, JWTs, MFA, and scoped roles |
| Containers | Amazon EKS, Amazon ECR, Kubernetes, Helm |
| Delivery | GitHub Actions with AWS OIDC, Argo CD, immutable image promotion |
| Infrastructure | Terraform with reusable modules and isolated environment state |
| Edge | Route 53, ACM, CloudFront, AWS WAF, Application Load Balancer |
| Secrets and encryption | AWS Secrets Manager, KMS, IAM roles for service accounts |
| Observability | OpenTelemetry, Amazon Managed Prometheus, Amazon Managed Grafana, CloudWatch, Tempo-compatible tracing |
| Testing | RSpec, Vitest, Playwright, axe-core, Rust tests, property tests, Testcontainers, contract tests, k6 |
| Supply-chain security | Dependabot, Trivy, SBOM generation, image signing and verification |

Ruby on Rails replaces the previously proposed Go platform API. Adding both Rails and Go would create overlapping backend ownership without a defensible operational benefit.

## System Boundaries

### React Web Application

- Serves the authenticated dashboard, search, company, crypto, report, portfolio, and settings experiences.
- Uses generated API clients from the Rails OpenAPI contract.
- Uses TanStack Query for remote state and a small local store only for ephemeral UI state.
- Connects directly to the Rust streaming endpoint for live market updates.
- Uses an authenticated fetch-based SSE client so Cognito access tokens remain in headers rather than URLs.
- Builds to static assets stored in S3 and distributed through CloudFront.
- Contains no provider credentials or business authorization rules.

### Rails Platform API

- Owns users' application profiles, favorites, portfolios, reports, permissions, and audit records.
- Validates Cognito JWTs and applies resource authorization with Pundit.
- Owns the public REST API and publishes its OpenAPI contract.
- Uses Active Record migrations and database constraints for persistent invariants.
- Owns the fundamentals-provider boundary and preserves current Yahoo Finance behavior only through a temporary compatibility path until its replacement adapter passes shadow verification.
- Coordinates normal asynchronous work with Sidekiq.
- Starts and observes durable report workflows through Temporal.
- Publishes domain events through an outbox table to avoid database/Kafka dual-write loss.
- Does not proxy high-volume market streams through Rails.

### Rust Market Data Service

- Maintains upstream Alpaca WebSocket connections and bounded REST backfills.
- Normalizes provider payloads into versioned internal events.
- Publishes normalized events to Kafka; a bounded consumer writes historical bars and feed measurements to partitioned Aurora PostgreSQL tables.
- Fans live updates out to browsers through authenticated SSE endpoints and rejects credentials supplied in query strings.
- Implements backpressure, reconnection with jitter, heartbeat monitoring, stale-feed detection, and graceful shutdown.
- Exposes health, readiness, metrics, and trace endpoints.
- Does not own users, portfolios, reports, or authorization policy.

### Research Workflow

- Temporal owns the report workflow state, retries, deadlines, cancellation, and recovery.
- Rails activities load authorized portfolio and company context.
- Market-data activities request bounded snapshots rather than opening live streams.
- Model calls pass through `ModelGateway` using versioned prompts, allowlisted schema-validated tools, and server-controlled instructions.
- Generated claims retain source metadata and an as-of timestamp.
- Final report artifacts are stored in S3; metadata and lifecycle state remain in Aurora PostgreSQL.
- Gemini model names, limits, and safety settings are server configuration, never browser input.

### Model Gateway

`ModelGateway` is an application-owned interface, not an external model-routing product. Rails and Temporal activities call it with a task, prompt version, messages, tool definitions, and an output schema. The gateway normalizes responses, usage metadata, errors, timeouts, and tracing so product code does not depend on Gemini request or response objects.

The first adapter uses Google Gemini exclusively through Google's official REST API. Rails does not depend on a language SDK that Google does not officially support. The personal Gemini API token is stored as a secure value in AWS Secrets Manager, injected only into the authorized server-side workload through workload identity, and never committed, placed in Terraform state, logged, or sent to the browser.

Keep model selection separate from the API token and configurable per task, for example chat, explanations, and reports. Prompt templates, tool contracts, and structured output schemas remain in an application-owned versioned catalog. A future model provider is introduced by adding another adapter and mapping the common contracts; no provider switch occurs without golden evaluations and a canary rollout because prompts and tool behavior are not perfectly portable between models.

### Event Backbone

Initial topics:

- `market.bars.v1`
- `market.quotes.v1`
- `reports.lifecycle.v1`
- `portfolios.activity.v1`
- `audit.security.v1`

Every event includes a schema version, event ID, producer, occurred-at timestamp, correlation ID, and idempotency key. Consumers must tolerate duplicates and reject unsupported schema versions explicitly.

## Data Architecture

### Aurora PostgreSQL

Own transactional tables such as users, portfolios, positions, favorites, reports, report sources, workflow references, audit events, idempotency keys, and the transactional outbox. Also store normalized historical bars, derived market aggregates, and feed-health measurements in a dedicated market-data schema.

Use separate database roles and schema ownership for Rails and the market-data writer. Partition high-volume market tables by time, index by symbol and interval, define explicit retention and S3 archival policies, and test query plans against expected data volumes. Introduce a specialized time-series datastore only after production measurements show that PostgreSQL cannot meet documented retention, ingestion, or query objectives.

### Redis

Use separate logical concerns or clusters for caching, rate limiting, and Sidekiq. Every cache entry requires an owner, TTL, invalidation rule, and failure behavior. Redis is not a source of truth.

### Amazon S3

Store immutable report artifacts, data exports, raw ingestion samples used for replay, and compliance evidence. Enable encryption, versioning, lifecycle rules, restricted bucket policies, and access logging.

## API and Security Standards

- Version public endpoints under `/v1` and publish OpenAPI documentation.
- Use cursor pagination, idempotency keys for retried writes, bounded request bodies, and consistent error envelopes.
- Authenticate with Cognito, validate tokens at every Rails or Rust trust boundary, and authorize every resource in Rails; authentication alone is insufficient.
- Keep provider keys in Secrets Manager and expose them only to the owning workload through IAM roles. Store the personal Gemini API token there as a manually supplied secret value, not in source code or Terraform state.
- Encrypt traffic in transit and data at rest with managed KMS keys.
- Apply WAF rules, rate limits, request timeouts, and maximum stream counts.
- Use private subnets for data systems and least-privilege security groups.
- Enforce Kubernetes network policies, non-root containers, read-only root filesystems, resource limits, and restricted pod security standards.
- Record security-sensitive actions in append-oriented audit events without logging secrets, tokens, prompts containing private data, or full provider payloads.
- Generate SBOMs, scan dependencies and images, sign release images, and verify signatures during deployment.

## Reliability and Observability

Define initial service-level objectives before production cutover:

- Rails read API: 99.9% monthly availability; p95 under 300 ms excluding third-party latency.
- Live market stream: 99.9% connection availability during supported market windows; p95 internal event delay under 2 seconds.
- Report workflows: 99% complete or reach a terminal actionable failure within 10 minutes.
- No acknowledged Kafka event may be silently discarded.

All services must emit structured logs, OpenTelemetry traces, RED metrics, dependency metrics, deployment metadata, and correlation IDs. Alerts should map to user-visible symptoms or exhausted error budgets and link to a runbook.

## AWS Topology

- Use separate AWS accounts for shared services, development, staging, and production.
- Provision networking, EKS, data services, DNS, certificates, secrets, and observability through Terraform.
- Run Rails API, Sidekiq, Temporal workers, Rust ingestion, and Rust streaming workloads on EKS.
- Keep managed stateful services outside the cluster: Aurora, ElastiCache, MSK, and S3.
- Use ECR for images and Argo CD for declarative cluster reconciliation.
- Use GitHub Actions only to verify changes, build and sign images, publish artifacts, and update GitOps references.
- Use CloudFront as the single public origin: serve React assets from S3 and route `/api/*` to Rails and `/stream/*` to Rust through WAF and an Application Load Balancer.
- Back up Aurora, version critical S3 buckets, test restore procedures, and document regional recovery objectives.

## Repository Direction

Move toward a monorepo while the system is one product:

```text
apps/
  web/                 React/Vite application
  platform-api/        Rails API
services/
  market-data/         Rust ingestion and streaming
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

Use one ownership boundary per directory, generated clients from committed contracts, and language-native dependency management within each application.

## Four-PR Migration Delivery

The entire revamp ships as one dependent stack of exactly four phases, with one pull request per phase. This is not a limit applied repeatedly to smaller stacks. A phase may contain multiple small, logically scoped commits, but it remains one reviewable PR with one acceptance checklist and one rollback boundary. Do not split a phase or introduce a fifth revamp PR unless the delivery plan is explicitly revised.

```text
main
└── Phase 1 PR: verification and characterization
    └── Phase 2 PR: application platform replacement
        └── Phase 3 PR: distributed services and migration readiness
            └── Phase 4 PR: AWS deployment and production cutover
```

Each child PR targets the branch immediately below it and declares that dependency. Merge the stack from Phase 1 through Phase 4, retargeting each child to `main` after its parent merges and rerunning its complete verification before merge. Each phase must leave its branch internally coherent, documented, and reversible. The current production path remains available until the Phase 4 traffic cutover and rollback window complete.

| Phase | Single-PR outcome | Production posture |
|---|---|---|
| 1 | Layered CI and executable characterization of current security, API, database, browser, accessibility, and performance boundaries | No runtime or infrastructure changes |
| 2 | Monorepo foundation plus the Rails API, React/Vite web application, shared contracts, and provider-neutral Gemini model gateway | Replacement applications remain dormant; current Next.js/Supabase deployment remains operational |
| 3 | Rust market-data service, Kafka and Temporal workflows, complete product behavior, identity/data migration tooling, and local end-to-end verification | Replacement platform is cutover-ready but no AWS resources or production traffic are changed |
| 4 | Terraform-managed AWS platform, managed services, deployment, observability, rehearsed migration, gradual traffic cutover, and legacy decommissioning | Production moves only after acceptance and rollback gates pass |

### Migration Rules Across Phases

- Keep the current Next.js and Supabase paths operational until the replacement platform passes local and CI verification, then Phase 4 staging verification.
- Add new schemas and APIs before moving readers or writers; remove old contracts only after the rollback window.
- Use shadow reads and reconciliation reports before changing the source of truth.
- Assign one authoritative writer per record type whenever possible. If bounded dual writes are unavoidable, define conflict handling, monitoring, duration, and repair tooling first.
- Move traffic by route or feature flag with explicit abort thresholds instead of switching the entire product at once.
- Use expand, migrate, verify, and contract steps for incompatible database changes.
- Preserve correlation and idempotency identifiers across old and new paths so duplicated or lost work can be detected.
- Keep compatibility code visibly temporary, owned, measured, and attached to a removal phase.
- Do not combine production data migration, identity cutover, or legacy deletion with unrelated product changes.

## Migration Roadmap

### Phase 1 PR: Verification and Characterization

- Run linting, type checking, unit coverage, production builds, and dependency audits on every pull request without production credentials.
- Run migrations and PostgreSQL security tests against disposable databases, including RLS, tenant isolation, constraints, quotas, and table privileges.
- Exercise HTTP integration boundaries, authenticated product journeys, cross-browser behavior, accessibility, and performance budgets.
- Characterize protected-route redirects, authentication ordering, request validation, report access, and stream-symbol rejection before replacing their implementations.
- Keep the current runtime, database, providers, and deployment behavior unchanged.

Acceptance criteria:

- Every verification layer passes locally and on clean GitHub-hosted runners.
- A stable aggregate check can protect later phase branches.
- Tests use synthetic configuration and disposable services without deployed credentials.
- Existing migration-critical behavior has executable characterization coverage.

### Phase 2 PR: Application Platform Replacement

- Establish the monorepo layout, pinned containerized toolchains, and documented local orchestration while preserving the root Next.js application.
- Publish OpenAPI and event contracts and generate a typed React client deterministically.
- Implement the Rails API with PostgreSQL, Active Record migrations, Pundit authorization, RSpec, idempotency, audit records, transactional outbox, Sidekiq, structured logging, and OpenTelemetry.
- Implement authentication behind a provider boundary that supports current Supabase sessions during development and Cognito JWTs at the later cutover.
- Preserve Yahoo Finance behavior behind a fundamentals-provider interface and verify compatibility with fixtures and shadow comparisons.
- Implement the React/Vite application for authentication, dashboard, search, company, crypto, favorites, portfolios, reports, and settings without changing production traffic.
- Implement the provider-neutral `ModelGateway`, Gemini REST adapter, versioned prompts, structured outputs, allowlisted tools, quotas, and golden evaluations. Use local secret injection only; AWS Secrets Manager integration belongs to Phase 4.

Acceptance criteria:

- Rails request, model, policy, migration, contract, and tenant-boundary tests pass.
- React critical journeys pass in Chromium, Firefox, WebKit, and mobile Chromium with accessibility and performance budgets enforced.
- Contract generation is deterministic and detects stale clients.
- The Gemini adapter is isolated behind `ModelGateway`; provider failures and malformed outputs are covered without exposing credentials.
- The current application still builds and deploys without depending on dormant replacement applications.

### Phase 3 PR: Distributed Services and Migration Readiness

- Implement the Rust market-data service with Alpaca ingestion, normalized versioned events, PostgreSQL persistence, authenticated SSE, quotas, backpressure, reconnection, stale-feed detection, and graceful shutdown.
- Implement Kafka producers and idempotent consumers, the Rails outbox publisher, replay tooling, schema compatibility checks, and traceable event identifiers.
- Implement Temporal report workflows with idempotent activities, deadlines, retries, cancellation, citation metadata, and artifact-storage boundaries.
- Complete the React-to-Rails and React-to-Rust integrations for every product journey under local routing and feature flags.
- Build repeatable Supabase data and identity export, transformation, validation, reconciliation, and rollback tooling without executing a production migration.
- Provide local PostgreSQL, Redis, Kafka, and Temporal orchestration plus end-to-end, contract, load, failure-injection, and recovery tests.
- Keep deployment interfaces compatible with Cognito, Aurora PostgreSQL, ElastiCache, MSK, S3, and Secrets Manager without provisioning those services.

Acceptance criteria:

- The complete replacement product runs locally without production credentials and passes end-to-end verification.
- Market-data load and recovery tests meet documented latency, connection, and no-silent-loss targets.
- Report evaluations and workflow tests cover source use, prompt injection, retries, cancellation, and duplicate prevention.
- Migration rehearsals reconcile row counts, checksums, ownership relationships, identities, and sampled records against disposable datasets.
- Current production remains on the legacy path and can ignore every replacement service.

### Phase 4 PR: AWS Deployment and Production Cutover

- Provision separate AWS environments, networking, ECR, EKS, Route 53, ACM, CloudFront, WAF, IAM, KMS, and Secrets Manager through Terraform.
- Provision Aurora PostgreSQL, RDS Proxy, ElastiCache, MSK, S3, and the managed observability stack outside Kubernetes.
- Add least-privilege workload identity, GitHub Actions OIDC, image scanning and signing, Helm packaging, Argo CD promotion, network policies, and restricted pod security.
- Add the personal Gemini API token through an approved secret-management workflow so it never enters source, logs, Terraform plans, or state.
- Deploy development and staging, exercise SLO dashboards, alerts, runbooks, backup restoration, disaster recovery, capacity, security, and image rollback.
- Configure Cognito and rehearse identity and data migration before the production window.
- Freeze incompatible changes, execute final synchronization, reconcile data, and shift traffic gradually with explicit abort thresholds.
- Observe the target platform through the rollback window before deliberately retiring Vercel, Supabase, compatibility routes, legacy credentials, and redundant data copies.

Acceptance criteria:

- A clean environment can be bootstrapped from versioned code without long-lived AWS credentials in GitHub.
- Restore, rollback, migration, and cutover rehearsals meet documented recovery objectives.
- No unresolved critical security finding remains and alerts map to user-visible failure modes.
- Production error rate, latency, data integrity, stream health, and workflow completion remain within their objectives at full traffic.
- Legacy infrastructure is removed only after backups and the rollback window are verified.

## Verification Strategy

Every phase should select the layers relevant to its risk:

- Static analysis and formatting for every language and infrastructure definition.
- Unit and property tests for business rules, parsers, and state transitions.
- Migration and database tests against real PostgreSQL.
- Request and policy tests for Rails authorization boundaries.
- Provider-fixture and replay tests for market ingestion.
- Contract tests for OpenAPI, Protobuf, and Kafka compatibility.
- Integration tests using containers for PostgreSQL, Redis, and Kafka where practical.
- Browser and accessibility tests for critical user journeys.
- Load, soak, and failure-injection tests for streaming and workflows.
- Terraform validation, policy checks, and disposable-environment plans.
- Post-deployment smoke tests and automated rollback signals.

Verification depth should scale with blast radius, failure cost, and uncertainty. Prefer tests that prove meaningful boundaries and failure behavior over a target ratio of test code to production code.

## Pull Request Requirements

Every implementation PR must include:

- One coherent change with explicit in-scope and out-of-scope statements.
- Schema, API, event, configuration, and operational documentation updates where applicable.
- Tests for new behavior and relevant failure paths.
- Migration, deployment, observability, and rollback notes.
- Evidence from the applicable local and staging verification layers.
- No unrelated refactor bundled into a migration phase.

## Completion Criteria

The revamp is complete when:

- React, Rails, Rust, and Gemini own the boundaries defined above.
- AWS infrastructure is reproducible through Terraform and reconciled through GitOps.
- Cognito, Aurora, Redis, MSK, S3, Secrets Manager, and the model gateway have tested security and recovery procedures.
- Critical journeys, tenant isolation, streaming recovery, report workflows, and provider failures have durable automated coverage.
- SLOs, alerts, traces, dashboards, and runbooks support production operation.
- The Next.js, Supabase, and Vercel runtime dependencies are removed after a verified rollback window.

# Indus Repository Guide

## Mission

Indus is a production financial-intelligence platform for authenticated equity and cryptocurrency research, live market data, model-assisted analysis, and generated reports. Treat every change as portfolio-quality production work: clear ownership, secure boundaries, durable tests, and operationally useful documentation.

## Sources of truth

- Checked-in code, contracts, migrations, and Terraform define the system.
- [Architecture and Operating Model](./docs/ARCHITECTURE.md) defines ownership, trust boundaries, and operating constraints.
- [Quality and Security Verification](./docs/QUALITY.md) defines the executable verification contract.
- `AGENTS.md` is canonical agent context. `CLAUDE.md` remains a relative symlink to it.

## Working rules

### Scope and safety

- Inspect the relevant implementation, tests, contracts, migrations, and documentation before editing.
- Preserve unrelated changes in a dirty worktree and make the smallest coherent change.
- Do not combine feature work, infrastructure work, dependency upgrades, and unrelated cleanup in one pull request.
- `main` is production. Never push directly to it.
- Do not mutate production data, cloud resources, DNS, secrets, or external services without explicit authorization.
- Use forward-only database corrections after a migration reaches a shared environment.
- Never expose credentials, tokens, private prompts, or full provider payloads in output, tests, commits, or logs.

### Branches, commits, and pull requests

- Branch from current `origin/main` using a short-lived, descriptive name.
- Commit substantial work incrementally by logical concern; do not amend, rewrite, or force-push without explicit authorization.
- Open a pull request only when explicitly requested. State scope, verification, migration impact, rollback, and deferred work.
- Do not add coding-assistant attribution, co-author tags, or generated-by language to commits or pull requests.

### Verification

| Change | Required verification |
|---|---|
| Documentation or context | `git diff --check`; validate paths, links, and symlinks |
| TypeScript, React, or configuration | `bun run lint`, `bun run typecheck`, `bun run build` |
| Rails, Rust, schemas, routes, or utilities | Relevant language tests plus contract and integration coverage |
| PostgreSQL migrations, grants, policies, or quotas | Relevant application checks plus real PostgreSQL migration tests |
| Terraform, Helm, GitOps, or containers | Formatting, validation, chart rendering, image build, and policy checks |
| Browser-visible behavior | Relevant Playwright integration, authenticated, accessibility, and performance suites |
| Broad or release-sensitive work | Full affected local verification and staged smoke checks |

Add tests for new and changed behavior, including malformed input, authorization, retries, and failure paths where relevant. Do not weaken assertions, coverage thresholds, compiler settings, or lint rules to make a check pass. Report checks that could not run and why.

## Architecture

- `apps/web` is the React/Vite browser application. It uses TanStack Query, TanStack Router, Tailwind CSS, generated OpenAPI types, and authenticated SSE.
- `apps/platform-api` is the Rails API. It owns product records, authorization through Pundit, Active Record migrations, quotas, idempotency, audit records, provider boundaries, ModelGateway, and the transactional outbox.
- `services/market-data` is the Rust/Tokio/Axum service. It owns Alpaca ingestion, normalized Kafka events, market-data persistence, and authenticated browser streams.
- Temporal owns durable report workflows; Sidekiq owns ordinary background work.
- Aurora PostgreSQL is the durable data store; Redis supports cache, rate limits, and jobs; MSK provides Kafka; S3 holds immutable artifacts.
- Cognito authenticates users. Rails and Rust validate tokens; Rails authorizes resources.
- Gemini is accessed only through ModelGateway. Its API token is an AWS Secrets Manager runtime secret, never browser input or source code.
- Terraform provisions AWS resources. Helm and Argo CD reconcile workloads into EKS. GitHub Actions uses AWS OIDC to publish signed immutable ECR images and GitOps references.

## Invariants

### Contracts and authorization

- OpenAPI is the browser-facing API contract; Protobuf defines internal events. Generated artifacts are deterministic and checked for drift.
- Every public request has bounded input and a consistent error envelope. Retried writes require an idempotency key.
- Authenticate at every trust boundary and authorize every tenant-owned resource. Authentication alone is insufficient.
- Keep provider credentials server-only. Do not use `NEXT_PUBLIC_` for secrets.
- Model prompts, tools, output schemas, and model selection are server-controlled. Evidence is bounded and citations are validated.

### Data and events

- Use sequential migrations. Do not edit applied migrations.
- Enforce durable invariants with database constraints and tenant access with explicit roles and policies.
- Events include schema version, event ID, producer, timestamp, correlation ID, and idempotency key. Consumers tolerate duplicates and reject unsupported versions.
- One writer owns each record class. Any bounded dual-write period requires reconciliation and repair tooling.

### Market data and reliability

- Browsers never receive Alpaca credentials.
- Preserve bounded provider deadlines, retries, cache behavior, and stale-feed detection.
- Stream changes must preserve event IDs, reconnect handling, abort cleanup, and stock plus slash-delimited cryptocurrency normalization.
- Health checks prove process liveness and configuration readiness without revealing secrets or calling paid providers.

### Infrastructure

- Terraform manages resource definitions and secret containers; secret values are supplied outside Terraform and never enter state.
- Workloads run non-root with read-only root filesystems, resource limits, network policies, and least-privilege IAM roles for service accounts.
- Promote immutable, scanned, signed images through development, staging, and production. Use explicit traffic and rollback gates for releases.
- Keep managed state outside Kubernetes: Aurora, ElastiCache, MSK, S3, and Secrets Manager.

## Repository map

- `apps/` — web and Rails application ownership boundaries.
- `services/` — Rust market-data and workflow service boundaries.
- `contracts/` — OpenAPI, Protobuf, generated clients, and compatibility tooling.
- `infra/` — Terraform, Helm, GitOps, and image-publishing assets.
- `__tests__/`, `e2e/`, and service specs — executable verification.
- `docs/architecture/` — stable system design.
- `docs/runbooks/` — recovery and operational procedures.

## Documentation standard

- Keep `README.md` focused on stable setup, architecture orientation, commands, and durable links.
- Record decisions, invariants, failure behavior, operations, and rollback procedures that remain useful after the immediate task.
- Remove temporary progress narration, stale issue lists, speculative claims, and duplicated instructions.
- Update architecture documentation when ownership, contracts, security controls, or operational boundaries change.

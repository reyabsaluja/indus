# Indus

**Market intelligence, made clear.**

Indus is a financial intelligence platform for researching equities and cryptocurrencies with live market data, company fundamentals, AI analytics, and generated reports.

## Architecture

Indus runs a React/Vite web application, Rails product API, Rust market-data service, Kafka, Temporal, Aurora PostgreSQL, Redis, S3, Cognito, and Google Gemini through an application-owned ModelGateway. AWS infrastructure is defined with Terraform and deployed to EKS through Helm and Argo CD.

See the [Architecture and Operating Model](./docs/ARCHITECTURE.md) for system ownership, data flow, security controls, reliability objectives, and operating constraints.

## Local development

The repository contains isolated application boundaries and Compose profiles for local work. Install the locked toolchains required by the boundary you are changing:

- Bun for the root application and browser tests.
- Ruby and Bundler for `apps/platform-api`.
- Rust for `services/market-data`.
- Docker for PostgreSQL, Redis, Kafka, Temporal, and browser/database verification.

For the root application:

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

For the complete local platform, see [Local Application Platform](./docs/runbooks/local-application-platform.md) and [Local Distributed Platform](./docs/runbooks/local-distributed-platform.md).

## Verification

```bash
bun run test:static
bun run test:unit
bun run test:database
bun run test:integration
bun run test:browser
bun run test:authenticated
```

Run only the checks relevant to a focused change; use the full affected sequence for release-sensitive work. [Quality and Security Verification](./docs/QUALITY.md) defines required layers, local prerequisites, budgets, and troubleshooting.

## Documentation

| Document | Purpose |
|---|---|
| [Architecture and Operating Model](./docs/ARCHITECTURE.md) | System boundaries, security model, data and event ownership, and delivery model |
| [Quality and Security Verification](./docs/QUALITY.md) | Executable verification, security controls, budgets, and CI expectations |
| [Runtime Reliability](./docs/RELIABILITY.md) | Provider deadlines, retries, caching, fallbacks, health checks, and diagnostics |
| [Application Platform](./docs/architecture/application-platform.md) | React, Rails, contracts, authorization, and ModelGateway |
| [Market Data](./docs/architecture/market-data.md) | Alpaca ingestion, Kafka, persistence, and authenticated SSE |
| [Research Workflows](./docs/architecture/distributed-research-workflows.md) | Temporal workflows, report artifacts, and event reliability |
| [Market Data Runbook](./docs/runbooks/market-data.md) | Local operation, replay, retention, and incident response |
| [Report Workflow Recovery](./docs/runbooks/report-workflow-recovery.md) | Workflow cancellation, replay, and dependency recovery |
| [Rollback](./docs/runbooks/rollback.md) | Traffic, image, workflow, and data recovery controls |

## License

MIT. See [LICENSE](./LICENSE).

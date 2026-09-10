# Indus Repository Guide

## Mission

Indus is a financial intelligence platform for authenticated stock and cryptocurrency research, live market charts, model-assisted explanations and chat, and generated research reports. Treat it as a production portfolio project: changes should demonstrate sound boundaries, security, reliability, and operational judgment.

## Sources of Truth

- The checked-in code and migrations describe the system that exists today.
- [`docs/REVAMP_PLAN.md`](./docs/REVAMP_PLAN.md) describes the approved future architecture and phased migration; it is not current implementation guidance.
- [`docs/QUALITY.md`](./docs/QUALITY.md) defines the local verification contract.
- `AGENTS.md` is the canonical agent context. `CLAUDE.md` must remain a relative symlink to it.

Never implement a future revamp phase merely because it appears in the plan. Start a phase only when the user explicitly requests it.

## Working Rules

### Scope and Safety

- Inspect the relevant implementation, tests, migrations, and documentation before editing.
- Preserve unrelated user changes in a dirty worktree.
- Make the smallest coherent change that fully addresses the request.
- Do not combine feature work, infrastructure work, dependency upgrades, and unrelated cleanup in one PR.
- Treat `main` as production. Merges currently trigger the Vercel production deployment, so every merge is a release; do not push directly to it.
- Do not mutate production data, cloud resources, secrets, or external services without explicit authorization.
- Prefer forward-only database fixes after a migration has reached any shared environment.
- Never expose credentials, tokens, private prompts, or full provider payloads in logs, tests, commits, or responses.

### Branches, Commits, and Pull Requests

- Branch from the current `origin/main` using a short-lived topic branch.
- Commit substantial work incrementally by logical concern; do not accumulate a large mixed diff.
- Use one-sentence commit messages that describe what changed.
- Stage minor amendments without a standalone commit unless the user requested a completed PR or push.
- Never amend, rewrite, or force-push history unless explicitly requested.
- Do not include coding-assistant attribution, co-author tags, or generated-by language in commits or PR metadata. Product terms such as Gemini or model-assisted features are allowed when technically relevant.
- Open a PR only when explicitly requested. Standalone and bottom-of-stack PRs target `main`; in an explicitly approved stack, each child PR targets its immediate parent and declares the dependency. State scope, verification, migration impact, rollback, and deferred work.
- Deliver the approved revamp as exactly four dependent phases with one PR per phase. Do not reinterpret four PRs as a repeating batch size or split a phase unless the user explicitly revises the plan.

### Verification

Run checks in proportion to the changed boundary:

| Change | Required verification |
|---|---|
| Documentation or agent context only | `git diff --check`; validate paths, links, and symlinks |
| TypeScript, React, or configuration | `bun run lint`, `bun run typecheck`, `bun run build` |
| Logic, schemas, routes, or utilities | Above plus `bun run test` |
| PostgreSQL migration, grants, RLS, or quotas | Above plus `bun run test:database` |
| Browser-visible behavior | Relevant Playwright integration, browser, authenticated, accessibility, or performance suites |
| Broad or release-sensitive changes | `bun run test:local` |

- Add tests for new behavior and existing behavior changed by the patch.
- Test failure paths, authorization boundaries, retries, and malformed inputs when relevant.
- Do not weaken assertions, coverage thresholds, lint rules, or compiler settings to make a change pass.
- Report commands that could not run and the exact reason.

## Current Architecture

The repository currently uses:

- Bun, Next.js 15 App Router, React 19, and strict TypeScript.
- Tailwind CSS 4, Radix primitives, Lucide icons, and `next-themes`.
- Supabase Auth and PostgreSQL with versioned SQL migrations, RLS, explicit grants, constraints, and database-enforced request quotas.
- Zustand for client state and TanStack Query for asynchronous state.
- Alpaca for real-time and historical market data; Yahoo Finance 2 for fundamentals.
- Server-side Alpaca WebSockets fanned to browsers through SSE route handlers.
- Google Gemini through a server-side REST client with manually parsed streaming responses.
- TradingView Lightweight Charts for financial visualization.
- Zod for shared request and environment schemas.
- Biome, Vitest, pgTAP, Playwright, axe-core, and local performance budgets.
- Vercel as the current deployment target.

The approved target architecture replaces the application runtime incrementally with React/Vite, a Rails API, a Rust market-data service, Google Gemini, and an AWS/EKS platform. Follow the phase boundaries in the revamp plan; do not perform a big-bang rewrite.

## Current Implementation Invariants

### Application and Provider Boundaries

- Keep provider credentials server-only. Never place secrets in `NEXT_PUBLIC_*`; currently public values include the Supabase URL, Supabase anonymous key, and optional Vercel hostname.
- Validate environment variables through `lib/env.ts` and shared schemas in `lib/schemas/api.ts`.
- Keep shared Zod API schemas in `lib/schemas/api.ts` so routes and tests use the same contracts.
- Authenticate protected application routes in `middleware.ts`.
- Authorize tenant-owned database operations with RLS as well as application checks.
- Load report market data directly from server-side providers; never trust an incoming request origin to call internal routes.
- Bound provider requests, chat history, batch sizes, symbols, and generated output.
- Fail closed when authentication, quota enforcement, or required provider evidence is unavailable.

### Database

- Add schema changes as sequential files in `supabase/migrations/`; never edit an applied migration.
- Enforce durable invariants with PostgreSQL constraints and tenant access with explicit grants plus RLS.
- Add or update pgTAP coverage for migrations, policies, privileges, constraints, and quota behavior.
- Preflight existing data before validating a new constraint in a shared environment.
- Apply migrations through the Supabase CLI or the established migration process, then verify migration history and resulting database objects.

Current application tables include `favorites`, `reports`, `metric_explanations`, and `ai_usage_windows`.

### Real-Time Data

- Preserve the server-side Alpaca-to-SSE boundary; browsers must not receive Alpaca credentials.
- Keep stock and cryptocurrency symbol normalization centralized in `lib/realtime/alpaca-stream.ts`.
- Preserve event IDs, reconnect behavior, abort cleanup, and bounded upstream connections.
- Test both stock and slash-delimited cryptocurrency symbols when changing stream handling.

### Next.js Configuration

- Preserve `serverExternalPackages: ["yahoo-finance2"]` in `next.config.ts`.
- Preserve the `punycode` webpack warning suppression until the upstream dependency is removed.
- Do not disable TypeScript, lint, build, or runtime validation failures.

## Repository Map

- `app/` — App Router pages and server route handlers.
- `components/` — UI, chart, navigation, and chat components.
- `hooks/` — client behavior shared across components.
- `lib/` — schemas, providers, stores, security, observability, and domain utilities.
- `__tests__/` — Vitest tests mirroring source boundaries.
- `e2e/` — Playwright integration, browser, accessibility, authenticated, and performance tests.
- `supabase/migrations/` — ordered production database migrations.
- `supabase/tests/database/` — pgTAP database boundary tests.
- `scripts/` — isolated local verification orchestration.
- `docs/` — durable architecture and operational documentation.

## Documentation Standards

- Keep `README.md` focused on stable setup, commands, architecture orientation, and links to durable documents.
- Keep detailed documentation under `docs/`; retain `README.md` and repository control files at the root.
- Remove temporary progress narration, speculative claims, stale issue lists, and duplicated instructions.
- Document decisions, invariants, failure behavior, operations, and rollback information that will remain useful after the current task.
- Update the revamp plan when an architectural decision or phase boundary changes.
- Update only `AGENTS.md` for agent guidance; verify that `CLAUDE.md` still resolves to it.

## Key Current Files

- `app/layout.tsx` — provider and layout composition.
- `components/AppProviders.tsx` — query, theme, and auth bootstrap providers.
- `middleware.ts` — protected-route authentication.
- `app/api/stream/[symbol]/route.ts` — live SSE endpoint.
- `lib/realtime/alpaca-stream.ts` — market stream normalization and SSE helpers.
- `lib/ai/geminiClient.ts` — Gemini request and stream client.
- `lib/security/ai-access.ts` — authentication and quota enforcement for model-backed routes.
- `lib/reliability/async.ts` and `lib/reliability/cache.ts` — bounded provider retries, deadlines, request deduplication, and stale-on-error caching.
- `lib/server/market-history.ts` and `lib/server/stock-data.ts` — market provider fallback and partial-response boundaries.
- `lib/server/report-stock-data.ts` — server-side report evidence retrieval.
- `lib/schemas/api.ts` — shared API and environment schemas.
- `lib/env.ts` and `lib/env-legacy.ts` — current and transitional environment handling.
- `next.config.ts` — required server package and warning configuration.
- `docs/RELIABILITY.md` — deployed runtime failure behavior and operational diagnostics.
- `docs/REVAMP_PLAN.md` — future Rails, Rust, Gemini, and AWS migration plan.

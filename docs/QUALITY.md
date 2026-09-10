# Local Security and Quality Verification

This guide defines the application and database checks that must pass before an Indus change is ready for review. It is intentionally independent of any deployment platform or CI provider.

## Security boundaries

### Request validation

All shared API schemas live in `lib/schemas/api.ts`. Financial symbols are trimmed, normalized to uppercase, restricted to supported characters, and capped at 20 characters. AI payloads also enforce finite numbers and bounded batch, message, chart, context, and string sizes.

Browser-supplied chat history accepts only `user` and `assistant` roles. System instructions are created exclusively by the server and cannot be injected through the request schema.

When adding or changing an API input:

1. Update the shared Zod schema.
2. Add valid, malformed, oversized, and boundary-value unit tests.
3. Add an integration assertion when the HTTP status or public contract changes.

### Authentication and AI quotas

`lib/security/ai-access.ts` is the common authorization boundary for AI-backed routes. It verifies the Supabase user and consumes an atomic database quota before an upstream model request is made. A quota database failure fails closed with `503`; exhausted quotas return `429` with `Retry-After` and rate-limit reset metadata.

Current per-user quotas are:

| Function | Hourly | Daily |
|---|---:|---:|
| Batch explanations | 20 | 100 |
| Context chat | 30 | 150 |
| Research reports | 5 | 20 |

Change quota values only through a new numbered migration and update the pgTAP assertions and this table in the same commit.

### Database access

Migration `00004_security_hardening_and_ai_quotas.sql` establishes these rules:

| Resource | Anonymous | Authenticated | Service role |
|---|---|---|---|
| Favorites | None | Own rows: read/create/delete | Full |
| Reports | None | Own rows: read/create/update/delete | Full |
| Metric explanations | None | Read-only shared cache | Full |
| AI usage windows | None | RPC only; no direct table access | Full |

RLS remains the tenant boundary even when route queries include `user_id`. The explicit query filter improves clarity and query planning but is not a substitute for a database policy.

## Initial setup

Install the locked dependencies and Playwright browser engines:

```bash
bun install --frozen-lockfile
bunx playwright install chromium firefox webkit
```

Database tests require a healthy Docker engine. Confirm both the client and server respond before running them:

```bash
docker version
bunx supabase --version
```

## Verification layers

| Layer | Command | What it covers |
|---|---|---|
| Static | `bun run test:static` | Biome, TypeScript, and production build |
| Unit | `bun run test:unit:coverage` | Schemas, security helpers, utilities, and coverage thresholds |
| Database | `bun run test:database` | Migration replay, grants, RLS policies, quota limits, and tenant isolation |
| Integration | `bun run test:integration` | Public navigation, auth redirects, and HTTP boundary behavior |
| Browser | `bun run test:browser` | Chromium, Firefox, WebKit, and mobile Chromium product paths |
| Accessibility | `bun run test:accessibility` | WCAG A/AA serious and critical violations on public pages |
| Authenticated browser | `bun run test:authenticated` | Real local sign-in, protected product routes, tenant API access, and authenticated WCAG checks against a serial, isolated Supabase stack |
| Performance | `bun run test:performance` | Production-mode navigation and JavaScript transfer budgets |
| Market data | `bun run test:market-data` | Rust formatting, Clippy, fixtures, replay, SSE boundaries, PostgreSQL persistence, Kafka orchestration, and image build |

## Reliability-first development

Indus uses test-driven development for new behavior and regressions: define the observable contract and its failure boundaries before or alongside the production implementation. Verification effort should scale with risk and blast radius, with enough focused coverage to make expected behavior and failure modes explicit. Keep each production change small while covering its valid path, malformed inputs, boundary values, failure behavior, security properties, and relevant browser contract at the appropriate layers.

Tests should verify externally meaningful behavior instead of implementation details. A small production change may therefore be supported by schema tests, unit cases, database assertions, and browser coverage rather than a single oversized test file.

Provider-facing changes must preserve the runtime policies in [`RELIABILITY.md`](./RELIABILITY.md). Tests should cover timeout behavior, retry classification, stale-cache behavior, fallback selection, and partial upstream responses when those boundaries change.

Characterization tests use the `@characterization` tag alongside their normal verification layer. They preserve externally visible authentication, validation, error-envelope, and transport behavior. Change a characterized contract only with an explicit compatibility decision and corresponding consumer updates.

Run the full sequence with:

```bash
bun run test:local
```

## Pull request verification

GitHub Actions uses locked toolchains and non-secret test configuration. It verifies application source, contracts, migrations, database security assertions, HTTP behavior, browser and authenticated accessibility journeys, performance budgets, Terraform, Helm, and container images. Workflows never receive deployed provider or AWS credentials.

The stable `Required verification` job aggregates the required layers as they are introduced. Configure branch protection against that job only after its first successful run on GitHub, so the repository never depends on a check name that has not been registered.

Pull request workflows must use `pull_request`, least-privilege permissions, pinned actions, and disposable test services. Do not use `pull_request_target` for code execution or upload authenticated browser traces containing session material.

The database layer always uses a temporary Supabase project on dedicated test ports. It resets and removes only that isolated project, so an existing local Supabase stack and its data are not modified.

The authenticated browser layer follows the same isolation model. It starts a temporary Supabase Auth, API, and database stack on ports `15421` and `15422`, applies every migration, provisions a confirmed test user through the local admin API, and removes the stack on exit. These ports stay below Linux's ephemeral range to avoid collisions during image pulls. Docker must be available, and no deployed credentials are required.

## Enforced budgets

Unit coverage is enforced across security-sensitive schema and helper modules:

- Lines, functions, and statements: 85% minimum
- Branches: 80% minimum

The production-mode landing-page performance test enforces:

- DOM content loaded: under 2.5 seconds
- Window load: under 4 seconds
- Transferred JavaScript: under 1 MB

These are regression budgets, not claims about production latency. Tighten them when measurements are stable; do not loosen them solely to make a regression pass.

## Troubleshooting

If database startup reports a Docker socket or API-version error, run `docker version`. Both the client and server sections must complete. Restart or repair the local Docker engine before retrying `bun run test:database`.

Playwright retains traces, screenshots, and videos under `test-results/` for failures. Open a trace with:

```bash
bunx playwright show-trace path/to/trace.zip
```

Coverage output is written to `coverage/`, and the browser HTML report is written to `playwright-report/`. These generated artifacts are ignored by Git.

## Review discipline

Keep implementation commits small and single-purpose. Security controls, local test infrastructure, documentation, and unrelated feature work should not share a commit. Before requesting review, include the commands run and any environment-level check that could not execute.

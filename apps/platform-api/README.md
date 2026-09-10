# Platform API

The platform API is the Rails boundary introduced during the Indus runtime migration. It is additive: the existing application remains authoritative until a separately verified cutover.

## Runtime

- Ruby 3.4.10 and Rails 8.1.3.1
- PostgreSQL for durable state
- Sidekiq and Redis for asynchronous work
- Supabase JWT verification during migration; a dormant Cognito verifier supports the later identity cutover
- Google Gemini behind `ModelGateway`

Use the repository's containerized Rails toolchain rather than the host Ruby installation. Dependencies are pinned in `Gemfile.lock`.

## Configuration

The service fails closed when required identity, database, or model configuration is absent. Secrets are supplied through the process environment and must never be committed.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `REDIS_URL` | Sidekiq Redis URL |
| `SUPABASE_JWT_ISSUER` | Expected token issuer |
| `SUPABASE_JWT_AUDIENCE` | Expected token audience; defaults to `authenticated` |
| `SUPABASE_JWKS_URL` | Optional explicit HTTPS JWKS endpoint |
| `SUPABASE_JWT_SECRET` | Optional legacy HS256 verifier secret during migration; prefer JWKS signing keys |
| `GEMINI_API_KEY` | Server-side Gemini credential |
| `GEMINI_MODEL` | Model selection; defaults to `gemini-2.5-flash` |
| `AI_REQUESTS_PER_HOUR` | Per-user explanation quota; defaults to 30 |
| `OTEL_TRACES_EXPORTER` | Trace exporter; defaults to `none` so local and test runs make no export attempts |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint when the exporter is explicitly enabled |

Production also requires Rails' standard `SECRET_KEY_BASE`. No Rails master key or encrypted credential file is used.

## Boundaries

Every `/v1` request requires a verified bearer token. The token issuer and audience are fixed by server configuration, and Pundit scopes every tenant-owned query by the internal user identifier. Mutations require an `Idempotency-Key`; the mutation, audit event, and replay response commit in one transaction. Reusing a key with the same request replays the recorded response, while changing the request returns `409`. Reports are created together with an outbox event in that transaction; workers may process that event only after commit. Provider credentials and provider payloads do not cross the API boundary.

Model-backed operations are owned by a task registry in `ModelGateway`. Each task pins a prompt version, receives bounded server-side evidence, supplies Gemini with a structured response schema, rejects citations that do not exactly match that evidence, normalizes usage and provider failures, and consumes a per-user quota before invocation. Quota writes use a dedicated database connection so a billable provider failure cannot roll the charge back with the surrounding idempotency transaction. Phase 2 does not run autonomous tool loops; Kafka publication and Temporal report orchestration remain Phase 3 work.

`GET /healthz` proves the process can serve HTTP. `GET /readyz` additionally verifies PostgreSQL connectivity and returns `503` when it is unavailable. Neither endpoint requires authentication.

## Verification

From the repository root, run the Rails commands through the pinned tool image with a writable bundle volume. A PostgreSQL test database is required.

```sh
bundle exec rails db:prepare
bundle exec rspec
bundle exec rubocop
bundle exec brakeman --no-pager
```

The service tests use generated signing keys and deterministic provider fixtures. They never call Supabase, Gemini, or Yahoo over the network.

## Rollback

Before traffic is cut over, rollback consists of stopping this service; the current Next.js runtime remains unchanged. Once this schema contains production writes, use forward-only corrective migrations and the phase cutover runbook rather than reversing migrations that may discard data.

# Local Application Platform Runbook

## Purpose

Run and verify the Rails API and React web application without production credentials or cloud services.

## Prerequisites

- Docker with Compose v2
- Bun 1.3.13 for web and browser checks
- Chromium, Firefox, and WebKit installed through Playwright when running browser tests

Ruby is intentionally not required on the host. Rails uses the pinned container toolchain under `tooling/rails` and the application image under `apps/platform-api`.

## Start dependencies

```bash
docker compose up --detach --wait postgres redis
```

PostgreSQL listens on `127.0.0.1:15432`; Redis listens on `127.0.0.1:16379`. Both use disposable local credentials defined in `compose.yaml`.

## Start the applications

Export a local Supabase URL, anonymous key, expected JWT issuer, and disposable local JWT secret. These values are passed only to the services that need them; the anonymous browser key is public, while the JWT secret remains server-side. An HTTPS JWKS endpoint can instead be supplied through a reviewed Compose override.

```bash
export VITE_SUPABASE_URL=http://127.0.0.1:54321
export VITE_SUPABASE_ANON_KEY=replace-with-local-anon-key
export SUPABASE_JWT_ISSUER=http://127.0.0.1:54321/auth/v1
export SUPABASE_JWT_SECRET=replace-with-disposable-local-jwt-secret
```

Do not use a production token, signing secret, or provider credential for local verification.

```bash
docker compose --profile application up --build
```

Rails is exposed at `http://127.0.0.1:13000` and the Vite preview at `http://127.0.0.1:14173`. Health and readiness endpoints must succeed before exercising product routes.

The application profile is isolated local infrastructure. It does not change deployed AWS resources, provider configuration, or production data.

## Verify

Run the application-platform verification entry point from the repository root:

```bash
bash scripts/verify-phase2.sh
```

The verifier checks contracts, Rails against real PostgreSQL and Redis, and the web application. It uses no live financial provider or model credentials.

## Stop

```bash
docker compose --profile application down
```

This retains local PostgreSQL and Redis volumes. To discard only this Compose projects disposable data after confirming no needed local state remains:

```bash
docker compose --profile application down --volumes
```

Never point these cleanup commands at another Compose project or a shared database.

## Troubleshooting

- If a bound port is unavailable, stop the conflicting local process; do not expose the service on all interfaces.
- If Rails reports a schema mismatch, run its versioned migration command rather than editing the database manually.
- If generated API types are stale, rerun the committed contract generator and review both the contract and generated diff.
- If provider fixtures fail, update them only with a reviewed contract change; deterministic CI must not fall back to a live request.

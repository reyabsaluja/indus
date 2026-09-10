# Indus Web

The replacement Indus browser application is a React 19 and Vite single-page application. It is introduced alongside the existing Next.js application so migration can proceed route by route without changing the production entrypoint.

## Boundaries

- TanStack Router owns browser navigation and rejects unauthenticated protected-route requests before rendering application content.
- The Supabase adapter is the temporary identity boundary. Only the public project URL and anonymous key enter the browser; provider and service credentials remain server-side.
- `src/lib/api.ts` is the typed Rails JSON boundary. It attaches the current access token, validates responses, supplies idempotency keys for mutations, and returns bounded errors that do not expose upstream payloads. Its Zod schemas follow the OpenAPI wire format and provide runtime validation; direct imports from the generated TypeScript client are deferred until that generator output is compatible with this application's strict TypeScript settings.
- `src/lib/market-stream.ts` defines the Phase 3 live-market interface. The initial implementation deliberately opens no provider connection. The Phase 2 crypto view uses bounded instrument discovery and fundamentals while presenting live-stream availability explicitly.
- TanStack Query owns remote server state. Components do not call Rails or market providers directly.

## Local development

Copy `.env.example` to `.env.local` and supply local development values. Then run:

```sh
bun install --frozen-lockfile
bun run dev
```

The Rails API must allow the local Vite origin and validate the Supabase bearer token during the compatibility period.

## Verification

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

The browser suite verifies anonymous fail-closed routing, authenticated dashboard and navigation journeys, serious accessibility rules, Chromium, Firefox, WebKit and mobile profiles, and a local shell-load budget. Its web server is compiled with `VITE_E2E_AUTH=true`; test contexts must additionally opt in through a local-storage marker. Builds without that explicit flag cannot select the test identity adapter, and the unit suite verifies that unconfigured normal builds remain fail-closed. The Rails summary request is intercepted with schema-valid fixture data until the compatibility API is available.

`src/lib/contract-equivalence.test.ts` reads the committed generated client as text and checks the endpoint paths, methods, idempotency headers, and JSON field mappings used by the Zod adapter. This catches generator drift without compiling generator runtime code under the application's stricter TypeScript policy.

## Failure behavior

Missing identity configuration leaves the application fail-closed at sign-in. Invalid API payloads fail schema validation, non-success responses expose only status and request ID, and unavailable market streaming is a no-op until the Phase 3 adapter is installed. Search, fundamentals, favorites, portfolios, reports, and settings use the Rails `/v1` contract; their views retain explicit loading, retryable error, empty, and success behavior.

# Indus Market Data Service

The dormant Phase 3 Rust service owns provider ingestion, normalized Kafka events, historical market persistence, and authenticated browser streaming. It does not own users, portfolios, reports, or authorization policy. The legacy Next.js stream remains unchanged until the Phase 4 cutover.

## Interfaces

| Interface | Purpose |
|---|---|
| `GET /health/live` | Process liveness and shutdown state |
| `GET /health/ready` | PostgreSQL, Kafka, and configured upstream readiness |
| `GET /metrics` | Prometheus text exposition |
| `GET /v1/streams/{symbol}` | Bearer-authenticated SSE bars and quotes |
| `market.bars.v1` | Versioned protobuf bar events |
| `market.quotes.v1` | Versioned protobuf quote events |

The stream endpoint accepts credentials only through `Authorization: Bearer`. Credential-shaped query parameters are rejected before authentication. `Last-Event-ID` resumes from the bounded replay buffer. A missing cursor produces an explicit `gap` event, slow consumers receive a `gap` with the skipped count, and feeds without recent events produce `stale` events.

## Required configuration

| Variable | Description |
|---|---|
| `DATABASE_URL` | Dedicated PostgreSQL writer connection |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka/MSK bootstrap addresses |
| `MARKET_JWT_ISSUER` | Exact accepted token issuer |
| `MARKET_JWT_AUDIENCE` | Exact accepted token audience |
| `MARKET_JWKS_URL` | Cognito-compatible JWKS endpoint |
| `MARKET_JWT_HS256_SECRET` | Transitional local verifier; mutually exclusive with JWKS |
| `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` | Required only when ingestion is enabled |

See [the architecture record](../../docs/architecture/market-data.md) for reliability semantics and [the runbook](../../docs/runbooks/market-data.md) for all configuration, local startup, replay, and recovery commands.

## Verification

```bash
bash scripts/verify-market-data.sh
```

Without Docker this still runs formatting, Clippy, fixture/replay, authentication, backpressure, reconnect, stale-feed, and load-boundary tests. With Docker it also runs the real PostgreSQL migration/persistence test, initializes local Kafka topics, and builds the production image.

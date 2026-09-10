# Market Data Service Runbook

## Local startup

Prerequisites are Rust 1.96 and Docker Compose v2. No live provider or production identity credential is needed for fixture verification.

Start PostgreSQL, Redpanda, topic initialization, and the service:

```bash
docker compose --profile distributed up --detach --wait postgres redpanda
docker compose --profile distributed run --rm redpanda-init
docker compose --profile distributed up --detach --build --wait market-data
```

The service listens only on `127.0.0.1:18081`; Redpanda listens on `127.0.0.1:19092`. Compose disables Alpaca ingestion, expects the Supabase-compatible `authenticated` audience, and uses a disposable local JWT secret. To use a local Supabase access token, set `MARKET_JWT_HS256_SECRET` to that disposable project's signing secret before startup. Never use a deployed signing secret in this profile.

```bash
curl --fail http://127.0.0.1:18081/health/live
curl --fail http://127.0.0.1:18081/health/ready
curl --fail http://127.0.0.1:18081/metrics
```

Start the application profile as well to exercise its fetch-based stream client:

```bash
docker compose --profile application --profile distributed up --build
```

## Verification and replay

Run the stable verifier:

```bash
bash scripts/verify-market-data.sh
```

Replay a reviewed captured fixture through the same normalization and transactional producer path:

```bash
KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:19092 \
KAFKA_SECURITY_PROTOCOL=PLAINTEXT \
cargo run --locked --manifest-path services/market-data/Cargo.toml --bin replay -- \
  services/market-data/tests/fixtures/alpaca_equity.json equity
```

Replay is deterministic. Repeating the command produces the same event IDs, and the PostgreSQL writer records duplicates instead of creating second domain rows.

## Failure response

- `health/ready` reports `database=unavailable`: stop ingestion traffic, restore PostgreSQL connectivity, and confirm migrations before restarting. Kafka offsets do not advance while persistence fails.
- `health/ready` reports `kafka=unavailable`: inspect broker reachability, transaction permissions, consumer-group permissions, and OAuth refresh logs. The bounded provider pipeline applies backpressure while an uncommitted batch retries.
- `stale` SSE events increase: confirm supported market hours, Alpaca subscription acknowledgements, upstream heartbeats, and reconnect logs before treating a quiet closed-market feed as an incident.
- `market_stream_lagged_events_total` increases: a client is slower than the bounded stream buffer. The client receives an explicit gap and should reconnect with `Last-Event-ID` or fetch a bounded snapshot.
- rejected events increase: inspect reasons and schema versions in `market_data.rejected_events`; do not delete or skip the record until contract compatibility is understood.

Never log or paste tokens, Alpaca credentials, raw provider payloads, or MSK OAuth values into an incident record.

## Retention and rollback

`market_data.apply_retention` is invoked daily. Archive required raw history before reducing `MARKET_RETENTION_DAYS`. Do not manually delete consumer identities ahead of retained data.

For a stream incident, stop new ingestion, route traffic to the last known-good service image, allow the writer to drain committed Kafka records, and preserve market-data tables and offsets for reconciliation. Do not drop partitions or topics during the rollback window.

Stop local services without deleting their volumes:

```bash
docker compose --profile distributed down
```

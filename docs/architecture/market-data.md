# Market Data Service Architecture

## Boundary

`services/market-data` is the concurrency-sensitive boundary between Alpaca, Kafka, market-data PostgreSQL tables, and browser SSE connections.

Alpaca equity and crypto WebSockets are separate upstream connections. Both adapters normalize captured provider payloads into `MarketBarEvent` and `MarketQuoteEvent` protobuf messages. Decimal values remain strings in the event contract and become bounded PostgreSQL numeric values only at persistence. Stock and slash-delimited crypto symbols share one validation rule.

## Delivery and ordering

Provider events enter a bounded channel so downstream failure applies backpressure instead of growing memory without limit. A deterministic UUIDv5 event ID and idempotency key are derived from provider identity fields, making fixture and production replays duplicate-safe.

The producer uses Kafka idempotence, `acks=all`, delivery confirmations, and a transaction per bounded batch. A failed batch remains in memory and is retried; no live SSE event is emitted until Kafka commits it. Consumers use `read_committed`, disable automatic offset storage and commits, and process one record until PostgreSQL succeeds. The database transaction inserts the global event ID before the partitioned domain row. Only then is the Kafka offset committed synchronously.

This is intentionally at-least-once across Kafka and PostgreSQL. A crash after the database commit but before the offset commit replays the record; `market_data.consumed_events` converts it to a recorded duplicate. Out-of-order records remain valid because bars and quotes are keyed by event time, not arrival order. Unsupported topics, schema versions, and malformed protobuf payloads are persisted in `market_data.rejected_events` with topic, partition, offset, reason, and raw bytes before their offsets advance. There is no path that acknowledges and silently discards a Kafka record.

## Storage and retention

Bars, quotes, and feed measurements are monthly range-partitioned. The service creates the previous, current, and next two monthly partitions during migration and maintenance; the default partitions preserve availability across a missed maintenance window. Symbol/time indexes support bounded historical reads. The market-data writer owns its schema, while public schema and object privileges are revoked.

Retention runs at startup and daily. Bars and feed measurements follow `MARKET_RETENTION_DAYS`; raw quotes are capped at 30 days. Consumed event identities remain seven days longer to protect the replay boundary. Archive required production data to S3 before shortening retention or dropping a partition.

## Streaming and authentication

The React client uses `fetch`, not `EventSource`, so access tokens remain in the authorization header. The Rust boundary validates issuer, audience, expiry, signature algorithm, and subject. Cognito RS256 keys are loaded from JWKS and refreshed on an unknown key ID. Local verification uses isolated disposable signing keys.

Concurrent streams are limited per subject and globally. Leases are released when the response disconnects. Each symbol has a bounded broadcast channel and replay buffer. Reconnect cursors replay events when possible; cursor eviction and slow-consumer lag are explicit `gap` events. Heartbeats keep connections observable, while an empty or delayed feed emits `stale` without inventing a market price.

## AWS compatibility

The librdkafka context supports MSK Serverless IAM through SASL/OAUTHBEARER. Tokens come from the AWS default credential chain, including EKS workload identity, and refresh without a long-lived Kafka username or password. Runtime configuration supplies `KAFKA_SECURITY_PROTOCOL=SASL_SSL`, `KAFKA_SASL_MECHANISM=OAUTHBEARER`, `AWS_REGION`, broker addresses, and least-privilege `kafka-cluster` permissions.

Structured JSON logs carry event, topic, partition, offset, and correlation metadata without tokens or provider payloads. Prometheus counters cover ingestion, publication, persistence, duplicates, rejections, stream gaps, reconnects, and active streams. Liveness changes during shutdown; readiness reflects required dependency connections. Feed age remains a per-stream signal because an open market connection can legitimately be quiet outside active windows.

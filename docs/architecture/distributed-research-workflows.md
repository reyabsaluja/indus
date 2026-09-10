# Distributed Research Workflows

## Boundary

Rails owns report metadata, authorization, quotas, lifecycle state, and the transactional outbox. Kafka carries committed lifecycle events to a Temporal starter. Temporal owns retries, deadlines, cancellation, and recovery for the multi-step report process. Generated artifacts are immutable objects in S3-compatible storage; PostgreSQL retains their keys and user-visible state.

```text
report transaction -> outbox row -> Kafka -> idempotent consumer -> Temporal workflow
                                                               -> evidence activity
                                                               -> model activity
                                                               -> artifact activity
                                                               -> terminal report state
```

The HTTP request never dual-writes PostgreSQL and Kafka. A report and its `reports.lifecycle.v1` outbox row commit together. The publisher acknowledges the row only after the broker acknowledges the event and records bounded retry metadata otherwise.

## Event delivery

Every Rails event has a versioned envelope with an event ID, producer, occurrence time, tenant, correlation ID, causation ID, and idempotency key. Consumers reject unsupported schema versions and claim an event receipt transactionally before applying its effect. Kafka delivery is therefore at least once; duplicate tolerance is mandatory and duplicate events are observable, not exceptional.

`KAFKA_AUTH_MODE=plaintext` is restricted to local Kafka-compatible brokers. `KAFKA_AUTH_MODE=msk_iam` uses AWS workload identity to mint and refresh SASL/OAUTHBEARER tokens. Static Kafka usernames and passwords are not accepted.

## Temporal execution

Each report uses workflow ID `report-<report UUID>` with duplicate workflow starts rejected. Activities use persistent leases keyed by report and activity name. A live lease prevents overlapping model or artifact writes; a stale lease can be reclaimed after its expiry. Completed activity results are reused on Temporal replay or redelivery.

The workflow progresses through evidence loading, grounded model generation, artifact persistence, and terminal metadata persistence. Activity retries handle transient dependencies. Cancellation records `cancelled` in PostgreSQL, emits a lifecycle event, and requests Temporal cancellation. Failure and cancellation activities are safe to redeliver.

## Grounding and artifacts

Evidence items have an allowlisted source ID and an as-of timestamp. User focus and provider text remain untrusted data inside the model request. The model adapter supplies a server-owned instruction, and `ModelGateway` rejects output unless every research claim cites an allowed source ID with a matching as-of value. This is a validation boundary, not a claim that model output is inherently trustworthy.

Artifacts are written through `Reports::ArtifactStore`. Local development uses MinIO with path-style addressing; AWS uses S3 through the same interface. Database rows store the object key and content metadata, not provider credentials or signed URLs. Repeated persistence uses the stable report key, and completion is recorded only after storage acknowledges the write.

## Failure behavior

- PostgreSQL unavailable: readiness fails and no authoritative state transition occurs.
- Kafka unavailable: outbox rows remain unpublished with retry metadata; report creation stays committed.
- Temporal unavailable: the Kafka receipt is not finalized until the workflow start is accepted, allowing redelivery.
- Model unavailable or invalid: Temporal retries transient errors and records a bounded terminal failure after policy exhaustion.
- Object storage unavailable: the artifact activity retries without marking the report complete.
- Process crash: Temporal history, outbox rows, event receipts, and activity leases recover work without relying on process memory.

The web application, Rails API, market-data service, and workflow workers communicate only through their documented HTTP, event, and storage boundaries.

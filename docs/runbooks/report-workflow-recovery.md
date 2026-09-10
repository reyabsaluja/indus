# Report Workflow Recovery

## Triage

Start with the owned report row, its stable workflow ID, and correlated lifecycle events. Do not repair a report by directly changing its status.

```sh
docker compose -f compose.yaml -f compose.workflows.yaml \
  --profile application --profile distributed logs platform-outbox reports-consumer research-worker
```

Use the Temporal UI at `http://127.0.0.1:18080` locally. Search for `report-<report UUID>`. A queued report without a workflow points to outbox or Kafka delivery. A running workflow with a retrying activity points to the named dependency. A terminal Temporal failure should have a bounded `failure_code` in PostgreSQL.

## Cancel a report

Queued and generating reports are cancelled through the authenticated API, using a stable idempotency key:

```http
POST /v1/reports/<report-id>/cancel
Authorization: Bearer <access-token>
Idempotency-Key: <stable-operation-key>
```

The API records cancellation before asking Temporal to cancel. Repeating the same operation is safe. A completed or failed report remains terminal.

## Requeue outbox delivery

The publisher retries due unpublished rows automatically. To release a delayed failed row early, stop or scale down competing publishers, preview a bounded selection, then execute the same selection:

```sh
cd apps/platform-api
bin/outbox-replay --failed --topic reports.lifecycle.v1 --limit 25
bin/outbox-replay --failed --topic reports.lifecycle.v1 --limit 25 --execute
```

The command preserves attempts and the last error for diagnosis while clearing the next-attempt delay. Published rows are excluded unless `--include-published` is explicit. Replaying a published event retains its event ID, so duplicate-safe consumers will normally recognize it; use this only to verify delivery or repair a deliberately reset consumer state.

Selectors include repeatable `--event-id`, `--topic`, `--failed`, and `--created-before`. The command refuses an unbounded selection and caps a run at 1,000 events.

## Kafka consumer recovery

Prefer restarting the reports consumer and allowing its committed group offset to resume. Before changing offsets, record the group, topic, partition, old offset, new offset, reason, and affected event-time range. Rewinding creates duplicates by design; consumer receipts prevent repeated workflow starts. Advancing an offset can silently skip events and is not an acceptable repair unless every skipped event has been independently reconciled.

## Dependency recovery

- Kafka: restore broker health, then allow the outbox publisher and reports consumer to reconnect. Inspect unpublished counts and consumer lag.
- Temporal: restore the namespace and worker connectivity. Existing histories resume; do not create a second workflow ID.
- Object storage: restore bucket access and rerun the failed activity through Temporal. Do not mark the report complete without the stable object key.
- Model provider: verify bounded credentials and quota, then allow the workflow retry policy to proceed. Never paste private prompts or provider payloads into incident logs.

Rollback uses the traffic and reconciliation controls in the deployment runbook; database migrations and user writes require forward-only repair.

# Local Distributed Platform

## Purpose

This stack exercises Rails, React, market-data, Kafka, Temporal, and object-storage boundaries without production credentials. `compose.yaml` owns the base application and market-data services. `compose.workflows.yaml` is a modular overlay for the report workflow processes.

## Start

Install Docker with Compose v2, Bun, and `curl`. From the repository root:

```sh
docker compose -f compose.yaml -f compose.workflows.yaml \
  --profile application --profile distributed \
  up --detach --wait platform-api platform-outbox reports-consumer research-worker temporal-ui web
```

The one-shot services prepare the Rails database, create Kafka topics, and create the report artifact bucket before dependent processes start. All disposable passwords in the Compose files are local-only defaults. Override them through the environment when the machine is shared.

| Endpoint | Address |
|---|---|
| React application | `http://127.0.0.1:14173` |
| Rails API | `http://127.0.0.1:13000` |
| Market stream | `http://127.0.0.1:18081` |
| Temporal UI | `http://127.0.0.1:18080` |
| MinIO API | `http://127.0.0.1:19000` |
| MinIO console | `http://127.0.0.1:19001` |
| Kafka bootstrap | `127.0.0.1:19092` |

Check Rails with:

```sh
curl --fail http://127.0.0.1:13000/healthz
curl --fail http://127.0.0.1:13000/readyz
```

Authentication fails closed until disposable Supabase issuer configuration is supplied. Report model execution also requires a local `GEMINI_API_KEY`; leaving it empty is supported for infrastructure and failure-path checks but generated reports will reach a bounded failure.

## Verification

The aggregate check runs application verification, Rust verification, migration transformation tests, starts the distributed stack, and restarts Kafka, Temporal, and MinIO while checking durable data:

```sh
bun run test:phase3
```

It requires a healthy Docker engine and leaves services running for inspection. It creates and then removes only a uniquely named verification topic and object.

## Inspect and stop

```sh
docker compose -f compose.yaml -f compose.workflows.yaml \
  --profile application --profile distributed ps
docker compose -f compose.yaml -f compose.workflows.yaml \
  --profile application --profile distributed logs reports-consumer research-worker
docker compose -f compose.yaml -f compose.workflows.yaml \
  --profile application --profile distributed down
```

`down` preserves named PostgreSQL, Redis, market-data, and artifact volumes. Add `--volumes` only when intentionally discarding the entire disposable local dataset.

If a one-shot service failed, inspect `platform-migrate`, `workflow-topic-init`, or `minio-init` logs first. If workers continually restart, confirm that Redpanda reports healthy, Temporal responds on port 7233 inside the Compose network, and the Rails schema is current.

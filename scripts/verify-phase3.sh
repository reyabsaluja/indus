#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
rails_image=indus-rails-toolchain:8.1.3.1
compose=(docker compose -f compose.yaml -f compose.workflows.yaml --profile application --profile distributed)
smoke_topic="phase3-verification-${PPID}"
smoke_object="verification/${PPID}.txt"
smoke_payload="indus-phase3-${PPID}"

cd "$repo_root"

if ! docker version >/dev/null 2>&1; then
  echo "Phase 3 verification requires a running Docker engine." >&2
  exit 1
fi
if [[ ! -x scripts/verify-market-data.sh ]]; then
  echo "scripts/verify-market-data.sh is required from the Phase 3 market-data change." >&2
  exit 1
fi

cleanup_smoke_artifacts() {
  "${compose[@]}" exec -T redpanda rpk topic delete "$smoke_topic" --brokers redpanda:9092 >/dev/null 2>&1 || true
  # Expansion occurs inside the disposable MinIO client container.
  # shellcheck disable=SC2016
  "${compose[@]}" run -T --rm --no-deps --env SMOKE_OBJECT="$smoke_object" --entrypoint /bin/sh minio-init -ec \
    'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm "local/indus-report-artifacts/$SMOKE_OBJECT"' \
    >/dev/null 2>&1 || true
}
trap cleanup_smoke_artifacts EXIT

echo "Running the Phase 2 application and contract verification baseline"
scripts/verify-phase2.sh

echo "Running market-data verification"
scripts/verify-market-data.sh

echo "Running migration transformation tests"
docker run --rm --volume "$repo_root:/workspace" --workdir /workspace "$rails_image" \
  ruby scripts/migration/test_transform.rb

echo "Validating and starting the distributed local platform"
"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait platform-api platform-outbox reports-consumer research-worker temporal-ui web
curl --fail --silent http://127.0.0.1:13000/healthz >/dev/null
curl --fail --silent http://127.0.0.1:13000/readyz >/dev/null
curl --fail --silent http://127.0.0.1:14173/ >/dev/null
"${compose[@]}" exec -T temporal temporal operator cluster health --address 127.0.0.1:7233 >/dev/null
curl --fail --silent http://127.0.0.1:19000/minio/health/ready >/dev/null

echo "Checking Kafka acknowledgement and broker restart recovery"
"${compose[@]}" exec -T redpanda rpk topic create "$smoke_topic" --brokers redpanda:9092 >/dev/null
printf '%s\n' "$smoke_payload" | "${compose[@]}" exec -T redpanda rpk topic produce "$smoke_topic" --brokers redpanda:9092 >/dev/null
"${compose[@]}" restart redpanda >/dev/null
"${compose[@]}" up --detach --wait redpanda >/dev/null
"${compose[@]}" exec -T redpanda rpk topic consume "$smoke_topic" --num 1 --offset start --brokers redpanda:9092 | grep --fixed-strings "$smoke_payload" >/dev/null

echo "Checking Temporal restart recovery"
"${compose[@]}" restart temporal >/dev/null
"${compose[@]}" up --detach --wait temporal >/dev/null
"${compose[@]}" exec -T temporal temporal operator cluster health --address 127.0.0.1:7233 >/dev/null

echo "Checking report artifact persistence across object-storage restart"
# Expansion occurs inside the disposable MinIO client container.
# shellcheck disable=SC2016
printf '%s\n' "$smoke_payload" | "${compose[@]}" run -T --rm --no-deps --env SMOKE_OBJECT="$smoke_object" \
  --entrypoint /bin/sh minio-init -ec \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc pipe "local/indus-report-artifacts/$SMOKE_OBJECT"' \
  >/dev/null
"${compose[@]}" restart minio >/dev/null
"${compose[@]}" up --detach --wait minio >/dev/null
# Expansion occurs inside the disposable MinIO client container.
# shellcheck disable=SC2016
"${compose[@]}" run -T --rm --no-deps --env SMOKE_OBJECT="$smoke_object" --entrypoint /bin/sh minio-init -ec \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc stat "local/indus-report-artifacts/$SMOKE_OBJECT"' \
  >/dev/null

echo "Checking workflow processes after dependency recovery"
for service in platform-api platform-outbox reports-consumer research-worker; do
  container_id=$("${compose[@]}" ps --quiet "$service")
  [[ -n "$container_id" && "$(docker inspect --format '{{.State.Running}}' "$container_id")" == "true" ]]
done

echo "Phase 3 verification passed. Local services remain running for inspection."

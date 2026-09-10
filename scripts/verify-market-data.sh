#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
service_dir="$repo_root/services/market-data"

cd "$service_dir"
cargo fmt --all -- --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets

if ! command -v docker >/dev/null 2>&1 || ! docker version >/dev/null 2>&1; then
  echo "Docker is unavailable; skipped the disposable PostgreSQL, Kafka, and image checks." >&2
  exit 0
fi

cd "$repo_root"
docker compose --profile distributed up --detach --wait postgres redpanda
docker compose --profile distributed run --rm redpanda-init
TEST_DATABASE_URL=postgres://indus:indus-local-password@127.0.0.1:15432/indus_development \
  cargo test --locked --manifest-path services/market-data/Cargo.toml --test postgres_persistence
TEST_DATABASE_URL=postgres://indus:indus-local-password@127.0.0.1:15432/indus_development \
TEST_KAFKA_BROKERS=127.0.0.1:19092 \
  cargo test --locked --manifest-path services/market-data/Cargo.toml --test kafka_delivery
docker compose --profile distributed build market-data
docker compose --profile distributed up --detach --wait market-data
curl --fail --silent http://127.0.0.1:18081/health/ready >/dev/null

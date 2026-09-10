#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
rails_image=indus-rails-toolchain:8.1.3.1

cd "$repo_root"

sh contracts/scripts/validate.sh
sh contracts/scripts/verify-generated.sh

docker compose up --detach --wait postgres redis
docker build --tag "$rails_image" tooling/rails

docker run --rm \
  --entrypoint sh \
  --network indus_default \
  --volume "$repo_root/apps/platform-api:/workspace" \
  --workdir /workspace \
  --env DATABASE_URL=postgres://indus:indus-local-password@postgres:5432/indus_test \
  --env REDIS_URL=redis://redis:6379/1 \
  --env RAILS_ENV=test \
  "$rails_image" \
  -lc 'bundle check || bundle install; bin/rails db:prepare; bundle exec rspec; bin/rubocop; bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error; bin/bundler-audit check --update'

docker build --tag indus-platform-api:phase2 apps/platform-api

(
  cd apps/web
  bun install --frozen-lockfile
  bun run lint
  bun run typecheck
  bun run test
  bun run build
  bunx playwright install chromium firefox webkit
  bun run test:e2e
)

bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build

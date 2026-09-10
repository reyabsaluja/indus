#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/indus-auth-test.XXXXXX)"

cleanup() {
  bunx supabase stop --workdir "$test_root" --no-backup >/dev/null 2>&1 || true
  case "$test_root" in
    /tmp/indus-auth-test.*) rm -r "$test_root" ;;
    *) echo "Refusing to remove unexpected test path: $test_root" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

for command_name in docker curl jq; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required for authenticated browser verification." >&2
    exit 1
  }
done

docker info >/dev/null 2>&1 || {
  echo "The Docker daemon is not available." >&2
  exit 1
}

mkdir -p "$test_root/supabase"
cp "$repo_root/supabase/config.auth-test.toml" "$test_root/supabase/config.toml"
cp -R "$repo_root/supabase/migrations" "$test_root/supabase/migrations"

echo "Starting isolated Supabase authentication verification."
bunx supabase start --workdir "$test_root" \
  -x edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector \
  >/dev/null

status_json="$(bunx supabase status --workdir "$test_root" --output json 2>/dev/null)"
export NEXT_PUBLIC_SUPABASE_URL="$(jq -er '.API_URL' <<<"$status_json")"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(jq -er '.ANON_KEY' <<<"$status_json")"
service_role_key="$(jq -er '.SERVICE_ROLE_KEY' <<<"$status_json")"
export E2E_AUTH_EMAIL="authenticated-user@example.test"
export E2E_AUTH_PASSWORD="Local-auth-test-password-2026"

user_payload="$(jq -n \
  --arg email "$E2E_AUTH_EMAIL" \
  --arg password "$E2E_AUTH_PASSWORD" \
  '{email: $email, password: $password, email_confirm: true}')"
curl --fail --silent --show-error \
  --request POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  --header "apikey: $service_role_key" \
  --header "Authorization: Bearer $service_role_key" \
  --header "Content-Type: application/json" \
  --data "$user_payload" >/dev/null

export E2E_USE_PRODUCTION=true
export ALPACA_API_KEY="${ALPACA_API_KEY:-test-alpaca-key}"
export ALPACA_SECRET_KEY="${ALPACA_SECRET_KEY:-test-alpaca-secret}"
export ALPACA_IS_PAPER="${ALPACA_IS_PAPER:-true}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-test-gemini-key}"

bun run build
bunx playwright test --grep @authenticated --project=chromium --workers=1

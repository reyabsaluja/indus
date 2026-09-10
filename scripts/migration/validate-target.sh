#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "Usage: TARGET_DATABASE_URL=postgres://... $0 TRANSFORMED_DIRECTORY" >&2
  exit 64
fi

expected_directory=$(cd "$1" && pwd)
reconciliation_directory=$(mktemp -d /tmp/indus-migration-reconcile.XXXXXX)
cleanup() {
  case "$reconciliation_directory" in
    /tmp/indus-migration-reconcile.*) rm -r "$reconciliation_directory" ;;
    *) echo "Refusing to remove unexpected path" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

cp "$expected_directory/manifest.json" "$expected_directory/cognito_identities.jsonl" "$reconciliation_directory/"
psql "$TARGET_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id,issuer,external_subject,email,display_name,to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at,to_char(updated_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM users ORDER BY id" >"$reconciliation_directory/users.csv"
psql "$TARGET_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id,user_id,symbol,instrument_type,to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at,to_char(updated_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM favorites ORDER BY id" >"$reconciliation_directory/favorites.csv"
psql "$TARGET_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id,user_id,symbol,title,status,summary,content,to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at,to_char(updated_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM reports ORDER BY id" >"$reconciliation_directory/reports.csv"
psql "$TARGET_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT user_id,operation,window_type,to_char(window_started_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS window_started_at,request_count,input_tokens,output_tokens,to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at,to_char(updated_at,'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM ai_usage_windows ORDER BY user_id,operation,window_type,window_started_at" \
  >"$reconciliation_directory/ai_usage_windows.csv"

ruby "$(dirname "$0")/transform.rb" validate "$reconciliation_directory"
echo "Target row counts, canonical checksums, ownership references, and identities reconcile"

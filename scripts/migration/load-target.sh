#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "Usage: TARGET_DATABASE_URL=postgres://... $0 TRANSFORMED_DIRECTORY" >&2
  exit 64
fi

input_directory=$(cd "$1" && pwd)
if [[ ! "$input_directory" =~ ^[A-Za-z0-9_./-]+$ ]]; then
  echo "The transformed directory contains unsupported characters." >&2
  exit 65
fi

ruby "$(dirname "$0")/transform.rb" validate "$input_directory"

psql "$TARGET_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction \
  --command "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM users LIMIT 1) OR EXISTS (SELECT 1 FROM favorites LIMIT 1) OR EXISTS (SELECT 1 FROM reports LIMIT 1) OR EXISTS (SELECT 1 FROM ai_usage_windows LIMIT 1) THEN RAISE EXCEPTION 'target migration tables are not empty'; END IF; END \$\$;" \
  --command "\copy users(id,issuer,external_subject,email,display_name,created_at,updated_at) FROM '$input_directory/users.csv' CSV HEADER" \
  --command "\copy favorites(id,user_id,symbol,instrument_type,created_at,updated_at) FROM '$input_directory/favorites.csv' CSV HEADER" \
  --command "\copy reports(id,user_id,symbol,title,status,summary,content,created_at,updated_at) FROM '$input_directory/reports.csv' CSV HEADER" \
  --command "\copy ai_usage_windows(user_id,operation,window_type,window_started_at,request_count,input_tokens,output_tokens,created_at,updated_at) FROM '$input_directory/ai_usage_windows.csv' CSV HEADER"

echo "Transformed rows loaded into the empty target database"

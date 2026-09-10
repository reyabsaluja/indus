#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "Usage: SOURCE_DATABASE_URL=postgres://... $0 OUTPUT_DIRECTORY" >&2
  exit 64
fi

output_directory=$1
mkdir -p "$output_directory"
chmod 700 "$output_directory"
umask 077

psql "$SOURCE_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id, email, raw_user_meta_data::text, created_at FROM auth.users ORDER BY id" >"$output_directory/auth_users.csv"
psql "$SOURCE_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id, user_id, symbol, created_at FROM public.favorites ORDER BY id" >"$output_directory/favorites.csv"
psql "$SOURCE_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id, user_id, symbol, company_name, status, report_content, summary, created_at FROM public.reports ORDER BY id" \
  >"$output_directory/reports.csv"
psql "$SOURCE_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT user_id, function_name, window_type, window_start, request_count FROM public.ai_usage_windows ORDER BY user_id, function_name, window_type, window_start" \
  >"$output_directory/ai_usage_windows.csv"
psql "$SOURCE_DATABASE_URL" --no-psqlrc --set ON_ERROR_STOP=1 --csv --command \
  "SELECT id, symbol, metric, explanation::text, created_at FROM public.metric_explanations ORDER BY id" \
  >"$output_directory/metric_explanations.csv"

echo "Supabase export written to $output_directory"

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_06_001000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "ai_usage_windows", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "input_tokens", default: 0, null: false
    t.string "operation", null: false
    t.integer "output_tokens", default: 0, null: false
    t.integer "request_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.datetime "window_started_at", null: false
    t.string "window_type", default: "hour", null: false
    t.index ["user_id", "operation", "window_type", "window_started_at"], name: "ai_usage_window_identity", unique: true
    t.index ["user_id"], name: "index_ai_usage_windows_on_user_id"
    t.check_constraint "request_count >= 0 AND input_tokens >= 0 AND output_tokens >= 0", name: "ai_usage_nonnegative"
    t.check_constraint "window_type::text = ANY (ARRAY['hour'::character varying, 'day'::character varying]::text[])", name: "ai_usage_window_type"
  end

  create_table "audit_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "action", null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "occurred_at", null: false
    t.uuid "resource_id"
    t.string "resource_type", null: false
    t.uuid "user_id"
    t.index ["user_id", "occurred_at"], name: "index_audit_events_on_user_id_and_occurred_at"
    t.index ["user_id"], name: "index_audit_events_on_user_id"
  end

  create_table "consumed_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "consumer", limit: 100, null: false
    t.uuid "event_id", null: false
    t.datetime "processed_at", null: false
    t.index ["consumer", "event_id"], name: "index_consumed_events_on_consumer_and_event_id", unique: true
  end

  create_table "favorites", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "instrument_type", default: "equity", null: false
    t.string "symbol", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "symbol", "instrument_type"], name: "favorites_instrument_identity", unique: true
    t.index ["user_id"], name: "index_favorites_on_user_id"
    t.check_constraint "char_length(symbol::text) <= 20 AND symbol::text ~ '^[A-Z0-9]+([./-][A-Z0-9]+)?$'::text", name: "favorites_strict_symbol"
    t.check_constraint "instrument_type::text = ANY (ARRAY['equity'::character varying::text, 'crypto'::character varying::text])", name: "favorites_instrument_type"
  end

  create_table "idempotency_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", limit: 128, null: false
    t.string "request_fingerprint", null: false
    t.jsonb "response_body"
    t.integer "response_status"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "key"], name: "index_idempotency_records_on_user_id_and_key", unique: true
    t.index ["user_id"], name: "index_idempotency_records_on_user_id"
    t.check_constraint "key::text ~ '^[A-Za-z0-9._:-]{16,128}$'::text", name: "idempotency_key_format"
  end

  create_table "outbox_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "aggregate_id", null: false
    t.string "aggregate_type", null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "last_error", limit: 120
    t.datetime "next_attempt_at"
    t.jsonb "payload", default: {}, null: false
    t.datetime "published_at"
    t.string "topic", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "outbox_unpublished", where: "(published_at IS NULL)"
    t.check_constraint "attempts >= 0", name: "outbox_attempts_nonnegative"
  end

  create_table "portfolios", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "base_currency", default: "USD", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["id", "user_id"], name: "portfolios_report_ownership", unique: true
    t.index ["user_id", "name"], name: "index_portfolios_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_portfolios_on_user_id"
  end

  create_table "positions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.decimal "average_cost", precision: 22, scale: 8, null: false
    t.datetime "created_at", null: false
    t.string "currency", default: "USD", null: false
    t.string "instrument_type", default: "equity", null: false
    t.uuid "portfolio_id", null: false
    t.decimal "quantity", precision: 28, scale: 10, null: false
    t.string "symbol", null: false
    t.datetime "updated_at", null: false
    t.index ["portfolio_id", "symbol", "instrument_type"], name: "positions_instrument_identity", unique: true
    t.index ["portfolio_id"], name: "index_positions_on_portfolio_id"
    t.check_constraint "average_cost IS NULL OR average_cost >= 0::numeric", name: "positions_nonnegative_cost"
    t.check_constraint "char_length(symbol::text) <= 20 AND symbol::text ~ '^[A-Z0-9]+([./-][A-Z0-9]+)?$'::text", name: "positions_strict_symbol"
    t.check_constraint "currency::text ~ '^[A-Z]{3}$'::text", name: "positions_currency_format"
    t.check_constraint "instrument_type::text = ANY (ARRAY['equity'::character varying::text, 'crypto'::character varying::text])", name: "positions_instrument_type"
    t.check_constraint "quantity > 0::numeric", name: "positions_positive_quantity"
  end

  create_table "report_activity_executions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "activity_key", limit: 100, null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "last_error", limit: 120
    t.datetime "lease_expires_at"
    t.uuid "report_id", null: false
    t.jsonb "result", default: {}, null: false
    t.string "status", default: "running", null: false
    t.datetime "updated_at", null: false
    t.index ["lease_expires_at"], name: "report_activity_running_leases", where: "((status)::text = 'running'::text)"
    t.index ["report_id", "activity_key"], name: "report_activity_identity", unique: true
    t.index ["report_id"], name: "index_report_activity_executions_on_report_id"
    t.check_constraint "attempts >= 0", name: "report_activity_attempts_nonnegative"
    t.check_constraint "status::text = ANY (ARRAY['running'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])", name: "report_activity_status"
  end

  create_table "report_sources", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "evidence", default: {}, null: false
    t.string "kind", null: false
    t.string "provider", null: false
    t.uuid "report_id", null: false
    t.string "source_reference", null: false
    t.datetime "updated_at", null: false
    t.index ["report_id", "kind", "source_reference"], name: "report_source_identity", unique: true
    t.index ["report_id"], name: "index_report_sources_on_report_id"
  end

  create_table "reports", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "artifact_key"
    t.datetime "completed_at"
    t.text "content"
    t.datetime "created_at", null: false
    t.string "failure_code"
    t.string "model"
    t.uuid "portfolio_id"
    t.string "status", default: "queued", null: false
    t.text "summary"
    t.string "symbol", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.string "workflow_id"
    t.index ["portfolio_id"], name: "index_reports_on_portfolio_id"
    t.index ["user_id"], name: "index_reports_on_user_id"
    t.index ["workflow_id"], name: "index_reports_on_workflow_id", unique: true, where: "(workflow_id IS NOT NULL)"
    t.check_constraint "char_length(symbol::text) <= 20 AND symbol::text ~ '^[A-Z0-9]+([./-][A-Z0-9]+)?$'::text", name: "reports_strict_symbol"
    t.check_constraint "char_length(title::text) >= 1 AND char_length(title::text) <= 200", name: "reports_title_length"
    t.check_constraint "status::text = ANY (ARRAY['queued'::character varying::text, 'generating'::character varying::text, 'completed'::character varying::text, 'failed'::character varying::text, 'cancelled'::character varying::text])", name: "reports_status"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "display_name", null: false
    t.string "email", null: false
    t.string "external_subject", null: false
    t.string "issuer", null: false
    t.datetime "updated_at", null: false
    t.index ["issuer", "external_subject"], name: "index_users_on_issuer_and_external_subject", unique: true
    t.check_constraint "char_length(display_name::text) >= 1 AND char_length(display_name::text) <= 100", name: "users_display_name_length"
    t.check_constraint "email::text ~~ '%_@_%.__%'::text", name: "users_email_shape"
  end

  add_foreign_key "ai_usage_windows", "users"
  add_foreign_key "audit_events", "users"
  add_foreign_key "favorites", "users"
  add_foreign_key "idempotency_records", "users"
  add_foreign_key "portfolios", "users"
  add_foreign_key "positions", "portfolios"
  add_foreign_key "report_activity_executions", "reports", on_delete: :cascade
  add_foreign_key "report_sources", "reports", on_delete: :cascade
  add_foreign_key "reports", "portfolios", column: ["portfolio_id", "user_id"], primary_key: ["id", "user_id"], name: "reports_portfolio_owner_fk"
  add_foreign_key "reports", "users"
end

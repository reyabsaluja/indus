class CreatePlatformFoundation < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")

    create_table :users, id: :uuid do |t|
      t.string :issuer, null: false
      t.string :external_subject, null: false
      t.string :email
      t.timestamps
    end
    add_index :users, %i[issuer external_subject], unique: true

    create_table :favorites, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :symbol, null: false
      t.timestamps
    end
    add_index :favorites, %i[user_id symbol], unique: true
    add_check_constraint :favorites, "symbol ~ '^[A-Z0-9./-]{1,20}$'", name: "favorites_symbol_format"

    create_table :portfolios, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :name, null: false
      t.string :base_currency, null: false, default: "USD"
      t.timestamps
    end
    add_index :portfolios, %i[user_id name], unique: true

    create_table :positions, id: :uuid do |t|
      t.references :portfolio, null: false, type: :uuid, foreign_key: true
      t.string :symbol, null: false
      t.decimal :quantity, null: false, precision: 28, scale: 10
      t.decimal :average_cost, precision: 20, scale: 6
      t.timestamps
    end
    add_index :positions, %i[portfolio_id symbol], unique: true
    add_check_constraint :positions, "quantity > 0", name: "positions_positive_quantity"
    add_check_constraint :positions, "average_cost IS NULL OR average_cost >= 0", name: "positions_nonnegative_cost"

    create_table :reports, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :symbol, null: false
      t.string :status, null: false, default: "pending"
      t.text :summary
      t.text :content
      t.string :model
      t.timestamps
    end
    add_check_constraint :reports, "status IN ('pending','processing','completed','failed')", name: "reports_status"

    create_table :report_sources, id: :uuid do |t|
      t.references :report, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :provider, null: false
      t.string :kind, null: false
      t.string :source_reference, null: false
      t.jsonb :evidence, null: false, default: {}
      t.timestamps
    end

    create_table :audit_events, id: :uuid do |t|
      t.references :user, type: :uuid, foreign_key: true
      t.string :action, null: false
      t.string :resource_type, null: false
      t.uuid :resource_id
      t.jsonb :metadata, null: false, default: {}
      t.datetime :occurred_at, null: false
    end
    add_index :audit_events, %i[user_id occurred_at]

    create_table :idempotency_records, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :key, null: false
      t.string :request_fingerprint, null: false
      t.integer :response_status
      t.jsonb :response_body
      t.datetime :expires_at, null: false
      t.timestamps
    end
    add_index :idempotency_records, %i[user_id key], unique: true

    create_table :outbox_events, id: :uuid do |t|
      t.string :topic, null: false
      t.string :aggregate_type, null: false
      t.uuid :aggregate_id, null: false
      t.jsonb :payload, null: false, default: {}
      t.datetime :published_at
      t.integer :attempts, null: false, default: 0
      t.timestamps
    end
    add_index :outbox_events, :created_at, where: "published_at IS NULL", name: "outbox_unpublished"

    create_table :ai_usage_windows, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :operation, null: false
      t.datetime :window_started_at, null: false
      t.integer :request_count, null: false, default: 0
      t.integer :input_tokens, null: false, default: 0
      t.integer :output_tokens, null: false, default: 0
      t.timestamps
    end
    add_index :ai_usage_windows, %i[user_id operation window_started_at], unique: true, name: "ai_usage_window_identity"
    add_check_constraint :ai_usage_windows, "request_count >= 0 AND input_tokens >= 0 AND output_tokens >= 0", name: "ai_usage_nonnegative"
  end
end

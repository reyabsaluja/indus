class AlignPlatformApiContract < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :display_name, :string, null: false
    change_column_null :users, :email, false

    remove_index :favorites, %i[user_id symbol]
    add_column :favorites, :instrument_type, :string, null: false, default: "equity"
    add_index :favorites, %i[user_id symbol instrument_type], unique: true, name: "favorites_instrument_identity"
    add_check_constraint :favorites, "instrument_type IN ('equity','crypto')", name: "favorites_instrument_type"

    add_column :positions, :instrument_type, :string, null: false, default: "equity"
    add_column :positions, :currency, :string, null: false, default: "USD"
    change_column_null :positions, :average_cost, false
    add_check_constraint :positions, "instrument_type IN ('equity','crypto')", name: "positions_instrument_type"
    add_check_constraint :positions, "currency ~ '^[A-Z]{3}$'", name: "positions_currency_format"

    add_column :reports, :portfolio_id, :uuid
    add_column :reports, :title, :string
    add_column :reports, :failure_code, :string
    add_foreign_key :reports, :portfolios
    add_index :reports, :portfolio_id
    remove_check_constraint :reports, name: "reports_status"
    change_column_default :reports, :status, from: "pending", to: "queued"
    execute "UPDATE reports SET status = 'queued' WHERE status = 'pending'"
    execute "UPDATE reports SET status = 'generating' WHERE status = 'processing'"
    add_check_constraint :reports, "status IN ('queued','generating','completed','failed','cancelled')", name: "reports_status"

    change_column :idempotency_records, :key, :string, limit: 128
  end
end

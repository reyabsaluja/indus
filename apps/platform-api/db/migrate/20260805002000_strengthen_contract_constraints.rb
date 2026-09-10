class StrengthenContractConstraints < ActiveRecord::Migration[8.1]
  def change
    add_check_constraint :users, "char_length(display_name) BETWEEN 1 AND 100", name: "users_display_name_length"
    add_check_constraint :users, "email LIKE '%_@_%.__%'", name: "users_email_shape"

    remove_index :positions, %i[portfolio_id symbol]
    add_index :positions, %i[portfolio_id symbol instrument_type], unique: true, name: "positions_instrument_identity"

    execute "UPDATE reports SET title = symbol || ' research report' WHERE title IS NULL"
    change_column_null :reports, :title, false
    add_check_constraint :reports, "char_length(title) BETWEEN 1 AND 200", name: "reports_title_length"
    add_check_constraint :idempotency_records,
      "key ~ '^[A-Za-z0-9._:-]{16,128}$'", name: "idempotency_key_format"
  end
end

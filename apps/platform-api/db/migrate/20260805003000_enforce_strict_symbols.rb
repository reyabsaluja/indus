class EnforceStrictSymbols < ActiveRecord::Migration[8.1]
  TABLES = %i[favorites positions reports].freeze

  def change
    remove_check_constraint :favorites, name: "favorites_symbol_format"
    TABLES.each do |table|
      add_check_constraint table,
        "char_length(symbol) <= 20 AND symbol ~ '^[A-Z0-9]+([./-][A-Z0-9]+)?$'",
        name: "#{table}_strict_symbol"
    end
  end
end

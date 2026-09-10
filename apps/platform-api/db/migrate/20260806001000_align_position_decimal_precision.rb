class AlignPositionDecimalPrecision < ActiveRecord::Migration[8.1]
  def change
    change_column :positions, :average_cost, :decimal, precision: 22, scale: 8, null: false
  end
end

class AddDistributedDeliveryState < ActiveRecord::Migration[8.1]
  def change
    change_table :outbox_events, bulk: true do |t|
      t.datetime :next_attempt_at
      t.string :last_error, limit: 120
    end
    add_check_constraint :outbox_events, "attempts >= 0", name: "outbox_attempts_nonnegative"

    create_table :consumed_events, id: :uuid do |t|
      t.string :consumer, null: false, limit: 100
      t.uuid :event_id, null: false
      t.datetime :processed_at, null: false
    end
    add_index :consumed_events, %i[consumer event_id], unique: true
  end
end

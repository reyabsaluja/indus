class AddDailyAiUsageWindows < ActiveRecord::Migration[8.1]
  def change
    add_column :ai_usage_windows, :window_type, :string, null: false, default: "hour"
    remove_index :ai_usage_windows, name: "ai_usage_window_identity"
    add_index :ai_usage_windows, %i[user_id operation window_type window_started_at], unique: true,
      name: "ai_usage_window_identity"
    add_check_constraint :ai_usage_windows, "window_type IN ('hour','day')", name: "ai_usage_window_type"
  end
end

class AddReportActivityLeases < ActiveRecord::Migration[8.1]
  def change
    add_column :report_activity_executions, :lease_expires_at, :datetime
    add_index :report_activity_executions, :lease_expires_at, where: "status = 'running'",
      name: "report_activity_running_leases"
  end
end

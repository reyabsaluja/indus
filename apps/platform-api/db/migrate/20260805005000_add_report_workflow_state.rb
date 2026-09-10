class AddReportWorkflowState < ActiveRecord::Migration[8.1]
  def change
    change_table :reports, bulk: true do |t|
      t.string :workflow_id
      t.string :artifact_key
      t.datetime :completed_at
    end
    add_index :reports, :workflow_id, unique: true, where: "workflow_id IS NOT NULL"

    create_table :report_activity_executions, id: :uuid do |t|
      t.references :report, null: false, type: :uuid, foreign_key: { on_delete: :cascade }
      t.string :activity_key, null: false, limit: 100
      t.string :status, null: false, default: "running"
      t.integer :attempts, null: false, default: 0
      t.jsonb :result, null: false, default: {}
      t.string :last_error, limit: 120
      t.timestamps
    end
    add_index :report_activity_executions, %i[report_id activity_key], unique: true, name: "report_activity_identity"
    add_check_constraint :report_activity_executions, "status IN ('running','completed','failed')",
      name: "report_activity_status"
    add_check_constraint :report_activity_executions, "attempts >= 0", name: "report_activity_attempts_nonnegative"
    add_index :report_sources, %i[report_id kind source_reference], unique: true, name: "report_source_identity"
  end
end

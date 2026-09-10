class EnforceReportPortfolioOwnership < ActiveRecord::Migration[8.1]
  def up
    mismatched_reports = select_value(<<~SQL).to_i
      SELECT COUNT(*)
      FROM reports
      INNER JOIN portfolios ON portfolios.id = reports.portfolio_id
      WHERE reports.user_id <> portfolios.user_id
    SQL
    if mismatched_reports.positive?
      raise ActiveRecord::MigrationError, "reports contain portfolio references owned by a different user"
    end

    add_index :portfolios, %i[id user_id], unique: true, name: "portfolios_report_ownership"
    remove_foreign_key :reports, :portfolios
    add_foreign_key :reports, :portfolios, column: %i[portfolio_id user_id], primary_key: %i[id user_id],
      name: "reports_portfolio_owner_fk"
  end

  def down
    remove_foreign_key :reports, name: "reports_portfolio_owner_fk"
    add_foreign_key :reports, :portfolios
    remove_index :portfolios, name: "portfolios_report_ownership"
  end
end

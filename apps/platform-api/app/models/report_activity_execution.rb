class ReportActivityExecution < ApplicationRecord
  STATUSES = %w[running completed failed].freeze
  belongs_to :report
  validates :activity_key, presence: true, length: { maximum: 100 }, uniqueness: { scope: :report_id }
  validates :status, inclusion: { in: STATUSES }
  validates :attempts, numericality: { greater_than_or_equal_to: 0 }
end

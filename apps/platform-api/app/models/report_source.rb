class ReportSource < ApplicationRecord
  MAX_PER_REPORT = 100
  belongs_to :report
  validates :provider, :kind, :source_reference, presence: true
  validates :source_reference, length: { maximum: 200 }
  validate :report_capacity, on: :create

  private

  def report_capacity
    return unless report_id

    Report.lock.find(report_id)
    errors.add(:base, "report source limit reached") if ReportSource.where(report_id: report_id).count >= MAX_PER_REPORT
  end
end

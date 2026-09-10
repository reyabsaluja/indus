class Report < ApplicationRecord
  STATUSES = %w[queued generating completed failed cancelled].freeze
  belongs_to :user
  belongs_to :portfolio, optional: true
  has_many :report_sources, dependent: :destroy
  has_many :report_activity_executions, dependent: :destroy
  before_validation { self.symbol = symbol.to_s.upcase.strip }
  validates :symbol, length: { maximum: 20 }, format: { with: /\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/ }
  validates :status, inclusion: { in: STATUSES }
  validates :title, presence: true, length: { maximum: 200 }
  validates :workflow_id, uniqueness: true, allow_nil: true
  validate :portfolio_belongs_to_user

  private

  def portfolio_belongs_to_user
    return if portfolio.nil? || user_id.nil? || portfolio.user_id == user_id

    errors.add(:portfolio, "must belong to the report owner")
  end
end

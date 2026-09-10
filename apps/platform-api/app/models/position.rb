class Position < ApplicationRecord
  MAX_PER_PORTFOLIO = 1_000
  QUANTITY_PATTERN = /\A(?=.{1,29}\z)(?=.*[1-9])(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,10})?\z/
  AVERAGE_COST_PATTERN = /\A(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,8})?\z/
  belongs_to :portfolio
  before_validation { self.symbol = symbol.to_s.upcase.strip }
  validates :symbol, length: { maximum: 20 }, format: { with: /\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/ },
    uniqueness: { scope: %i[portfolio_id instrument_type] }
  validates :quantity, numericality: { greater_than: 0 }
  validates :average_cost, numericality: { greater_than_or_equal_to: 0 }
  validates :instrument_type, inclusion: { in: %w[equity crypto] }
  validates :currency, format: { with: /\A[A-Z]{3}\z/ }
  validate :decimal_precision
  validate :portfolio_capacity, on: :create

  private

  def portfolio_capacity
    return unless portfolio_id

    Portfolio.lock.find(portfolio_id)
    errors.add(:base, "portfolio position limit reached") if Position.where(portfolio_id: portfolio_id).count >= MAX_PER_PORTFOLIO
  end

  def decimal_precision
    errors.add(:quantity, "must have at most 18 integer and 10 fractional digits") unless
      decimal_input(:quantity).match?(QUANTITY_PATTERN)
    errors.add(:average_cost, "must have at most 14 integer and 8 fractional digits") unless
      decimal_input(:average_cost).match?(AVERAGE_COST_PATTERN)
  end

  def decimal_input(attribute)
    value = public_send("#{attribute}_before_type_cast")
    value.is_a?(BigDecimal) ? value.to_s("F") : value.to_s
  end
end

class Favorite < ApplicationRecord
  belongs_to :user
  before_validation { self.symbol = symbol.to_s.upcase.strip }
  validates :symbol, length: { maximum: 20 }, format: { with: /\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/ },
    uniqueness: { scope: %i[user_id instrument_type] }
  validates :instrument_type, inclusion: { in: %w[equity crypto] }
end

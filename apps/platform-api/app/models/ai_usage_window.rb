class AiUsageWindow < QuotaRecord
  belongs_to :user
  validates :operation, :window_started_at, presence: true
  validates :request_count, :input_tokens, :output_tokens, numericality: { greater_than_or_equal_to: 0 }
end

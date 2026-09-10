class OutboxEvent < ApplicationRecord
  scope :unpublished, -> { where(published_at: nil).where("next_attempt_at IS NULL OR next_attempt_at <= ?", Time.current).order(:created_at) }
  validates :topic, :aggregate_type, :aggregate_id, presence: true
  validates :attempts, numericality: { greater_than_or_equal_to: 0 }
end

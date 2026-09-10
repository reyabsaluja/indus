class OutboxEvent < ApplicationRecord
  scope :unpublished, -> { where(published_at: nil).order(:created_at) }
  validates :topic, :aggregate_type, :aggregate_id, presence: true
end

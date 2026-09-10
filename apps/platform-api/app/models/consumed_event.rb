class ConsumedEvent < ApplicationRecord
  validates :consumer, :event_id, :processed_at, presence: true
  validates :event_id, uniqueness: { scope: :consumer }
end

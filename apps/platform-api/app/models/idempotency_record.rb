class IdempotencyRecord < ApplicationRecord
  belongs_to :user
  validates :key, :request_fingerprint, :expires_at, presence: true
  validates :key, uniqueness: { scope: :user_id }, format: { with: /\A[A-Za-z0-9._:-]{16,128}\z/ }
end

class User < ApplicationRecord
  has_many :favorites, dependent: :destroy
  has_many :portfolios, dependent: :destroy
  has_many :reports, dependent: :destroy

  validates :issuer, :external_subject, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :display_name, presence: true, length: { maximum: 100 }
end

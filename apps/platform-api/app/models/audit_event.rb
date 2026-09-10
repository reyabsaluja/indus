class AuditEvent < ApplicationRecord
  belongs_to :user, optional: true
  validates :action, :resource_type, :occurred_at, presence: true
end

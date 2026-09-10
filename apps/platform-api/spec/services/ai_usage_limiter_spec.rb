require "rails_helper"

RSpec.describe AiUsageLimiter do
  let(:user) { User.create!(issuer: "issuer", external_subject: SecureRandom.uuid, email: "usage@example.test", display_name: "Usage") }
  let(:now) { Time.zone.parse("2026-08-05 10:15:00") }

  it "counts requests in an hourly user and operation window" do
    2.times { described_class.new(user: user, operation: "report", now: now, limit: 2).consume! }
    usage = AiUsageWindow.find_by!(user: user, operation: "report")
    expect(usage.attributes).to include("window_started_at" => now.beginning_of_hour, "request_count" => 2)
  end

  it "rejects requests after the configured limit without incrementing" do
    limiter = described_class.new(user: user, operation: "report", now: now, limit: 1)
    limiter.consume!
    expect { limiter.consume! }.to raise_error(AiUsageLimiter::LimitExceeded)
    expect(AiUsageWindow.find_by!(user: user, operation: "report").request_count).to eq(1)
  end

  it "isolates usage by operation" do
    described_class.new(user: user, operation: "report", now: now, limit: 1).consume!
    expect { described_class.new(user: user, operation: "explanation", now: now, limit: 1).consume! }.not_to raise_error
  end

  it "bounds retries when concurrent inserts repeatedly violate the unique window" do
    allow(AiUsageWindow).to receive(:transaction).and_raise(ActiveRecord::RecordNotUnique)

    expect { described_class.new(user: user, operation: "report", now: now).consume! }
      .to raise_error(ActiveRecord::RecordNotUnique)
    expect(AiUsageWindow).to have_received(:transaction).exactly(AiUsageLimiter::MAX_CONFLICT_ATTEMPTS).times
  end
end

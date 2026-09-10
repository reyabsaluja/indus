require "rails_helper"

RSpec.describe Events::Envelope do
  subject(:payload) do
    { "envelope" => described_class.build(event_id: SecureRandom.uuid, event_type: "report.queued",
      tenant_id: SecureRandom.uuid, correlation_id: SecureRandom.uuid,
      idempotency_key: SecureRandom.uuid).deep_stringify_keys }
  end

  it "accepts the complete current event contract" do
    expect(described_class.validate!(payload)).to eq(payload)
  end

  it "rejects missing fields, malformed timestamps, and future schemas" do
    missing = payload.deep_dup
    missing.fetch("envelope").delete("correlation_id")
    expect { described_class.validate!(missing) }.to raise_error(ArgumentError, /correlation_id/)

    malformed_time = payload.deep_dup
    malformed_time.dig("envelope")["occurred_at"] = "not-a-time"
    expect { described_class.validate!(malformed_time) }.to raise_error(ArgumentError, /invalid event envelope/)

    future = payload.deep_dup
    future.dig("envelope")["schema_version"] = described_class::SCHEMA_VERSION + 1
    expect { described_class.validate!(future) }.to raise_error(ArgumentError, /schema version/)
  end
end

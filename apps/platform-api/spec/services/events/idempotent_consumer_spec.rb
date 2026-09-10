require "rails_helper"

RSpec.describe Events::IdempotentConsumer do
  let(:payload) do
    { "envelope" => Events::Envelope.build(event_id: SecureRandom.uuid, event_type: "report.queued",
      tenant_id: SecureRandom.uuid, correlation_id: SecureRandom.uuid, idempotency_key: SecureRandom.uuid).deep_stringify_keys }
  end

  it "commits a side effect and receipt atomically and suppresses duplicate delivery" do
    calls = 0
    consumer = described_class.new(name: "report-workflow-starter")
    expect(consumer.process(payload) { calls += 1 }).to eq(:processed)
    expect(consumer.process(payload) { calls += 1 }).to eq(:duplicate)
    expect(calls).to eq(1)
  end

  it "does not record a receipt when processing fails" do
    consumer = described_class.new(name: "report-workflow-starter")
    expect { consumer.process(payload) { raise "failed" } }.to raise_error("failed")
    expect(ConsumedEvent.count).to eq(0)
  end

  it "rejects an unsupported envelope before invoking a side effect" do
    payload["envelope"]["schema_version"] = 2
    side_effect = proc { raise "must not run" }

    expect { described_class.new(name: "report-workflow-starter").process(payload, &side_effect) }
      .to raise_error(ArgumentError, /schema version/)
    expect(ConsumedEvent.count).to eq(0)
  end
end

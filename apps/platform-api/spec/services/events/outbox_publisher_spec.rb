require "rails_helper"

RSpec.describe Events::OutboxPublisher do
  let(:now) { Time.zone.parse("2026-08-05T12:00:00Z") }
  let(:clock) { class_double(Time, current: now) }
  let(:producer) { instance_double(Events::KafkaProducer, publish: true) }
  let(:event) do
    OutboxEvent.create!(topic: "reports.lifecycle.v1", aggregate_type: "Report", aggregate_id: SecureRandom.uuid,
      payload: { envelope: Events::Envelope.build(event_id: SecureRandom.uuid, event_type: "report.queued",
        tenant_id: SecureRandom.uuid, correlation_id: SecureRandom.uuid, idempotency_key: SecureRandom.uuid) })
  end

  it "acknowledges an outbox row only after Kafka acknowledges it" do
    expect(described_class.new(producer: producer, clock: clock).publish_one(event.id)).to be(true)
    expect(event.reload).to have_attributes(published_at: now, attempts: 1, last_error: nil)
    expect(producer).to have_received(:publish).with(hash_including(topic: "reports.lifecycle.v1", key: event.aggregate_id))
  end

  it "retains failed rows with bounded retry metadata" do
    allow(producer).to receive(:publish).and_raise(StandardError, "broker unavailable")
    expect(described_class.new(producer: producer, clock: clock).publish_one(event.id)).to be(false)
    expect(event.reload).to have_attributes(published_at: nil, attempts: 1, last_error: "StandardError")
    expect(event.next_attempt_at).to eq(now + 2.seconds)
  end

  it "publishes only eligible rows within the requested batch bound" do
    eligible = event
    future = OutboxEvent.create!(topic: "reports.lifecycle.v1", aggregate_type: "Report",
      aggregate_id: SecureRandom.uuid, next_attempt_at: 1.day.from_now, payload: event.payload)
    second = OutboxEvent.create!(topic: "reports.lifecycle.v1", aggregate_type: "Report",
      aggregate_id: SecureRandom.uuid, payload: event.payload)

    publisher = described_class.new(producer: producer, clock: clock)
    expect(publisher.publish_batch(limit: 1)).to eq(1)
    expect([ eligible.reload.published_at, second.reload.published_at ].compact.length).to eq(1)
    expect(future.reload.published_at).to be_nil
  end

  it "caps exponential retry delay and records bounded error metadata" do
    event.update!(attempts: 20)
    allow(producer).to receive(:publish).and_raise(StandardError, "x" * 500)

    expect(described_class.new(producer: producer, clock: clock).publish_one(event.id)).to be(false)

    expected_delay = [ 2**8, described_class::MAX_BACKOFF ].min.seconds
    expect(event.reload).to have_attributes(attempts: 21, next_attempt_at: now + expected_delay,
      last_error: "StandardError")
  end
end
